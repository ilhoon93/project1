/**
 * snap_jobs finalize 헬퍼.
 *
 * fal CDN URL → (옵션) Phase B face-swap 복원 → (옵션) 후처리 업스케일 + sharpen
 * → public-images 영구 호스팅 → snap_jobs 갱신.
 *
 * /api/snap/finalize (단일, 사용자가 페이지에 머무를 때) 와
 * /api/snap/jobs/poll-pending (배치, mypage 진입 시 일괄 finalize) 양쪽에서
 * 동일한 로직을 공유하기 위해 추출.
 *
 * 토글:
 *   SNAP_IDENTITY_MODE  = 'off' | 'face-swap'  (default 'face-swap')
 *      face-swap: fal 결과 + selfie → face swap → 후처리 단계로 진입
 *   SNAP_UPSCALE_MODE    = 'off' | 'aura-sharpen' | 'topaz-sharpen'   (기존)
 *   SNAP_HARMONIZE_MODE  / SNAP_FINISHING_MODE — postprocess 모듈 안에서 처리
 *
 * 후처리는 카탈로그 결과 (catalogId 있음) 에만 적용. 앵커는 reference 라 skip.
 * 어느 단계라도 실패하면 직전 결과로 fallback — finalize 자체는 안 깨짐.
 */

import { compareFaces, getImageEditResult } from '@/lib/fal/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { markSnapJobCompleted, markSnapJobFailed } from '@/lib/snap/jobs';
import {
  applyUpscalePostprocess,
  fetchAsBuffer,
  getUpscaleMode,
} from '@/lib/snap/postprocess';
import { findSnapCatalog } from '@/lib/snap/catalog';
import {
  getIdentityMode,
  applyFaceSwapRestore,
  applyCoupleFaceSwapRestore,
} from '@/lib/snap/identity-restore';
import { getHarmonizeMode } from '@/lib/snap/harmonize';
import { getFinishingMode } from '@/lib/snap/finishing';

// ─────────────────────────────────────────────────────────────
// fal 호출 비용 추정치 (USD/장).
//
// 정확한 가격은 fal.ai dashboard 의 청구 내역 기준이며, 여기 값은 대시보드
// 분석용 근사치. 모델 가격이 바뀌면 이 상수를 갱신하면 즉시 fal_cost_usd 에
// 반영됨. 가격 모니터링 시 fal_cost_usd vs 실제 청구 차이를 보고 보정.
//
// 출처: fal.ai 모델 페이지 (2025 기준 medium quality), 가격 변동 가능성 있음.
// ─────────────────────────────────────────────────────────────
const COST_ESTIMATES_USD = {
  gptImage2: 0.08, // openai/gpt-image-2/edit (가장 큰 비중)
  faceSwap: 0.01,
  birefnet: 0.003,
  fluxImg2Img: 0.025,
  auraSr: 0.005,
  topaz: 0.015,
  faceDetection: 0.001,
};

/**
 * face similarity quality gate threshold.
 *   ≥ 0.5 : 동일 인물 강한 매칭 — 정상
 *   0.3 ~ 0.5: 동일 인물 가능 — warning 로깅만
 *   < 0.3 : 다른 사람 — 로깅만 (자동 차단은 환불 처리와 충돌 위험 있어 미적용)
 */
const FACE_SIM_GOOD = 0.5;
const FACE_SIM_BAD = 0.3;

export interface FinalizeInput {
  userId: string;
  falRequestId: string;
  /** 저장 경로 prefix 용 라벨. 카탈로그 id 가 있으면 같이 들어감. 후처리 적용 여부도 결정. */
  catalogId?: string | null;
}

export interface FinalizeOutput {
  url: string;
}

/**
 * snap_jobs 행에서 model + selfie URL + personality 조회.
 * face-swap / 모델별 result fetcher 분기에 필요.
 */
async function loadJobContext(falRequestId: string): Promise<{
  model: string | null;
  userId: string | null;
  catalogId: string | null;
  catalogPath: 'anchored' | 'selfies' | 'couple' | null;
  groomSelfieUrl: string | null;
  brideSelfieUrl: string | null;
  couplePhotoUrl: string | null;
}> {
  const admin = createAdminClient();
  const { data: job } = await admin
    .from('snap_jobs')
    .select('model, user_id, catalog_id, catalog_path, couple_photo_url')
    .eq('fal_request_id', falRequestId)
    .maybeSingle();
  if (!job) {
    return {
      model: null,
      userId: null,
      catalogId: null,
      catalogPath: null,
      groomSelfieUrl: null,
      brideSelfieUrl: null,
      couplePhotoUrl: null,
    };
  }
  let groomSelfieUrl: string | null = null;
  let brideSelfieUrl: string | null = null;
  if (job.user_id) {
    const { data: anchor } = await admin
      .from('snap_anchors')
      .select('groom_selfie_url, bride_selfie_url')
      .eq('user_id', job.user_id)
      .maybeSingle();
    groomSelfieUrl = anchor?.groom_selfie_url ?? null;
    brideSelfieUrl = anchor?.bride_selfie_url ?? null;
  }
  return {
    model: (job.model as string | null) ?? null,
    userId: (job.user_id as string | null) ?? null,
    catalogId: (job.catalog_id as string | null) ?? null,
    catalogPath: (job.catalog_path as 'anchored' | 'selfies' | 'couple' | null) ?? null,
    groomSelfieUrl,
    brideSelfieUrl,
    couplePhotoUrl:
      ((job as { couple_photo_url?: string | null }).couple_photo_url) ?? null,
  };
}

/**
 * 한 작업을 finalize. fal 에서 result 가져와 (옵션) face-swap → (옵션) 후처리 후
 * public-images 에 업로드, snap_jobs 행을 completed 로 마크.
 *
 * 실패 시 markSnapJobFailed 호출 후 throw — 호출 측이 응답 결정.
 */
export async function finalizeSnapJob(input: FinalizeInput): Promise<FinalizeOutput> {
  // 0. snap_jobs 컨텍스트 (model + selfie) 로드.
  const ctx = await loadJobContext(input.falRequestId);

  // 단계별 타이밍 / 실행 stage / 비용 추적. 마지막에 markSnapJobCompleted 로 전달.
  const timings: Record<string, number> = {};
  const stages: Record<string, string | boolean | null> = {};
  let costUsd = COST_ESTIMATES_USD.gptImage2; // generation 은 항상 발생.

  // 1. fal 결과 URL.
  let generatedUrl: string;
  const t1 = Date.now();
  try {
    generatedUrl = await getImageEditResult(input.falRequestId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'result fetch failed';
    void markSnapJobFailed(input.falRequestId, msg);
    throw new Error(`fal result fetch failed: ${msg}`);
  }
  timings.fal_wait_ms = Date.now() - t1;

  // 2. Phase B face-swap 복원 (SNAP_IDENTITY_MODE=face-swap 일 때만).
  //    카탈로그 결과 + reference 있어야 의미 있음.
  //    - 셀카 모드: selfie URL reference 사용
  //    - 커플 모드: 사용자가 업로드한 커플 사진을 reference 로 사용 (PR 7)
  //    실패 시 generatedUrl 그대로.
  const identityMode = getIdentityMode();
  // 커플 모드는 couplePhotoUrl 만 있어도 가능, 셀카 모드는 selfie URL 필요.
  const faceSwapEligible =
    identityMode === 'face-swap' &&
    !!input.catalogId &&
    (!!ctx.groomSelfieUrl ||
      !!ctx.brideSelfieUrl ||
      (ctx.catalogPath === 'couple' && !!ctx.couplePhotoUrl));
  stages.face_swap = false;
  if (faceSwapEligible) {
    const catalog = findSnapCatalog(input.catalogId!);
    if (catalog) {
      const t2 = Date.now();
      try {
        if (ctx.catalogPath === 'couple' && ctx.couplePhotoUrl) {
          // 커플 모드: 커플 사진의 두 얼굴을 결과에 입혀 identity 보존.
          generatedUrl = await applyCoupleFaceSwapRestore({
            generatedUrl,
            couplePhotoUrl: ctx.couplePhotoUrl,
          });
          stages.face_swap = true;
          // 커플 모드는 항상 2회 face-swap.
          costUsd += COST_ESTIMATES_USD.faceSwap * 2;
        } else if (ctx.groomSelfieUrl || ctx.brideSelfieUrl) {
          // 셀카 / 앵커 모드: 기존 흐름.
          generatedUrl = await applyFaceSwapRestore({
            generatedUrl,
            personality: catalog.personality,
            groomSelfieUrl: ctx.groomSelfieUrl,
            brideSelfieUrl: ctx.brideSelfieUrl,
          });
          stages.face_swap = true;
          // personality='together' 면 2명 face-swap, solo 는 1명.
          const swapCount = catalog.personality === 'together' ? 2 : 1;
          costUsd += COST_ESTIMATES_USD.faceSwap * swapCount;
        }
      } catch (e) {
        console.warn(
          '[finalize] face-swap failed, continuing with original generation',
          input.falRequestId,
          e,
        );
      }
      timings.face_swap_ms = Date.now() - t2;
    }
  }

  // 3. 후처리 (카탈로그 결과만). 앵커는 reference 라 비용 / 시간 절약을 위해 skip.
  const mode = getUpscaleMode();
  const isCatalog = !!input.catalogId;
  stages.upscale = mode;
  stages.harmonize = getHarmonizeMode();
  stages.finishing = getFinishingMode();
  let imageBuf: Buffer;
  const t3 = Date.now();
  try {
    imageBuf = isCatalog
      ? await applyUpscalePostprocess(generatedUrl, mode, input.catalogId, ctx.catalogPath)
      : await fetchAsBuffer(generatedUrl);
    if (isCatalog) {
      // 후처리 단계가 정상 종료된 경우만 비용 가산. 각 단계는 env 토글에 따라 동작.
      if (stages.harmonize !== 'off') costUsd += COST_ESTIMATES_USD.birefnet;
      if (stages.finishing === 'img2img') costUsd += COST_ESTIMATES_USD.fluxImg2Img;
      if (mode === 'aura-sharpen') costUsd += COST_ESTIMATES_USD.auraSr;
      else if (mode === 'topaz-sharpen') costUsd += COST_ESTIMATES_USD.topaz;
    }
  } catch (e) {
    if (isCatalog) {
      console.warn(
        '[finalize] postprocess failed, falling back to original',
        input.falRequestId,
        e,
      );
      try {
        imageBuf = await fetchAsBuffer(generatedUrl);
      } catch (e2) {
        const msg = e2 instanceof Error ? e2.message : 'fetch original failed';
        void markSnapJobFailed(input.falRequestId, msg);
        throw new Error(`fetch original failed: ${msg}`);
      }
    } else {
      const msg = e instanceof Error ? e.message : 'fetch original failed';
      void markSnapJobFailed(input.falRequestId, msg);
      throw new Error(`fetch original failed: ${msg}`);
    }
  }
  timings.postprocess_ms = Date.now() - t3;

  // 4. public-images 버킷에 영구 호스팅.
  let publicUrl: string;
  const t4 = Date.now();
  try {
    const slug = input.catalogId ? `${input.catalogId}-` : '';
    const path = `wedding-snap/${input.userId}/${slug}${Date.now()}.jpg`;
    const admin = createAdminClient();
    const { error: upErr } = await admin.storage
      .from('public-images')
      .upload(path, imageBuf, { contentType: 'image/jpeg', upsert: false });
    if (upErr) throw upErr;
    publicUrl = admin.storage.from('public-images').getPublicUrl(path).data.publicUrl;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'storage upload failed';
    void markSnapJobFailed(input.falRequestId, msg);
    throw new Error(`storage upload failed: ${msg}`);
  }
  timings.storage_upload_ms = Date.now() - t4;

  // 5. snap_jobs 완료 마크 + 비용·타이밍·stages 로그 patch (PR 114).
  void markSnapJobCompleted(input.falRequestId, publicUrl, {
    falCostUsd: Math.round(costUsd * 10000) / 10000, // 0.0001 단위
    phaseTimings: timings,
    pipelineStages: stages,
  });

  // 6. (옵션) Face similarity 측정 — quality gate / 분석용.
  //    reference 선정은 catalog personality 에 따라 분기:
  //      커플 모드 → 사용자 커플 사진 1장 (groom 컬럼에 단일 점수)
  //      groom-solo → groomSelfie → face_similarity_groom
  //      bride-solo → brideSelfie → face_similarity_bride
  //      together   → 양쪽 셀카 모두 있으면 병렬 측정 → 각각 컬럼에 저장
  //    similarity 점수가 임계 미만이면 warn 로깅 (자동 차단/환불 X — 사용자가
  //    이미 결과를 받고 있어 환불 처리가 복잡해짐. 분석용 누적 기록만).
  //
  //    과거에는 void IIFE 로 fire-and-forget 처리했으나, Vercel 서버리스에서
  //    HTTP 응답 반환 직후 인스턴스가 freeze 되어 측정/UPDATE 가 자주 컷오프됐다
  //    (face_similarity_* 컬럼이 거의 NULL 인 원인). await 로 바꿔 응답이
  //    +2~5초 늦더라도 데이터가 일관되게 쌓이게 한다. 측정 실패는 try/catch 로
  //    삼켜 사용자 결과(URL) 에는 영향 없음.
  try {
    const refs = pickFaceSimRefs(ctx, input.catalogId ?? null);
    if (refs.length > 0) {
      // 병렬 측정 — 한쪽 실패해도 다른 쪽은 저장. together 케이스에서 latency 절감.
      const measurements = await Promise.all(
        refs.map(async (ref) => {
          try {
            const score = await compareFaces(ref.url, publicUrl);
            return { ref, score };
          } catch (e) {
            console.warn(
              '[finalize] face similarity failed for',
              ref.target,
              input.falRequestId,
              e,
            );
            return null;
          }
        }),
      );
      const ok = measurements.filter(
        (m): m is { ref: FaceSimRef; score: number } => m !== null,
      );
      if (ok.length > 0) {
        const admin = createAdminClient();
        const update: Record<string, unknown> = {
          face_similarity_ref: ok[0]!.ref.kind,
        };
        for (const m of ok) {
          if (m.ref.target === 'bride') {
            update.face_similarity_bride = m.score;
          } else {
            update.face_similarity_groom = m.score;
          }
        }
        await admin
          .from('snap_jobs')
          .update(update as never)
          .eq('fal_request_id', input.falRequestId);
        // quality gate 는 최저 점수 기준 (어느 쪽이든 식별 실패가 더 큰 이슈).
        const minScore = Math.min(...ok.map((m) => m.score));
        if (minScore < FACE_SIM_BAD) {
          console.warn(
            '[finalize] face similarity LOW',
            input.falRequestId,
            minScore.toFixed(3),
          );
        } else if (minScore < FACE_SIM_GOOD) {
          console.info(
            '[finalize] face similarity moderate',
            input.falRequestId,
            minScore.toFixed(3),
          );
        }
      }
    }
  } catch (e) {
    // 측정 실패해도 사용자 결과(URL)에는 영향 X.
    console.warn('[finalize] face similarity skipped', input.falRequestId, e);
  }

  return { url: publicUrl };
}

interface FaceSimRef {
  url: string;
  kind: 'selfie' | 'couple_input' | 'anchor';
  /** 어느 컬럼에 점수를 저장할지 — face_similarity_groom / face_similarity_bride */
  target: 'groom' | 'bride';
}

/**
 * 측정할 reference 목록 산출. catalog personality 가 의미적 기준이고,
 * couple 모드는 path 로 결정 (catalog 미지정인 직결 케이스 포함 가능).
 *
 * 반환 길이:
 *   - 커플 모드: 1 (커플 사진, groom 컬럼에 기록)
 *   - solo 모드: 0 또는 1 (해당 selfie 가 있어야 측정)
 *   - together: 0 / 1 / 2 (양쪽 selfie 가 있는지에 따라)
 *
 * personality 미상(카탈로그 누락 등)인 경우 together 와 동일하게 두 쪽 다 시도.
 */
function pickFaceSimRefs(
  ctx: {
    catalogPath: 'anchored' | 'selfies' | 'couple' | null;
    groomSelfieUrl: string | null;
    brideSelfieUrl: string | null;
    couplePhotoUrl: string | null;
  },
  catalogId: string | null,
): FaceSimRef[] {
  // 커플 모드: 사용자가 업로드한 커플 사진을 단일 reference 로 사용.
  // 사진 자체가 두 얼굴이라 fal face-similarity 가 가장 가까운 매칭을 자동 선택해
  // 단일 점수를 돌려준다. 한쪽 컬럼(groom)에 저장 — couple_input 으로 ref 표시.
  if (ctx.catalogPath === 'couple' && ctx.couplePhotoUrl) {
    return [{ url: ctx.couplePhotoUrl, kind: 'couple_input', target: 'groom' }];
  }
  const catalog = catalogId ? findSnapCatalog(catalogId) : null;
  const personality = catalog?.personality;
  if (personality === 'bride-solo') {
    return ctx.brideSelfieUrl
      ? [{ url: ctx.brideSelfieUrl, kind: 'selfie', target: 'bride' }]
      : [];
  }
  if (personality === 'groom-solo') {
    return ctx.groomSelfieUrl
      ? [{ url: ctx.groomSelfieUrl, kind: 'selfie', target: 'groom' }]
      : [];
  }
  // together (또는 personality 미상): 가능한 양쪽 모두 측정.
  const refs: FaceSimRef[] = [];
  if (ctx.groomSelfieUrl) {
    refs.push({ url: ctx.groomSelfieUrl, kind: 'selfie', target: 'groom' });
  }
  if (ctx.brideSelfieUrl) {
    refs.push({ url: ctx.brideSelfieUrl, kind: 'selfie', target: 'bride' });
  }
  return refs;
}
