import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { GPT_IMAGE_MODEL, getFalQueueStatus } from '@/lib/fal/client';
import { finalizeSnapJob } from '@/lib/snap/finalize';
import { markSnapJobFailed } from '@/lib/snap/jobs';

/**
 * POST /api/snap/jobs/poll-pending
 *
 * 현재 사용자의 'submitted' / 'in_progress' 상태인 catalog snap_jobs 들을
 * 일괄 점검 — fal status 가 COMPLETED 면 finalize, FAILED 면 환불 + 마크.
 *
 * 마이페이지 진입 시 호출되어 비동기 생성 작업을 자동으로 마무리.
 * anchor 작업은 사용자가 명시적으로 선택해야 하므로 여기서 다루지 않음
 * (catalog 만 자동 finalize).
 */

const NO_STORE_HEADERS = {
  'cache-control': 'no-store, no-cache, must-revalidate',
} as const;

export const maxDuration = 60;

interface PollResult {
  falRequestId: string;
  status: 'completed' | 'failed' | 'still_pending' | 'finalize_error';
  resultUrl?: string;
  errorMessage?: string;
}

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE_HEADERS });

  const admin = createAdminClient();
  const { data: pending } = await admin
    .from('snap_jobs')
    .select('id, fal_request_id, catalog_id, model')
    .eq('user_id', user.id)
    .eq('kind', 'catalog')
    .in('status', ['submitted', 'in_progress']);

  if (!pending || pending.length === 0) {
    return NextResponse.json({ processed: 0, results: [] }, { headers: NO_STORE_HEADERS });
  }

  const results: PollResult[] = await Promise.all(
    pending.map(async (job): Promise<PollResult> => {
      // 1. fal 상태 조회 — 현재는 gpt-image-2 만 사용 (flux-pulid 폐기됨).
      let status: string;
      try {
        const s = await getFalQueueStatus(GPT_IMAGE_MODEL, job.fal_request_id);
        status = s.status;
      } catch (e) {
        // fal 일시 오류 — 상태 그대로 두고 다음 poll 에서 재시도.
        console.warn('[snap/jobs/poll-pending] fal status err', job.fal_request_id, e);
        return { falRequestId: job.fal_request_id, status: 'still_pending' };
      }

      if (status === 'COMPLETED') {
        // 2. finalize 실행.
        try {
          const { url } = await finalizeSnapJob({
            userId: user.id,
            falRequestId: job.fal_request_id,
            catalogId: job.catalog_id ?? null,
          });
          return { falRequestId: job.fal_request_id, status: 'completed', resultUrl: url };
        } catch (e) {
          // finalize 실패. finalizeSnapJob 내부에서 markSnapJobFailed 이미 호출됨.
          return {
            falRequestId: job.fal_request_id,
            status: 'finalize_error',
            errorMessage: e instanceof Error ? e.message : 'finalize failed',
          };
        }
      }

      if (status === 'FAILED') {
        // 3. fal 자체 실패 — 환불 + mark.
        await admin.rpc('refund_snap_credit', {
          p_user_id: user.id,
          p_note: 'catalog generation failed',
          p_ref_id: null,
        });
        void markSnapJobFailed(job.fal_request_id, 'fal returned FAILED');
        return {
          falRequestId: job.fal_request_id,
          status: 'failed',
          errorMessage: 'fal returned FAILED',
        };
      }

      // 4. IN_QUEUE / IN_PROGRESS — 상태 업데이트만.
      if (status === 'IN_PROGRESS') {
        await admin
          .from('snap_jobs')
          .update({ status: 'in_progress' })
          .eq('fal_request_id', job.fal_request_id);
      }
      return { falRequestId: job.fal_request_id, status: 'still_pending' };
    }),
  );

  return NextResponse.json(
    {
      processed: results.length,
      results,
    },
    { headers: NO_STORE_HEADERS },
  );
}
