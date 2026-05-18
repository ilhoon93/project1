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

import { getImageEditResult } from '@/lib/fal/client';
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
}> {
  const admin = createAdminClient();
  const { data: job } = await admin
    .from('snap_jobs')
    .select('model, user_id, catalog_id, catalog_path')
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
  const identityMode = getIdentityMode();
  const faceSwapEligible =
    identityMode === 'face-swap' &&
    !!input.catalogId &&
    (!!ctx.groomSelfieUrl || !!ctx.brideSelfieUrl);
  stages.face_swap = false;
  if (faceSwapEligible) {
    const catalog = findSnapCatalog(input.catalogId!);
    if (catalog) {
      const t2 = Date.now();
      try {
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

  // 5. snap_jobs 완료 마크 + 비용·타이밍·stages 로그 patch.
  void markSnapJobCompleted(input.falRequestId, publicUrl, {
    falCostUsd: Math.round(costUsd * 10000) / 10000, // 0.0001 단위
    phaseTimings: timings,
    pipelineStages: stages,
  });
  return { url: publicUrl };
}
