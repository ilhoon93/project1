/**
 * 카탈로그 호환성 판정 v4 — 운영자 수동 태그 lookup 전용.
 *
 * v3 까지는 framing × hasSideAngle × isSeated × faceSizeRatio 자동 휴리스틱이
 * caution/risky 등급을 산출했지만, 운영하면서 정확도가 낮아 운영자가 admin 페이지
 * (/admin/snap-catalog-tags) 에서 카탈로그별 × 입력 조건별 태그를 직접 세팅하는
 * 방식으로 전환. 자동 휴리스틱은 완전 제거.
 *
 * 흐름:
 *   1. resolveAdminCondition(mode, faceSizeRatio) → 'selfies' | 'couple-fullbody' | null
 *      (커플 모드 + 얼굴 큰 입력은 null = 항상 safe)
 *   2. tagMap[catalogId][adminCondition] 으로 운영자 태그 lookup
 *   3. evaluateCompatibility(adminTag) → CompatibilityResult (level, reasons, recommendedMode, isRecommended)
 *   4. isCatalogHidden(adminTag) → picker 노출 차단 판정 (별도)
 *
 * 운영자 태그 미설정 = "운영자 평가 없음" = safe default.
 */

import type {
  CatalogAdminTag,
  CatalogInputCondition,
} from '@/lib/snap/catalog-admin-tags';

export type CompatibilityLevel = 'safe' | 'caution' | 'risky';
export type RecommendedReferenceMode = 'strict' | 'prompt-only';

export interface CompatibilityResult {
  /** 등급 — UI 배지 / banner 조건. */
  level: CompatibilityLevel;
  /** 사용자에게 보여줄 짧은 사유. caution/risky 일 때만 채워짐. */
  reasons: string[];
  /** caution / risky 일 때 권장 합성 방식 (자동 모드 추천 banner 가 사용). */
  recommendedMode?: RecommendedReferenceMode;
  /** 운영자가 '추천' 태그를 단 경우 true — 카드 추천 배지 + 정렬 우선순위에 사용. */
  isRecommended: boolean;
}

/** 입력 얼굴이 이 비율 미만이면 "전신/얼굴 작음" 으로 간주 (커플 모드만). */
const SMALL_FACE_RATIO = 0.15;

/**
 * 현재 사용 mode + 커플 입력 얼굴 크기 → admin 페이지의 input_condition 매핑.
 *
 *   - mode === 'anchor' (셀카1/3) → 'selfies'
 *   - mode === 'couple' + faceSizeRatio < 0.15 (전신 입력) → 'couple-fullbody'
 *   - mode === 'couple' + faceSizeRatio >= 0.15 또는 미측정 → null (어떤 condition 도 아님 = 항상 safe)
 *
 * null 이 반환되면 evaluateCompatibility(null) = safe 가 되어 운영자가 별도로
 * 신경 쓸 필요 없음.
 */
export function resolveAdminCondition(
  mode: 'anchor' | 'couple' | 'unknown',
  faceSizeRatio: number | null | undefined,
): CatalogInputCondition | null {
  if (mode === 'anchor') return 'selfies';
  if (
    mode === 'couple' &&
    typeof faceSizeRatio === 'number' &&
    faceSizeRatio < SMALL_FACE_RATIO
  ) {
    return 'couple-fullbody';
  }
  return null;
}

/**
 * 운영자 태그 기반 호환성 판정.
 * adminTag 가 null/undefined 면 default safe (배지 없음, 추천 banner 없음).
 */
export function evaluateCompatibility(
  adminTag: CatalogAdminTag | null | undefined,
): CompatibilityResult {
  if (!adminTag) {
    return { level: 'safe', reasons: [], isRecommended: false };
  }
  switch (adminTag) {
    case 'recommend':
      return { level: 'safe', reasons: [], isRecommended: true };
    case 'caution':
      return {
        level: 'caution',
        reasons: [
          '이 조건에서는 결과가 어색할 수 있어 얼굴 강화 모드를 권장합니다',
        ],
        recommendedMode: 'prompt-only',
        isRecommended: false,
      };
    case 'risky':
      return {
        level: 'risky',
        reasons: [
          '이 조건에서는 얼굴 변형 위험이 큽니다. 얼굴 강화 모드를 강력 권장합니다.',
        ],
        recommendedMode: 'prompt-only',
        isRecommended: false,
      };
    case 'hidden':
      // hidden 은 caller 가 isCatalogHidden() 으로 사전 차단해야 함.
      // 도달하면 안전하게 safe 로 fallback.
      return { level: 'safe', reasons: [], isRecommended: false };
  }
}

/**
 * adminTag 가 'hidden' 인지 — picker 노출 차단 판정.
 * 호출부에서 visibleCatalog 계산 시 이걸 먼저 체크해 카드 자체를 안 그림.
 */
export function isCatalogHidden(
  adminTag: CatalogAdminTag | null | undefined,
): boolean {
  return adminTag === 'hidden';
}
