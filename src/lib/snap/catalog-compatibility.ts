/**
 * 카탈로그 ↔ 입력 사진 호환성 점수.
 *
 * 같은 카탈로그라도 입력 사진 조건(조명·얼굴 크기 등) 에 따라 결과 품질이
 * 크게 갈리므로, 사용자가 "위험 조합" 을 고르기 전에 사전 경고하는 데이터를 제공.
 *
 * 점수 의미:
 *   ≥ 0.7  : safe — 추천 (별 표시)
 *   0.4..0.7: caution — 경고 배지 ("결과가 달라질 수 있어요")
 *   < 0.4  : risky — 강한 경고 ("얼굴 변형 위험 높음")
 *
 * 점수 계산:
 *   base = 1.0 - 0.0(low) / 0.15(medium) / 0.3(high)  ← intensity 패널티
 *   - 입력 face 가 작거나 (minFaceSize < 120px) : -0.2
 *   - 입력 평균 luminance 가 낮으면 (< 70) intensity 가 high 일 때만 추가: -0.2
 *   - 입력 face 가 미검출(faceCount=null) → score 유지 (정보 부족, 중립)
 *
 * 셀카 / 앵커 모드에서는 anchor 가 canonical 이미 normalize 됐다고 가정해 입력
 * 패널티 적용 안 함. 커플 모드에서만 입력 패널티 적용.
 */

import type { SnapCatalogItem } from '@/lib/snap/catalog';

export type CompatibilityLevel = 'safe' | 'caution' | 'risky';

export interface CompatibilityResult {
  score: number; // 0..1
  level: CompatibilityLevel;
  reasons: string[]; // 사용자에게 보여줄 short reason 들
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
}

export function scoreCompatibility(
  catalog: Pick<SnapCatalogItem, 'intensity' | 'label'>,
  input: CompatibilityInputMeta,
): CompatibilityResult {
  const reasons: string[] = [];

  // 1) intensity 베이스 패널티.
  const intensity = catalog.intensity ?? 'medium';
  let score = 1.0;
  if (intensity === 'medium') score -= 0.15;
  else if (intensity === 'high') {
    score -= 0.3;
    reasons.push('강한 스타일 카탈로그 — 입력 사진의 톤·조명을 크게 변환합니다');
  }

  // 2) 커플 모드 입력 패널티 (셀카는 anchor 가 normalize 됐다고 가정해 skip).
  if (input.mode === 'couple') {
    if (typeof input.minFaceSize === 'number' && input.minFaceSize < 120) {
      score -= 0.2;
      reasons.push(`얼굴이 작아요 (${input.minFaceSize}px). 반신 컷 권장`);
    }
    if (
      typeof input.avgLuminance === 'number' &&
      input.avgLuminance < 70 &&
      intensity === 'high'
    ) {
      score -= 0.2;
      reasons.push('야경/저조도 사진과 강한 backlight 카탈로그 조합은 변형 위험이 큽니다');
    }
  }

  score = Math.max(0, Math.min(1, score));
  const level: CompatibilityLevel =
    score >= 0.7 ? 'safe' : score >= 0.4 ? 'caution' : 'risky';

  return { score, level, reasons };
}
