/**
 * 카탈로그 ↔ 입력 사진 호환성 점수.
 *
 * 같은 카탈로그라도 입력 사진 조건(조명·얼굴 크기·구도 등) 에 따라 결과 품질이
 * 크게 갈리므로, 사용자가 "위험 조합" 을 고르기 전에 사전 경고하는 데이터를 제공.
 *
 * 점수 의미:
 *   ≥ 0.7   : safe    — 추천 (별 표시)
 *   0.4..0.7: caution — 경고 배지 + prompt-only 모드 추천
 *   < 0.4   : risky   — 강한 경고 + prompt-only 모드 강추
 *
 * v2 규칙 (`framing` + `faceSizeRatio` 차원 추가):
 *
 *   [셀카 / anchor 모드]
 *   - 카탈로그 framing=full      → caution (얼굴 작아져 유사도 ↓, prompt-only 추천)
 *   - 카탈로그 framing=closeup   → safe
 *   (셀카 모드에서는 anchor 가 이미 closeup 으로 normalize 돼서 들어가므로 카탈로그
 *    framing 만으로 판정.)
 *
 *   [커플 모드 + 입력 faceSizeRatio]
 *   - 입력 얼굴 큼 (≥ 0.25)           → 모든 카탈로그 safe (얼굴 비중 크니 어떤 컷에도 잘 들어감)
 *   - 입력 얼굴 보통 (0.15~0.25)      → closeup 카탈로그 caution / full 카탈로그 safe
 *   - 입력 얼굴 작음 (< 0.15, 전신)   → closeup 카탈로그 risky / full 카탈로그 caution
 *   - 입력 메타 없음 (faceSizeRatio 미측정) → intensity 패널티만 적용 (v1 호환)
 *
 *   + intensity 패널티는 v1 그대로 누적 적용.
 *
 * 셀카 / 앵커 모드에서는 anchor 가 canonical 이미 normalize 됐다고 가정해 입력
 * 사진의 luminance / faceSize 패널티는 적용 안 함 — 커플 모드에서만 적용.
 */

import type { SnapCatalogItem } from '@/lib/snap/catalog';
import { framingOf } from '@/lib/snap/catalog';

export type CompatibilityLevel = 'safe' | 'caution' | 'risky';
export type RecommendedReferenceMode = 'strict' | 'prompt-only';

export interface CompatibilityResult {
  score: number; // 0..1
  level: CompatibilityLevel;
  reasons: string[]; // 사용자에게 보여줄 short reason 들
  /** caution / risky 일 때 권장 합성 방식 — 자동 모드 추천 banner 가 사용. */
  recommendedMode?: RecommendedReferenceMode;
}

export interface CompatibilityInputMeta {
  /** 'couple' 일 때만 입력 패널티 적용 */
  mode: 'couple' | 'anchor' | 'unknown';
  /** validation 단계에서 측정. null = 미검출 */
  faceCount?: number | null;
  /** 가장 작은 얼굴 짧은 변 (px). null = 미검출 */
  minFaceSize?: number | null;
  /** 평균 luminance 0..255. null = 미측정 */
  avgLuminance?: number | null;
  /**
   * v2 추가 — 입력 사진의 가장 큰 얼굴 폭 ÷ 이미지 폭 (0..1).
   * MediaPipe Face Detector 등으로 client-side 측정. null = 미측정.
   * 커플 모드에서만 사용:
   *   ≥ 0.25 = 얼굴 크게 보이는 셀카-like 입력
   *   < 0.15 = 얼굴 작은 전신 입력 (closeup 카탈로그와 조합 시 변형 위험)
   */
  faceSizeRatio?: number | null;
}

const SMALL_FACE_RATIO = 0.15;
const LARGE_FACE_RATIO = 0.25;

export function scoreCompatibility(
  catalog: Pick<SnapCatalogItem, 'intensity' | 'label' | 'framing'>,
  input: CompatibilityInputMeta,
): CompatibilityResult {
  const reasons: string[] = [];
  let recommendedMode: RecommendedReferenceMode | undefined;

  // 1) intensity 베이스 패널티.
  const intensity = catalog.intensity ?? 'medium';
  let score = 1.0;
  if (intensity === 'medium') score -= 0.15;
  else if (intensity === 'high') {
    score -= 0.3;
    reasons.push('강한 스타일 카탈로그 — 입력 사진의 톤·조명을 크게 변환합니다');
  }

  // 2) framing × mode 패널티 — v2 핵심.
  const framing = framingOf(catalog as SnapCatalogItem);

  if (input.mode === 'anchor') {
    // 셀카/앵커 모드 — 카탈로그가 풀신이면 얼굴이 작아져 유사도 떨어짐.
    if (framing === 'full') {
      score -= 0.25;
      reasons.push('전신 컷은 얼굴이 작아져 유사도가 떨어질 수 있어요');
      recommendedMode = 'prompt-only';
    }
  } else if (input.mode === 'couple') {
    // 커플 모드 — 입력 사진 얼굴 크기에 따라 카탈로그 framing 과 호환성 갈림.
    const faceRatio = input.faceSizeRatio ?? null;
    if (faceRatio !== null) {
      if (faceRatio < SMALL_FACE_RATIO) {
        // 입력이 전신 (얼굴 작음).
        if (framing === 'closeup') {
          score -= 0.4;
          reasons.push(
            '입력 사진은 전신인데 카탈로그가 클로즈업 — 얼굴이 강하게 재구성될 위험',
          );
          recommendedMode = 'prompt-only';
        } else {
          score -= 0.2;
          reasons.push('입력 얼굴이 작아서 일부 구도는 유사도가 떨어질 수 있어요');
          recommendedMode = 'prompt-only';
        }
      } else if (faceRatio < LARGE_FACE_RATIO && framing === 'closeup') {
        // 보통 반신 입력 + 클로즈업 카탈로그 → 약한 주의.
        score -= 0.15;
        reasons.push('카탈로그 구도가 입력 사진보다 더 가까워요');
        recommendedMode = 'prompt-only';
      }
    }

    // 3) 기존 minFaceSize / luminance 패널티 (faceSizeRatio 보강).
    if (typeof input.minFaceSize === 'number' && input.minFaceSize < 120) {
      score -= 0.1;
      if (!reasons.some((r) => r.includes('얼굴'))) {
        reasons.push(`얼굴이 작아요 (${input.minFaceSize}px). 반신 컷 권장`);
      }
    }
    if (
      typeof input.avgLuminance === 'number' &&
      input.avgLuminance < 70 &&
      intensity === 'high'
    ) {
      score -= 0.2;
      reasons.push(
        '야경/저조도 사진과 강한 backlight 카탈로그 조합은 변형 위험이 큽니다',
      );
      recommendedMode = 'prompt-only';
    }
  }

  score = Math.max(0, Math.min(1, score));
  const level: CompatibilityLevel =
    score >= 0.7 ? 'safe' : score >= 0.4 ? 'caution' : 'risky';

  return {
    score,
    level,
    reasons,
    recommendedMode: level === 'safe' ? undefined : recommendedMode,
  };
}
