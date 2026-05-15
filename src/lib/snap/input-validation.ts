/**
 * 사용자 업로드 입력 이미지의 품질 검증.
 *
 * sharp 로컬 분석만으로 결정적인 빠른 검증을 수행 (추가 fal 비용 0원):
 *   1) 해상도 — 짧은 변 1000px 미만이면 reject
 *   2) 밝기   — 평균 luminance 가 극단(너무 어둡거나 너무 밝음) 이면 warning
 *   3) 종횡비 — 극단적 가로/세로 (예: 5:1) 면 warning (정상 portrait/landscape 는 OK)
 *
 * 결과는 두 단계:
 *   - errors  : 사용자 차단 (재업로드 요구)
 *   - warnings: 통과시키지만 안내 (사용자 선택)
 *
 * 얼굴 개수 / 시선 / 블러 같은 고급 검증은 fal 얼굴 검출 모델이 필요해
 * 추가 비용 ~$0.003/장 — 현재 PR 에서는 도입 X (cost vs 효과 미정).
 * 추후 도입 시 이 모듈의 `validateInputImage` 에 옵션으로 추가 가능.
 */

import sharp from 'sharp';

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
  };
}

const MIN_SHORTEST_SIDE = 1000; // px — 셀카는 보통 3000+ 이지만 안전 최소.
const LUMINANCE_TOO_DARK = 40; // 0..255 — 매우 어두운 사진
const LUMINANCE_TOO_BRIGHT = 230; // 거의 흰색 oversaturation
const ASPECT_MAX = 3.0; // 가로:세로 또는 세로:가로 비율 임계

/**
 * URL 또는 Buffer 를 받아 sharp 로 검증.
 *
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
          meta: { width: 0, height: 0, avgLuminance: 0, aspectRatio: 0 },
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
      meta: { width: 0, height: 0, avgLuminance: 0, aspectRatio: 0 },
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
      meta: { width: 0, height: 0, avgLuminance: 0, aspectRatio: 0 },
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

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    meta: { width, height, avgLuminance, aspectRatio },
  };
}
