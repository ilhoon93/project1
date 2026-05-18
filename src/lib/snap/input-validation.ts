/**
 * 사용자 업로드 입력 이미지의 품질 검증 — sharp 로컬 분석.
 *
 * 검사 항목:
 *   1) 해상도 — 짧은 변 1000px 미만이면 reject (errors)
 *   2) 밝기   — 평균 luminance 가 극단이면 warning
 *   3) 종횡비 — 극단적 비율이면 warning
 *
 * 결과는 두 단계:
 *   - errors  : 사용자 차단 (재업로드 요구)
 *   - warnings: 통과시키지만 안내
 *
 * 과거에는 fal face-detection 으로 얼굴 수 / 크기까지 검증했으나, 2026-05 기준
 * fal 측에서 face-detection 모델 endpoint 가 카탈로그에서 제거된 상태라 의존을
 * 제거. 1명 사진을 커플 자리에 업로드하는 케이스 등은 사용자 인지 / 결과 확인
 * 의존. 대체 솔루션 도입 시 재도입 가능.
 */

import sharp from 'sharp';

export interface ImageValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  meta: {
    width: number;
    height: number;
    aspectRatio: number;
  };
}

const MIN_SHORTEST_SIDE = 1000; // px — 셀카는 보통 3000+ 이지만 안전 최소.
const LUMINANCE_TOO_DARK = 40; // 0..255 — 매우 어두운 사진
const LUMINANCE_TOO_BRIGHT = 230; // 거의 흰색 oversaturation
const ASPECT_MAX = 3.0; // 가로:세로 또는 세로:가로 비율 임계

/**
 * URL 또는 Buffer 를 받아 sharp 로 검증.
 * 실패(네트워크 / 디코드 에러)는 errors 에 그대로 넘기고 ok=false.
 * 정상이면 위 룰로 errors / warnings 분류.
 */
export async function validateInputImage(
  source: string | Buffer,
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
          meta: { width: 0, height: 0, aspectRatio: 0 },
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
      meta: { width: 0, height: 0, aspectRatio: 0 },
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
      meta: { width: 0, height: 0, aspectRatio: 0 },
    };
  }

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const shortest = Math.min(width, height);
  const aspectRatio =
    width > 0 && height > 0 ? Math.max(width, height) / Math.min(width, height) : 0;
  // RGB 채널 평균에서 luminance 근사 (Rec.601 가중치) — warning 판단 전용.
  const [rCh, gCh, bCh] = stats.channels;
  const avgLuminance =
    rCh && gCh && bCh ? 0.299 * rCh.mean + 0.587 * gCh.mean + 0.114 * bCh.mean : 128;

  if (shortest < MIN_SHORTEST_SIDE) {
    errors.push(
      `해상도가 너무 낮습니다 (짧은 변 ${shortest}px). 최소 ${MIN_SHORTEST_SIDE}px 이상의 사진이 필요합니다.`,
    );
  }
  if (avgLuminance < LUMINANCE_TOO_DARK) {
    warnings.push('사진이 매우 어두워요. 밝은 곳에서 다시 찍으면 더 좋은 결과가 나옵니다.');
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

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    meta: { width, height, aspectRatio },
  };
}
