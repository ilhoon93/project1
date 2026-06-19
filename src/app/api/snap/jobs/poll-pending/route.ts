import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { GPT_IMAGE_MODEL, getFalQueueLogs, getFalQueueStatus } from '@/lib/fal/client';
import { finalizeSnapJob } from '@/lib/snap/finalize';
import { markSnapJobFailed } from '@/lib/snap/jobs';

/**
 * POST /api/snap/jobs/poll-pending
 *
 * 현재 사용자의 'submitted' / 'in_progress' 상태인 snap_jobs 를 일괄 점검한다.
 *
 * - catalog: fal COMPLETED → finalize, FAILED → 환불 마크.
 * - anchor : 서버가 자동 저장(selection)은 하지 않는다(사용자 선택 필요). 하지만
 *   fal 이 **명시적으로 FAILED** 인 멈춘 앵커 잡은 status='failed' 로 마킹해
 *   migration 019 트리거가 유료 분(credit_delta<0)을 자동 환불하게 한다.
 *   또한 **무료 앵커 배치(credit_delta=0)가 결과 없이 실패**했으면 무료 자격
 *   (snap_anchors.free_full_batches_used)을 복구한다.
 *   ※ fal 이 COMPLETED 인데 사용자가 안 고른 후보는 손대지 않는다(정상 소비) —
 *     "맘에 안 들어 재생성" 으로 무한 무료를 얻을 수 없게 하기 위함.
 *
 * 마이페이지/갤러리 진입 시 호출되어 비동기 생성 작업을 자동으로 마무리한다.
 */

const NO_STORE_HEADERS = {
  'cache-control': 'no-store, no-cache, must-revalidate',
} as const;

// 클라이언트의 실시간 폴링과 경합하지 않도록, 제출 후 일정 시간 지난 잡만 처리.
const MIN_AGE_MS = 3 * 60 * 1000; // 3분
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24시간 (그 이전 오래된 잡은 재조회 중단)

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

  // ── 1) catalog: COMPLETED → finalize, FAILED → 환불 ─────────────
  const { data: pending } = await admin
    .from('snap_jobs')
    .select('id, fal_request_id, catalog_id, model')
    .eq('user_id', user.id)
    .eq('kind', 'catalog')
    .in('status', ['submitted', 'in_progress']);

  const results: PollResult[] = await Promise.all(
    (pending ?? []).map(async (job): Promise<PollResult> => {
      let status: string;
      try {
        const s = await getFalQueueStatus(GPT_IMAGE_MODEL, job.fal_request_id);
        status = s.status;
      } catch (e) {
        console.warn('[snap/jobs/poll-pending] fal status err', job.fal_request_id, e);
        return { falRequestId: job.fal_request_id, status: 'still_pending' };
      }

      if (status === 'COMPLETED') {
        try {
          const { url } = await finalizeSnapJob({
            userId: user.id,
            falRequestId: job.fal_request_id,
            catalogId: job.catalog_id ?? null,
          });
          return { falRequestId: job.fal_request_id, status: 'completed', resultUrl: url };
        } catch (e) {
          return {
            falRequestId: job.fal_request_id,
            status: 'finalize_error',
            errorMessage: e instanceof Error ? e.message : 'finalize failed',
          };
        }
      }

      if (status === 'FAILED') {
        // status='failed' 로 전이되면 migration 019 트리거가 자동 환불.
        let detail = 'fal returned FAILED';
        try {
          const logs = await getFalQueueLogs(GPT_IMAGE_MODEL, job.fal_request_id);
          if (logs.length > 0) detail = `${detail} | logs=${logs.slice(-3).join(' | ')}`;
        } catch (e) {
          console.warn('[snap/jobs/poll-pending] logs fetch failed', job.fal_request_id, e);
        }
        void markSnapJobFailed(job.fal_request_id, detail);
        return { falRequestId: job.fal_request_id, status: 'failed', errorMessage: detail };
      }

      if (status === 'IN_PROGRESS') {
        await admin
          .from('snap_jobs')
          .update({ status: 'in_progress' })
          .eq('fal_request_id', job.fal_request_id);
      }
      return { falRequestId: job.fal_request_id, status: 'still_pending' };
    }),
  );

  // ── 2) anchor: 멈춘 잡 중 fal 이 FAILED 인 것만 환불 마킹 ─────────
  const nowMs = Date.now();
  const olderThan = new Date(nowMs - MIN_AGE_MS).toISOString();
  const newerThan = new Date(nowMs - MAX_AGE_MS).toISOString();
  const { data: anchorPending } = await admin
    .from('snap_jobs')
    .select('id, fal_request_id, credit_delta')
    .eq('user_id', user.id)
    .eq('kind', 'anchor')
    .in('status', ['submitted', 'in_progress'])
    .lt('submitted_at', olderThan)
    .gt('submitted_at', newerThan);

  let anchorFailed = 0;
  await Promise.all(
    (anchorPending ?? []).map(async (job) => {
      let status: string;
      try {
        const s = await getFalQueueStatus(GPT_IMAGE_MODEL, job.fal_request_id);
        status = s.status;
      } catch {
        return; // fal 일시 오류 → 다음 기회에.
      }
      if (status === 'FAILED') {
        let detail = 'anchor: fal returned FAILED';
        try {
          const logs = await getFalQueueLogs(GPT_IMAGE_MODEL, job.fal_request_id);
          if (logs.length > 0) detail = `${detail} | logs=${logs.slice(-3).join(' | ')}`;
        } catch {
          /* ignore */
        }
        // status='failed' → 019 트리거가 유료(credit_delta<0)면 자동 환불.
        await markSnapJobFailed(job.fal_request_id, detail);
        anchorFailed += 1;
      } else if (status === 'IN_PROGRESS') {
        await admin
          .from('snap_jobs')
          .update({ status: 'in_progress' })
          .eq('fal_request_id', job.fal_request_id);
      }
      // COMPLETED(안 고른 후보)·IN_QUEUE 등은 손대지 않음.
    }),
  );

  // ── 3) 무료 앵커 배치가 결과 없이 실패했으면 무료 자격 복구 ───────
  //   조건: credit_delta=0(무료) 앵커 잡 중 completed 가 하나도 없고, failed/timeout
  //   이 하나라도 있을 때. fal 이 실제 실패한 경우에만 마킹되므로 어뷰징 불가
  //   ("맘에 안 들어 재생성"은 fal COMPLETED → failed 로 안 가 → 복구 안 됨).
  let freeRestored = false;
  if (anchorFailed > 0) {
    const { data: freeJobs } = await admin
      .from('snap_jobs')
      .select('status')
      .eq('user_id', user.id)
      .eq('kind', 'anchor')
      .eq('credit_delta', 0);
    if (freeJobs && freeJobs.length > 0) {
      const anyCompleted = freeJobs.some((j) => j.status === 'completed');
      const anyFailed = freeJobs.some(
        (j) => j.status === 'failed' || j.status === 'timeout',
      );
      if (!anyCompleted && anyFailed) {
        const { data: restored } = await admin
          .from('snap_anchors')
          .update({ free_full_batches_used: 0 })
          .eq('user_id', user.id)
          .gte('free_full_batches_used', 1)
          .select('user_id');
        freeRestored = !!restored && restored.length > 0;
      }
    }
  }

  return NextResponse.json(
    {
      processed: results.length,
      results,
      anchorFailed,
      freeRestored,
    },
    { headers: NO_STORE_HEADERS },
  );
}
