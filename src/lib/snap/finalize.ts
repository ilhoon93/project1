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

  // 1. fal 결과 URL. 현재는 gpt-image-2 만 사용 (flux-pulid 폐기됨).
  let generatedUrl: string;
  try {
    generatedUrl = await getImageEditResult(input.falRequestId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'result fetch failed';
    void markSnapJobFailed(input.falRequestId, msg);
    throw new Error(`fal result fetch failed: ${msg}`);
  }

  // 2. Phase B face-swap 복원 (SNAP_IDENTITY_MODE=face-swap 일 때만).
  //    카탈로그 결과 + reference 있어야 의미 있음.
  //    - 셀카 모드: selfie URL reference 사용
  //    - 커플 모드: 사용자가 업로드한 커플 사진을 reference 로 사용 (PR 7)
  //    실패 시 generatedUrl 그대로.
  const identityMode = getIdentityMode();
  if (identityMode === 'face-swap' && input.catalogId) {
    const catalog = findSnapCatalog(input.catalogId);
    if (catalog) {
      try {
        if (ctx.catalogPath === 'couple' && ctx.couplePhotoUrl) {
          // 커플 모드: 커플 사진의 두 얼굴을 결과에 입혀 identity 보존.
          generatedUrl = await applyCoupleFaceSwapRestore({
            generatedUrl,
            couplePhotoUrl: ctx.couplePhotoUrl,
          });
        } else if (ctx.groomSelfieUrl || ctx.brideSelfieUrl) {
          // 셀카 / 앵커 모드: 기존 흐름.
          generatedUrl = await applyFaceSwapRestore({
            generatedUrl,
            personality: catalog.personality,
            groomSelfieUrl: ctx.groomSelfieUrl,
            brideSelfieUrl: ctx.brideSelfieUrl,
          });
        }
      } catch (e) {
        console.warn(
          '[finalize] face-swap failed, continuing with original generation',
          input.falRequestId,
          e,
        );
      }
    }
  }

  // 3. 후처리 (카탈로그 결과만). 앵커는 reference 라 비용 / 시간 절약을 위해 skip.
  const mode = getUpscaleMode();
  const isCatalog = !!input.catalogId;
  let imageBuf: Buffer;
  try {
    imageBuf = isCatalog
      ? await applyUpscalePostprocess(generatedUrl, mode, input.catalogId, ctx.catalogPath)
      : await fetchAsBuffer(generatedUrl);
  } catch (e) {
    if (isCatalog) {
      // 후처리 파이프라인 실패 — 원본으로 fallback. 로그만 남기고 흐름 계속.
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

  // 4. public-images 버킷에 영구 호스팅.
  let publicUrl: string;
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

  // 5. snap_jobs 완료 마크.
  void markSnapJobCompleted(input.falRequestId, publicUrl);

  // 6. (옵션) Face similarity 측정 — quality gate / 분석용. 비차단.
  //    reference 선정:
  //      커플 모드 → 사용자 커플 사진
  //      셀카 모드 → groomSelfie (있으면) / brideSelfie
  //    similarity 점수가 임계 미만이면 warn 로깅 (자동 차단/환불 X — 사용자가
  //    이미 결과를 받고 있어 환불 처리가 복잡해짐. 분석용 누적 기록만).
  void (async () => {
    try {
      const ref = pickFaceSimRef(ctx);
      if (!ref) return;
      const score = await compareFaces(ref.url, publicUrl);
      const admin = createAdminClient();
      const update: Record<string, unknown> = { face_similarity_ref: ref.kind };
      // groom-only / together 케이스 단순화: 일단 groom 칼럼에 저장.
      // 추후 fal 응답에서 per-face score 가 가능하면 양쪽 모두 채움.
      update.face_similarity_groom = score;
      await admin
        .from('snap_jobs')
        .update(update as never)
        .eq('fal_request_id', input.falRequestId);
      if (score < FACE_SIM_BAD) {
        console.warn(
          '[finalize] face similarity LOW',
          input.falRequestId,
          score.toFixed(3),
        );
      } else if (score < FACE_SIM_GOOD) {
        console.info(
          '[finalize] face similarity moderate',
          input.falRequestId,
          score.toFixed(3),
        );
      }
    } catch (e) {
      // 비차단. 측정 실패해도 사용자 결과에는 영향 X.
      console.warn('[finalize] face similarity skipped', input.falRequestId, e);
    }
  })();

  return { url: publicUrl };
}

function pickFaceSimRef(ctx: {
  catalogPath: 'anchored' | 'selfies' | 'couple' | null;
  groomSelfieUrl: string | null;
  brideSelfieUrl: string | null;
  couplePhotoUrl: string | null;
}): { url: string; kind: 'selfie' | 'couple_input' | 'anchor' } | null {
  if (ctx.catalogPath === 'couple' && ctx.couplePhotoUrl) {
    return { url: ctx.couplePhotoUrl, kind: 'couple_input' };
  }
  if (ctx.groomSelfieUrl) {
    return { url: ctx.groomSelfieUrl, kind: 'selfie' };
  }
  if (ctx.brideSelfieUrl) {
    return { url: ctx.brideSelfieUrl, kind: 'selfie' };
  }
  return null;
}
