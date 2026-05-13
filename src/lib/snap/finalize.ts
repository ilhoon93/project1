/**
 * snap_jobs finalize 헬퍼.
 *
 * fal CDN URL → (옵션) 후처리 업스케일 + sharpen → public-images 영구 호스팅 → snap_jobs 갱신.
 *
 * /api/snap/finalize (단일, 사용자가 페이지에 머무를 때) 와
 * /api/snap/jobs/poll-pending (배치, mypage 진입 시 일괄 finalize) 양쪽에서
 * 동일한 로직을 공유하기 위해 추출.
 *
 * 후처리는 카탈로그 결과 (catalogId 있음) 에만 적용. 앵커는 reference 이므로 skip.
 * 모드는 SNAP_UPSCALE_MODE env 로 토글 ('off' | 'aura-sharpen' | 'topaz-sharpen').
 * 후처리 어느 단계라도 실패하면 원본으로 fallback — finalize 자체는 안 깨짐.
 */

import { getImageEditResult } from '@/lib/fal/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { markSnapJobCompleted, markSnapJobFailed } from '@/lib/snap/jobs';
import {
  applyUpscalePostprocess,
  fetchAsBuffer,
  getUpscaleMode,
} from '@/lib/snap/postprocess';

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
 * 한 작업을 finalize. fal 에서 result 가져와 (옵션) 후처리 후 public-images
 * 에 업로드, snap_jobs 행을 completed 로 마크.
 *
 * 실패 시 markSnapJobFailed 호출 후 throw — 호출 측이 응답 결정.
 */
export async function finalizeSnapJob(input: FinalizeInput): Promise<FinalizeOutput> {
  // 1. fal 결과 URL 가져오기.
  let generatedUrl: string;
  try {
    generatedUrl = await getImageEditResult(input.falRequestId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'result fetch failed';
    void markSnapJobFailed(input.falRequestId, msg);
    throw new Error(`fal result fetch failed: ${msg}`);
  }

  // 2. 후처리 (카탈로그 결과만). 앵커는 reference 라 비용 / 시간 절약을 위해 skip.
  //    어느 단계라도 실패하면 원본으로 fallback — 후처리 실패가 finalize 를 깨뜨리지 않음.
  const mode = getUpscaleMode();
  const shouldPostprocess = mode !== 'off' && !!input.catalogId;
  let imageBuf: Buffer;
  try {
    imageBuf = shouldPostprocess
      ? await applyUpscalePostprocess(generatedUrl, mode)
      : await fetchAsBuffer(generatedUrl);
  } catch (e) {
    if (shouldPostprocess) {
      // 후처리 실패 — 원본으로 fallback. 로그만 남기고 흐름 계속.
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

  // 3. public-images 버킷에 영구 호스팅.
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

  // 4. snap_jobs 완료 마크.
  void markSnapJobCompleted(input.falRequestId, publicUrl);
  return { url: publicUrl };
}
