/**
 * 카탈로그 ↔ 입력 사진 호환성 점수 — v3.
 *
 * 셀카 모드와 커플 모드의 위험 패턴이 매우 다르므로 모드별로 완전히 분리된
 * 규칙으로 판정. 카탈로그 자체 그레이드 강도 (intensity) 패널티는 제거 — 운영
 * 데이터로 보니 intensity 만으로는 위험도 예측이 부정확했음.
 *
 * 등급:
 *   safe    : 그대로 진행해도 OK (배지 없음)
 *   caution : 주의 — prompt-only 권장 + 자동 모드 전환 banner 노출
 *   risky   : 비추 — prompt-only 강력 권장 (현재는 셀카 모드의 measurable 위험 케이스에만 사용)
 *
 * ── 셀카 모드 (anchor) ──────────────────────────────────
 *
 *   1. personality === 'groom-solo' 또는 'bride-solo'
 *      → 항상 safe. (앵커가 클로즈업 normalize 라 단독 컷에는 잘 맞음.)
 *   2. personality === 'together' + framing === 'full' + hasSideAngle
 *      → risky (비추). 함께 + 전신 + 측면 = 얼굴이 작아지면서 측면 재구성 위험
 *        이 동시에 작용. prompt-only 강추.
 *   3. 그 외
 *      → safe.
 *
 *   ※ 셀카 모드는 anchor 가 canonical normalize 됐다고 가정 → 입력 face size /
 *     luminance 패널티는 적용 안 함.
 *
 * ── 커플 모드 ──────────────────────────────────────────
 *
 *   사용자 입력의 가장 큰 얼굴 폭 비율 (faceSizeRatio) 을 client-side
 *   MediaPipe 로 측정. 측정 실패 시 (faceSizeRatio = null) → 무조건 safe
 *   (fallback). 이 모드에서는 risky 등급을 만들지 않음 — 사용자가 입력 사진을
 *   기준으로 결과가 거의 보장되므로 강한 경고는 과함.
 *
 *   1. faceSizeRatio >= SMALL_FACE_RATIO (얼굴 크게 보이는 입력)
 *      → 모든 카탈로그 safe.
 *   2. faceSizeRatio < SMALL_FACE_RATIO (전신 입력, 얼굴 작음)
 *      AND (카탈로그 framing === 'closeup'  OR  카탈로그 isSeated === true)
 *      → caution. 입력 전신 vs 카탈로그 클로즈업/앉음 = 구도 미스매치로 얼굴
 *        강하게 재구성될 수 있음. prompt-only 권장.
 *   3. 그 외 (faceSizeRatio < SMALL_FACE_RATIO + 카탈로그 full + 서 있음)
 *      → safe (입력과 카탈로그 모두 전신 서있음 = 자연스럽게 매칭).
 */

import type { SnapCatalogItem } from '@/lib/snap/catalog';
import { framingOf } from '@/lib/snap/catalog';

export type CompatibilityLevel = 'safe' | 'caution' | 'risky';
export type RecommendedReferenceMode = 'strict' | 'prompt-only';

export interface CompatibilityResult {
  /** 등급 (UI 배지 / 추천 banner 조건). */
  level: CompatibilityLevel;
  /** 사용자에게 보여줄 짧은 사유. caution/risky 일 때만 채워짐. */
  reasons: string[];
  /** caution / risky 일 때 권장 합성 방식 (자동 모드 추천 banner 가 사용). */
  recommendedMode?: RecommendedReferenceMode;
}

export interface CompatibilityInputMeta {
  /** 'couple' 일 때만 입력 face 메타 사용. 'anchor' 는 카탈로그 메타만으로 판정. */
  mode: 'couple' | 'anchor' | 'unknown';
  /**
   * 커플 모드 입력 사진의 가장 큰 얼굴 폭 ÷ 이미지 폭 (0..1).
   * MediaPipe Face Detector 로 client-side 측정. null = 미측정.
   *   ≥ 0.15 = 얼굴이 충분히 크게 보임 (셀카·반신)
   *   < 0.15 = 얼굴 작음 (전신 입력)
   */
  faceSizeRatio?: number | null;
}

/** 입력 얼굴이 이 비율 미만이면 "전신/얼굴 작음" 으로 간주. */
const SMALL_FACE_RATIO = 0.15;

export function scoreCompatibility(
  catalog: Pick<
    SnapCatalogItem,
    'personality' | 'framing' | 'hasSideAngle' | 'isSeated' | 'label'
  >,
  input: CompatibilityInputMeta,
): CompatibilityResult {
  // ── 셀카 (anchor) 모드 ──────────────────────────────────
  if (input.mode === 'anchor') {
    // 단독 컷은 항상 safe.
    if (
      catalog.personality === 'groom-solo' ||
      catalog.personality === 'bride-solo'
    ) {
      return { level: 'safe', reasons: [] };
    }
    // 함께 컷 + 전신 + 측면 = 변형 위험 큼 → 비추.
    if (
      catalog.personality === 'together' &&
      framingOf(catalog as SnapCatalogItem) === 'full' &&
      catalog.hasSideAngle === true
    ) {
      return {
        level: 'risky',
        reasons: [
          '전신 + 측면 컷은 셀카로 만들 때 얼굴이 작아지면서 측면 재구성 위험이 큽니다',
        ],
        recommendedMode: 'prompt-only',
      };
    }
    return { level: 'safe', reasons: [] };
  }

  // ── 커플 모드 ──────────────────────────────────────────
  if (input.mode === 'couple') {
    const faceRatio = input.faceSizeRatio ?? null;
    // 측정 실패 또는 큰 얼굴 입력 → 안전.
    if (faceRatio === null || faceRatio >= SMALL_FACE_RATIO) {
      return { level: 'safe', reasons: [] };
    }
    // 입력 전신 + 카탈로그가 클로즈업 또는 앉아있음 → 구도 미스매치.
    const framing = framingOf(catalog as SnapCatalogItem);
    const isCloseup = framing === 'closeup';
    const isSeated = catalog.isSeated === true;
    if (isCloseup || isSeated) {
      const reason = isCloseup && isSeated
        ? '입력은 전신인데 카탈로그가 클로즈업 + 앉은 자세 — 구도 차이가 큽니다'
        : isCloseup
          ? '입력은 전신인데 카탈로그가 클로즈업 — 얼굴이 강하게 재구성될 수 있어요'
          : '입력은 전신인데 카탈로그가 앉은 자세 — 구도 차이로 얼굴이 틀어질 수 있어요';
      return {
        level: 'caution',
        reasons: [reason],
        recommendedMode: 'prompt-only',
      };
    }
    // 입력 전신 + 카탈로그 전신/서 있음 → 안전 (자연스럽게 매칭).
    return { level: 'safe', reasons: [] };
  }

  // ── unknown ────────────────────────────────────────────
  return { level: 'safe', reasons: [] };
}
