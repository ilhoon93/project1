/**
 * 사용자 업로드 입력 이미지의 품질 검증.
 *
 * 2단계 검증:
 *   Step A — sharp 로컬 분석 (비용 0):
 *     1) 해상도 — 짧은 변 1000px 미만이면 reject
 *     2) 밝기   — 평균 luminance 가 극단이면 warning
 *     3) 종횡비 — 극단적 비율이면 warning
 *
 *   Step B — fal face detection (옵션, ~$0.001/장):
 *     1) 얼굴 수 — expectedFaces 와 일치하는지 (1=solo, 2=couple)
 *     2) 얼굴 크기 — 짧은 변 ≥ minFaceSize px 이상
 *     3) 검출 자체 실패 시 → warning (sharp 통과면 그래도 진행 가능)
 *
 * 결과는 두 단계:
 *   - errors  : 사용자 차단 (재업로드 요구)
 *   - warnings: 통과시키지만 안내
 *
 * 비용 최적화: faceDetection 옵션이 true 일 때만 fal 호출. 기본 false 라
 * 기존 호출 사이트는 영향 0. anchor/couple 입력 단계에서 명시적 true 로 켠다.
 */

import sharp from 'sharp';
import { detectFaces, type DetectedFace } from '@/lib/fal/client';

/**
 * URL 의 host 만 추출해 로깅 — 전체 URL 은 PII (signed token 등) 포함 가능.
 * 파싱 실패하면 '(invalid url)' 로 fallback.
 */
function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '(invalid url)';
  }
}

/**
 * fal SDK 가 throw 한 error 객체를 가능한 모든 정보로 시리얼라이즈.
 *   - message + cause chain (최대 3단)
 *   - status / body / cause 같은 추가 필드 (fal SDK 의 ValidationError 등에 있음)
 *   - Vercel 로그에서 한 줄로 정확한 원인 추적 가능
 */
function serializeFalError(e: unknown): string {
  if (!(e instanceof Error)) return String(e).slice(0, 500);
  const parts: string[] = [`message=${e.message}`];
  const obj = e as unknown as Record<string, unknown>;
  // 알려진 메타 필드 (status / body / statusText) 우선 + 그 외 모든 own property
  // 캡처. fal SDK 의 ApiError 가 어떤 필드를 노출할지 모르므로 conservative 로
  // 전부 시리얼라이즈. (cause / message / stack 은 별도 처리하므로 제외.)
  const skip = new Set(['cause', 'message', 'stack', 'name']);
  for (const key of Object.getOwnPropertyNames(e)) {
    if (skip.has(key)) continue;
    try {
      const val = obj[key];
      if (val === undefined || val === null) continue;
      const valStr = typeof val === 'string' ? val : JSON.stringify(val);
      parts.push(`${key}=${valStr.slice(0, 300)}`);
    } catch {
      parts.push(`${key}=<unserializable>`);
    }
  }
  // cause chaining (node 18+) — 별도 처리해 chain 깊이도 노출.
  let cause: unknown = obj.cause;
  let depth = 0;
  while (cause && depth < 3) {
    if (cause instanceof Error) {
      const causeObj = cause as unknown as Record<string, unknown>;
      const causeStatus = causeObj.status !== undefined ? ` status=${String(causeObj.status)}` : '';
      const causeBody = causeObj.body !== undefined
        ? ` body=${(typeof causeObj.body === 'string' ? causeObj.body : JSON.stringify(causeObj.body)).slice(0, 200)}`
        : '';
      parts.push(`cause[${depth}]=${cause.message}${causeStatus}${causeBody}`);
    } else {
      parts.push(`cause[${depth}]=${String(cause).slice(0, 200)}`);
    }
    cause = (cause as { cause?: unknown })?.cause;
    depth += 1;
  }
  return parts.join(' | ');
}

/**
 * SNAP_INPUT_VALIDATION_MODE 환경변수 읽기.
 *   strict (default)  : fal face-detection 호출 실패 시 errors 차단.
 *   permissive        : 호출 실패 시 warnings 만 — 사용자는 진행 가능, 단
 *                       input_face_* 컬럼은 NULL 로 남음. 호출 성공 + face count
 *                       mismatch 는 여전히 차단 (1명 사진을 커플 자리에 등).
 *   off               : face-detection 자체 skip — 비용 절약 / 검증 비활성.
 */
type InputValidationMode = 'strict' | 'permissive' | 'off';
function getInputValidationMode(): InputValidationMode {
  const v = process.env.SNAP_INPUT_VALIDATION_MODE;
  if (v === 'strict' || v === 'permissive' || v === 'off') return v;
  return 'strict';
}

export interface ImageValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  meta: {
    width: number;
    height: number;
    /** 평균 luminance 0..255 */
    avgLuminance: number;
    aspectRatio: number;
    /** Face detection 이 켜진 경우 검출된 얼굴 수, 아니면 null */
    faceCount: number | null;
    /** 검출된 얼굴 중 가장 작은 변 (pixel). null = 검출 안 함 또는 0개 */
    minFaceSize: number | null;
  };
}

export interface ValidateOptions {
  /** true 면 fal face detection 까지 수행 (비용 ~$0.001/장) */
  faceDetection?: boolean;
  /** 기대 얼굴 수. faceDetection=true 일 때 사용. 1=solo, 2=couple. */
  expectedFaces?: 1 | 2;
  /** 얼굴 짧은 변 최소 픽셀. 미만이면 error. 기본 80. */
  minFaceSize?: number;
}

const MIN_SHORTEST_SIDE = 1000; // px — 셀카는 보통 3000+ 이지만 안전 최소.
const LUMINANCE_TOO_DARK = 40; // 0..255 — 매우 어두운 사진
const LUMINANCE_TOO_BRIGHT = 230; // 거의 흰색 oversaturation
const ASPECT_MAX = 3.0; // 가로:세로 또는 세로:가로 비율 임계
const DEFAULT_MIN_FACE_SIZE = 80; // px — 얼굴 짧은 변. 합성 후 detail 보존 임계.

/**
 * detectFaces 결과에서 가장 작은 얼굴의 짧은 변 픽셀 계산.
 * 빈 배열이면 null.
 */
function computeMinFaceSize(faces: DetectedFace[]): number | null {
  if (faces.length === 0) return null;
  return Math.min(
    ...faces.map(({ bbox }) => Math.min(bbox[2] - bbox[0], bbox[3] - bbox[1])),
  );
}

/**
 * URL 또는 Buffer 를 받아 sharp + (옵션) fal face detection 으로 검증.
 *
 * 실패(네트워크 / 디코드 에러)는 errors 에 그대로 넘기고 ok=false.
 * 정상이면 위 룰로 errors / warnings 분류.
 *
 * face detection 은 옵션. Buffer 입력은 face detection 미지원 (fal 은 URL 만 받음).
 */
export async function validateInputImage(
  source: string | Buffer,
  options: ValidateOptions = {},
): Promise<ImageValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  let buf: Buffer;
  try {
    if (typeof source === 'string') {
      const res = await fetch(source);
      if (!res.ok) {
        return {
          ok: false,
          errors: [`이미지를 가져오지 못했습니다 (HTTP ${res.status})`],
          warnings: [],
          meta: {
            width: 0,
            height: 0,
            avgLuminance: 0,
            aspectRatio: 0,
            faceCount: null,
            minFaceSize: null,
          },
        };
      }
      buf = Buffer.from(await res.arrayBuffer());
    } else {
      buf = source;
    }
  } catch (e) {
    return {
      ok: false,
      errors: [`이미지 로딩 실패: ${e instanceof Error ? e.message : 'unknown'}`],
      warnings: [],
      meta: {
        width: 0,
        height: 0,
        avgLuminance: 0,
        aspectRatio: 0,
        faceCount: null,
        minFaceSize: null,
      },
    };
  }

  let metadata: sharp.Metadata;
  let stats: sharp.Stats;
  try {
    const pipeline = sharp(buf, { failOn: 'truncated' });
    metadata = await pipeline.metadata();
    stats = await pipeline.stats();
  } catch (e) {
    return {
      ok: false,
      errors: [`이미지 디코드 실패: ${e instanceof Error ? e.message : 'unknown'}`],
      warnings: [],
      meta: {
        width: 0,
        height: 0,
        avgLuminance: 0,
        aspectRatio: 0,
        faceCount: null,
        minFaceSize: null,
      },
    };
  }

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const shortest = Math.min(width, height);
  const aspectRatio = width > 0 && height > 0 ? Math.max(width, height) / Math.min(width, height) : 0;
  // RGB 채널 평균에서 luminance 근사 (Rec.601 가중치).
  const [rCh, gCh, bCh] = stats.channels;
  const avgLuminance =
    rCh && gCh && bCh ? 0.299 * rCh.mean + 0.587 * gCh.mean + 0.114 * bCh.mean : 128;

  // ── 차단 (errors) ─────────────────────────────────────
  if (shortest < MIN_SHORTEST_SIDE) {
    errors.push(
      `해상도가 너무 낮습니다 (짧은 변 ${shortest}px). 최소 ${MIN_SHORTEST_SIDE}px 이상의 사진이 필요합니다.`,
    );
  }

  // ── 안내 (warnings) ───────────────────────────────────
  if (avgLuminance < LUMINANCE_TOO_DARK) {
    warnings.push(
      '사진이 매우 어두워요. 밝은 곳에서 다시 찍으면 더 좋은 결과가 나옵니다.',
    );
  } else if (avgLuminance > LUMINANCE_TOO_BRIGHT) {
    warnings.push(
      '사진이 매우 밝아요(역광 / 과노출). 균일한 조명에서 다시 찍으면 더 정확한 얼굴 합성이 가능합니다.',
    );
  }
  if (aspectRatio > ASPECT_MAX) {
    warnings.push(
      `종횡비가 극단적입니다 (${aspectRatio.toFixed(1)}:1). 일반적인 가로/세로 비율 사진(최대 3:1)이 권장됩니다.`,
    );
  }

  // ── Step B — fal face detection (옵션) ────────────────────
  // sharp 단계가 통과한 경우에만 호출 (이미 거른 케이스에 비용 안 씀).
  // SNAP_INPUT_VALIDATION_MODE=off 면 호출 자체 skip (비용 절약 / 비활성).
  let faceCount: number | null = null;
  let minFaceSize: number | null = null;
  const validationMode = getInputValidationMode();
  if (
    options.faceDetection &&
    validationMode !== 'off' &&
    errors.length === 0 &&
    typeof source === 'string'
  ) {
    const expected = options.expectedFaces ?? 1;
    const minSize = options.minFaceSize ?? DEFAULT_MIN_FACE_SIZE;
    try {
      const faces = await detectFaces(source);
      faceCount = faces.length;
      minFaceSize = computeMinFaceSize(faces);

      if (faces.length === 0) {
        // 검출 0개 — 가장 흔한 원인: 사진이 누워있음 / 얼굴 너무 멀음 / 마스크.
        errors.push(
          '얼굴을 찾을 수 없어요. 사진이 회전돼 있거나 얼굴이 너무 작거나 가려져 있을 수 있어요. 다시 확인해 주세요.',
        );
      } else if (faces.length < expected) {
        errors.push(
          `사진에서 얼굴이 ${faces.length}명만 검출됐어요. ${expected}명이 모두 정면을 바라보는 사진을 올려주세요.`,
        );
      } else if (faces.length > expected) {
        // 초과는 warning — 다른 사람이 같이 찍혀 있어도 진행은 가능 (모델이 메인 얼굴 선택).
        warnings.push(
          `사진에서 얼굴이 ${faces.length}명 검출됐어요 (기대 ${expected}명). 의도치 않은 사람이 포함됐다면 크롭해서 다시 올려주세요.`,
        );
      }

      if (minFaceSize !== null && minFaceSize < minSize) {
        errors.push(
          `얼굴이 너무 작아요 (가장 작은 얼굴 ${minFaceSize}px, 최소 ${minSize}px 필요). 반신 또는 상반신 컷으로 다시 올려주세요.`,
        );
      }
    } catch (e) {
      // 검출 자체 실패. SNAP_INPUT_VALIDATION_MODE 로 분기:
      //   strict (default): errors 차단 — 사용자에게 재시도 안내.
      //   permissive      : warnings 만 — 사용자 진행 가능, 메타는 NULL.
      // raw error 를 cause / status / body 까지 시리얼라이즈해서 Vercel 로그에
      // 한 줄로 노출 — fal endpoint 응답 형태 / 인증 실패 / 네트워크 실패 즉시 진단.
      console.warn('[input-validation] face detection failed', {
        sourceHost: typeof source === 'string' ? safeHost(source) : '(buffer)',
        expectedFaces: expected,
        mode: validationMode,
        error: serializeFalError(e),
      });
      if (validationMode === 'permissive') {
        warnings.push(
          '얼굴 자동 검증을 건너뛰었어요 (자동 검증 서비스 일시 장애). 진행은 가능하지만 사진 확인을 한 번 더 부탁드려요.',
        );
      } else {
        errors.push(
          '얼굴 자동 검증에 실패했어요 (자동 검증 서비스 일시 장애 가능성). 잠시 후 다시 시도해 주세요.',
        );
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    meta: { width, height, avgLuminance, aspectRatio, faceCount, minFaceSize },
  };
}
