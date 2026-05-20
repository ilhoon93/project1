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
// 출처: fal.ai 모델 페이지 (2025 기준), 가격 변동 가능성 있음.
// gpt-image-2 는 quality 별로 토큰 수가 크게 달라 (low ~272, medium ~1056,
// high ~4160) 단일 평균 대신 quality 별 baseline 으로 분기.
// ─────────────────────────────────────────────────────────────
const GPT_IMAGE_BASELINE_USD: Record<'low' | 'medium' | 'high' | 'auto', number> = {
  low: 0.01,
  medium: 0.04,
  high: 0.13,
  auto: 0.08, // 보수적 — medium 과 high 중간으로 가정
};

function getGptImageBaselineUsd(quality: string | null | undefined): number {
  if (quality === 'low' || quality === 'medium' || quality === 'high' || quality === 'auto') {
    return GPT_IMAGE_BASELINE_USD[quality];
  }
  // 미지정 / 알 수 없는 값은 medium baseline 으로 — 운영 default.
  return GPT_IMAGE_BASELINE_USD.medium;
}

const COST_ESTIMATES_USD = {
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
  quality: string | null;
  groomSelfieUrl: string | null;
  brideSelfieUrl: string | null;
  couplePhotoUrl: string | null;
}> {
  const admin = createAdminClient();
  const { data: job } = await admin
    .from('snap_jobs')
    .select('model, user_id, catalog_id, catalog_path, quality, couple_photo_url')
    .eq('fal_request_id', falRequestId)
    .maybeSingle();
  if (!job) {
    return {
      model: null,
      userId: null,
      catalogId: null,
      catalogPath: null,
      quality: null,
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
    quality: (job.quality as string | null) ?? null,
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
  // row 가 없으면 logSnapJobSubmit 가 못 들어간 케이스 — 모든 컬럼이 NULL 로 끝남.
  // userId 가 null 이면 UPDATE eq('fal_request_id', …) 도 0 row 매치되어 사일런트.
  if (!ctx.userId) {
    console.warn(
      '[finalize] snap_jobs row not found for fal_request_id — downstream UPDATEs will match 0 rows',
      input.falRequestId,
    );
  }

  // 단계별 타이밍 / 실행 stage / 비용 추적. 마지막에 markSnapJobCompleted 로 전달.
  const timings: Record<string, number> = {};
  const stages: Record<string, string | boolean | null> = {};
  // gpt-image-2 generation 비용은 quality 별로 다름 — snap_jobs.quality 기준 분기.
  let costUsd = getGptImageBaselineUsd(ctx.quality);

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
  const storagePath = `wedding-snap/${input.userId}/${input.catalogId ? `${input.catalogId}-` : ''}${Date.now()}.jpg`;
  try {
    const admin = createAdminClient();
    const { error: upErr } = await admin.storage
      .from('public-images')
      .upload(storagePath, imageBuf, { contentType: 'image/jpeg', upsert: false });
    if (upErr) throw upErr;
    publicUrl = admin.storage.from('public-images').getPublicUrl(storagePath).data.publicUrl;
  } catch (e) {
    // supabase StorageError 는 message 만으로는 "Bad Request" 같이 추상적이라
    // statusCode + name + path 도 같이 저장해 디버깅 가능하게 한다.
    const detail = describeStorageError(e, storagePath, imageBuf.byteLength);
    void markSnapJobFailed(input.falRequestId, `storage upload failed: ${detail}`);
    throw new Error(`storage upload failed: ${detail}`);
  }
  timings.storage_upload_ms = Date.now() - t4;

  // 5. snap_jobs 완료 마크 + 비용·타이밍·stages 로그 patch (PR 114).
  void markSnapJobCompleted(input.falRequestId, publicUrl, {
    falCostUsd: Math.round(costUsd * 10000) / 10000, // 0.0001 단위
    phaseTimings: timings,
    pipelineStages: stages,
  });

  // Face similarity 측정은 제거됨 (2026-05) — fal-ai/face-similarity endpoint 가
  // 카탈로그에서 사라져 의존을 끊었음. snap_jobs.face_similarity_* 컬럼도 마이그
  // 027 에서 drop. 대체 솔루션 도입 시점에 새 모듈로 추가 가능.

  return { url: publicUrl };
}

/**
 * supabase storage upload 실패 사유를 사람이 읽을 수 있게 정리.
 *
 * StorageError 는 `name`, `message`, `error`, `statusCode` 속성을 가지는데
 * `e.message` 만 쓰면 "Bad Request" 처럼 추상적이라 RLS 거부 / bucket 누락 /
 * content-type 거부 등 실제 원인 구분이 안 됨. 디버깅에 필요한 메타데이터를
 * 한 줄로 합쳐서 snap_jobs.error_message (500자 제한) 안에 들어가게 한다.
 */
function describeStorageError(
  e: unknown,
  path: string,
  byteLength: number,
): string {
  if (!e || typeof e !== 'object') return 'unknown error';
  const err = e as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof err.statusCode === 'number' || typeof err.statusCode === 'string') {
    parts.push(`status=${err.statusCode}`);
  }
  if (typeof err.name === 'string' && err.name && err.name !== 'StorageApiError') {
    parts.push(`name=${err.name}`);
  }
  if (typeof err.error === 'string' && err.error) {
    parts.push(`error=${err.error}`);
  }
  const message =
    typeof err.message === 'string' ? err.message : 'unknown';
  parts.push(`message=${message}`);
  parts.push(`path=${path}`);
  parts.push(`bytes=${byteLength}`);
  return parts.join(' | ');
}
