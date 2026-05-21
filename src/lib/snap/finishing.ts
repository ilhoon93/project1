/**
 * Phase 2 — img2img 마감 패스 (finishing pass).
 *
 * harmonize 이후 결과를 flux/dev img2img 에 strength 0.18~0.22 로 한 번 더
 * 통과시켜 톤/조명/film grain 통일성을 한 단계 끌어올린다. 핵심:
 *
 *   - strength ≤ 0.25 : identity / pose / composition 거의 그대로 (drift 무시 가능)
 *   - 프롬프트에 카탈로그의 색온도 / mood 자연어 hint 를 직접 주입
 *   - guidance_scale 낮게 (3.5) — 프롬프트에 끌려가지 않고 입력 이미지 우선
 *
 * 효과: 카탈로그 톤이 단순 평균 매칭(Phase 1)보다 자연스러운 그라데이션으로 적용,
 * 미세한 film grain / lighting wrap 등도 함께 통합.
 *
 * 비용 ~$0.025/장 (flux/dev medium). env SNAP_FINISHING_MODE=img2img 일 때 활성.
 */

import {
  submitFluxImg2Img,
  getFluxImg2ImgResult,
} from '@/lib/fal/client';
import type { CatalogColorMeta } from '@/lib/snap/catalog-metadata';
import { findSnapCatalog } from '@/lib/snap/catalog';

export type FinishingMode = 'off' | 'img2img';

const VALID_MODES: readonly FinishingMode[] = ['off', 'img2img'];

/** env SNAP_FINISHING_MODE 읽기. 기본 'img2img' (활성). */
export function getFinishingMode(): FinishingMode {
  const v = process.env.SNAP_FINISHING_MODE;
  if (typeof v === 'string' && (VALID_MODES as readonly string[]).includes(v)) {
    return v as FinishingMode;
  }
  return 'img2img';
}

/**
 * 프롬프트 빌더 — 카탈로그 메타 + 원래 promptHint 의 톤 묘사를 압축해서 전달.
 * flux 는 짧고 구체적인 프롬프트에 잘 반응 (gpt-image-2 보다 instruction 무시).
 */
function buildFinishingPrompt(
  catalogId: string | null | undefined,
  meta: CatalogColorMeta | null,
): string {
  const baseInstruction =
    'Subtle photographic finishing pass. Preserve subject identity, pose, expression, ' +
    'clothing, and composition EXACTLY. Adjust only color grading and lighting harmony.';

  // 카탈로그 톤 hint 합성.
  let toneCue = '';
  if (meta) {
    toneCue = ` Target color grading: ${meta.moodHint}, white-balance matched to the catalog reference.`;
  }

  // 카탈로그 promptHint 의 컬러 그레이드 / 조명 키워드 추출 (있으면).
  // promptHint 전체를 넣으면 strength 0.2 라도 너무 끌려가니 첫 1~2 문장만.
  let catalogCue = '';
  if (catalogId) {
    const item = findSnapCatalog(catalogId);
    if (item) {
      const firstSentences = item.promptHint.split(/\. /).slice(0, 2).join('. ');
      catalogCue = ` Scene mood reference: ${firstSentences.slice(0, 200)}.`;
    }
  }

  const techCue =
    ' Cinematic editorial wedding photography, RAW DSLR look, natural film grain, ' +
    'no plastic skin, sharp focus on faces.';

  return baseInstruction + toneCue + catalogCue + techCue;
}

/**
 * 마감 패스 적용. URL 받아 img2img → 결과 URL 반환.
 *
 * 호출 측에서 받은 URL 을 다시 fetch → Buffer 변환은 finalize/postprocess 가 처리.
 * 여기선 fal 결과 URL 만 돌려준다.
 *
 * mode='off' → null 반환 (호출 측이 skip 판단).
 * 실패 시 throw — 호출 측이 fallback.
 */
export async function applyFinishing(
  sourceUrl: string,
  catalogId: string | null | undefined,
  catalogMeta: CatalogColorMeta | null,
  mode: FinishingMode,
): Promise<string | null> {
  if (mode === 'off') return null;

  const prompt = buildFinishingPrompt(catalogId, catalogMeta);

  // strength 0.1 — anchor / couple / selfies 모든 경로 공통.
  //
  // 과거엔 anchor 0.2 / couple 0.1 로 분기했으나, 운영 결과 anchor 경로에서
  // face-swap 으로 lock 된 identity 를 0.2 strength 가 다시 갈아엎으면서
  // 이목구비 / 피부톤이 flux 평균 prior 쪽으로 회귀하는 drift 가 관찰됨.
  // 톤 통합 효과는 0.1 에서도 충분히 얻을 수 있고 (LAB harmonize 가 이미
  // 대부분의 컬러 매칭을 처리), identity 보존을 일관적으로 우선.
  const strength = 0.1;

  const requestId = await submitFluxImg2Img({
    imageUrl: sourceUrl,
    prompt,
    strength,
    numInferenceSteps: 28,
    guidanceScale: 3.5,
  });
  return await getFluxImg2ImgResult(requestId);
}
