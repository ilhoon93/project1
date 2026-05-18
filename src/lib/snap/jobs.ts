/**
 * snap_jobs 로깅 헬퍼.
 *
 * 모든 fal 큐 제출 / finalize 결과를 우리 DB 에 기록한다. fal 대시보드 표시
 * 여부와 무관하게 자체 감사 추적 / 디버깅 / 마이페이지 히스토리 재료.
 *
 * 사용 패턴:
 *   1. submit 직후 logSnapJobSubmit() 호출 → row insert (status='submitted')
 *   2. finalize 또는 anchor 저장 시 markSnapJobCompleted(falRequestId, resultUrl)
 *   3. 제출 실패 / 처리 실패 시 markSnapJobFailed(falRequestId, message)
 *
 * 호출 측이 admin client 를 받지 않고 함수가 직접 만든다 (호출 코드 간단화).
 * 로깅 실패는 silently catch — 본 처리 흐름이 멈추면 안 됨.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/types/database';

type SnapJobInsert = Database['public']['Tables']['snap_jobs']['Insert'];
type SnapJobUpdate = Database['public']['Tables']['snap_jobs']['Update'];

export interface SnapJobLogInput {
  userId: string;
  kind: 'anchor' | 'catalog';
  falRequestId: string;
  model: string;
  quality?: string | null;
  catalogId?: string | null;
  catalogPath?: 'anchored' | 'selfies' | 'couple' | null;
  anchorSlot?: 'groom' | 'bride' | null;
  anchorFraming?: 'closeup' | 'halfbody' | null;
  /** 차감/적립된 크레딧 (catalog -1, anchor 0 또는 -4) */
  creditDelta?: number;
  /** 입력 사진 검증 메타 — input-validation.ts 의 ImageValidationResult.meta 에서. */
  inputFaceCount?: number | null;
  inputFaceMinSize?: number | null;
  inputAvgLuminance?: number | null;
}

/** submit 직후 호출 — 행 insert. 실패는 로그만 남기고 throw 안 함. */
export async function logSnapJobSubmit(input: SnapJobLogInput): Promise<void> {
  const admin = createAdminClient();
  const payload: SnapJobInsert = {
    user_id: input.userId,
    kind: input.kind,
    fal_request_id: input.falRequestId,
    model: input.model,
    quality: input.quality ?? null,
    catalog_id: input.catalogId ?? null,
    catalog_path: input.catalogPath ?? null,
    anchor_slot: input.anchorSlot ?? null,
    anchor_framing: input.anchorFraming ?? null,
    status: 'submitted',
    credit_delta: input.creditDelta ?? 0,
    input_face_count: input.inputFaceCount ?? null,
    input_face_min_size: input.inputFaceMinSize ?? null,
    input_avg_luminance: input.inputAvgLuminance ?? null,
  };
  const { error } = await admin.from('snap_jobs').insert(payload);
  if (error) {
    console.warn('[snap_jobs] insert failed', { falRequestId: input.falRequestId }, error);
  }
}

/**
 * 단계별 비용·타이밍·실행 stage 갱신 API.
 *
 * finalize 흐름에서 각 단계(harmonize/finishing/upscale 등) 종료 후 호출해
 * snap_jobs 의 fal_cost_usd / phase_timings / pipeline_stages 를 patch.
 * 일부 단계만 채워도 됨 (병합은 application 측에서 — JSONB merge 가 아닌 replace).
 *
 * 실패 시 로그만 — 본 흐름 영향 없음.
 */
export interface SnapJobPostprocessLog {
  falCostUsd?: number | null;
  phaseTimings?: Record<string, number> | null;
  pipelineStages?: Record<string, string | boolean | null> | null;
}

export async function patchSnapJobLogs(
  falRequestId: string,
  patch: SnapJobPostprocessLog,
): Promise<void> {
  const update: SnapJobUpdate = {};
  if (patch.falCostUsd !== undefined) update.fal_cost_usd = patch.falCostUsd;
  if (patch.phaseTimings !== undefined) update.phase_timings = patch.phaseTimings;
  if (patch.pipelineStages !== undefined) update.pipeline_stages = patch.pipelineStages;
  if (Object.keys(update).length === 0) return;

  const admin = createAdminClient();
  const { error } = await admin
    .from('snap_jobs')
    .update(update)
    .eq('fal_request_id', falRequestId);
  if (error) {
    console.warn('[snap_jobs] logs patch failed', { falRequestId }, error);
  }
}

export async function markSnapJobCompleted(
  falRequestId: string,
  resultUrl: string,
  logs?: SnapJobPostprocessLog,
): Promise<void> {
  const admin = createAdminClient();
  const update: SnapJobUpdate = {
    status: 'completed',
    result_url: resultUrl,
    completed_at: new Date().toISOString(),
  };
  if (logs?.falCostUsd !== undefined) update.fal_cost_usd = logs.falCostUsd;
  if (logs?.phaseTimings !== undefined) update.phase_timings = logs.phaseTimings;
  if (logs?.pipelineStages !== undefined) update.pipeline_stages = logs.pipelineStages;

  const { error } = await admin
    .from('snap_jobs')
    .update(update)
    .eq('fal_request_id', falRequestId);
  if (error) {
    console.warn('[snap_jobs] complete update failed', { falRequestId }, error);
  }
}

export async function markSnapJobFailed(
  falRequestId: string,
  errorMessage: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('snap_jobs')
    .update({
      status: 'failed',
      error_message: errorMessage.slice(0, 500),
      completed_at: new Date().toISOString(),
    })
    .eq('fal_request_id', falRequestId);
  if (error) {
    console.warn('[snap_jobs] fail update failed', { falRequestId }, error);
  }
}
