/**
 * POST /api/snap/fal-webhook?token=...&kind=catalog|anchor
 *
 * fal.queue.submit 시 동봉한 webhookUrl 로 fal 이 보내는 콜백 수신.
 * 작업 종료 시 즉시 finalize 트리거 → mypage polling 의존도 ↓ + 사용자
 * latency ↓.
 *
 * polling 흐름(/api/snap/jobs/poll-pending) 도 그대로 유지 — webhook 누락
 * (네트워크 일시 단절 등) 케이스의 fallback 안전망.
 *
 * payload 형식 (fal docs 기준):
 *   {
 *     request_id: string,
 *     gateway_request_id: string,
 *     status: 'OK' | 'ERROR',
 *     payload?: { ... }    // 모델 결과 (OK 시) 또는 상세 에러 데이터
 *     error?: string       // ERROR 시 (보통 worker 가 던진 httpx 류 짧은 메시지)
 *   }
 *
 * ERROR 진단:
 *   body.error 한 줄만 저장하면 "Unexpected status code: 422" 같이 추상적인
 *   메시지로 끝나 upstream OpenAI 의 실제 거부 사유 (content moderation /
 *   invalid input 등) 를 못 본다. body 전체 + fal 큐의 로그를 같이 캡처해
 *   snap_jobs.error_message (500자) 안에 압축 직렬화.
 *
 * 보안: query string token (env FAL_WEBHOOK_SECRET) 으로 검증.
 *       token 불일치 → 401 즉시 반환.
 *
 * 멱등성:
 *   - snap_jobs.status 가 이미 'completed' 면 finalize 재호출 안 함.
 *   - finalize 내부에서 storage upload upsert:false 라 같은 path 중복 시 에러
 *     → snap_jobs row 상태로만 멱등성 판단.
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { finalizeSnapJob } from '@/lib/snap/finalize';
import { markSnapJobFailed } from '@/lib/snap/jobs';
import { verifyWebhookSecret } from '@/lib/snap/fal-webhook';
import { getFalQueueLogs } from '@/lib/fal/client';

const NO_STORE_HEADERS = { 'cache-control': 'no-store' } as const;

export const maxDuration = 60;

interface FalWebhookPayload {
  request_id?: string;
  gateway_request_id?: string;
  status?: 'OK' | 'ERROR';
  payload?: unknown;
  error?: string;
}

/**
 * fal worker 가 webhook 으로 돌려준 ERROR 정보를 단일 문자열로 묶는다.
 *
 * 우선순위:
 *   1. body.error (httpx-style 짧은 메시지, 예: "Unexpected status code: 422")
 *   2. body.payload (worker 가 dict 형태로 던진 detail — upstream API body 등)
 *   3. fal queue.status (with logs=true) — worker 의 로그 마지막 몇 줄
 *
 * 셋 다 가능하면 다 합쳐서 직렬화 (500자 제한은 markSnapJobFailed 가 처리).
 */
async function buildErrorMessage(
  body: FalWebhookPayload,
  model: string | null,
  requestId: string,
): Promise<string> {
  const parts: string[] = [];
  if (typeof body.error === 'string' && body.error) {
    parts.push(`error=${body.error}`);
  }
  if (body.payload !== undefined && body.payload !== null) {
    try {
      const serialized = JSON.stringify(body.payload);
      if (serialized && serialized !== '{}' && serialized !== '""') {
        parts.push(`payload=${serialized}`);
      }
    } catch {
      // payload 가 직렬화 불가능한 형태면 그냥 skip.
    }
  }

  // fal 큐 로그 — worker 가 stdout/stderr 로 찍은 마지막 라인이 보통 upstream API
  // 거부 사유를 담고 있다. 모델 id 가 있어야 호출 가능.
  if (model) {
    try {
      const logs = await getFalQueueLogs(model, requestId);
      if (logs.length > 0) {
        // 마지막 3줄만 (error 라인이 보통 끝쪽).
        const tail = logs.slice(-3).join(' | ');
        parts.push(`logs=${tail}`);
      }
    } catch (e) {
      // 큐 status 조회 자체가 실패하면 그냥 무시 — body.error 만으로 진단.
      console.warn('[fal-webhook] status logs fetch failed', requestId, e);
    }
  }

  if (parts.length === 0) return 'fal reported ERROR (no detail)';
  return parts.join(' || ');
}

export async function POST(req: Request) {
  if (!verifyWebhookSecret(req)) {
    return NextResponse.json(
      { error: 'invalid token' },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  let body: FalWebhookPayload;
  try {
    body = (await req.json()) as FalWebhookPayload;
  } catch {
    return NextResponse.json(
      { error: 'invalid json' },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const requestId = body.request_id ?? body.gateway_request_id;
  if (!requestId) {
    return NextResponse.json(
      { error: 'missing request_id' },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  // snap_jobs 행 조회 — kind / catalog_id / user_id / model 결정에 필요.
  const admin = createAdminClient();
  const { data: job } = await admin
    .from('snap_jobs')
    .select('id, kind, user_id, catalog_id, status, model')
    .eq('fal_request_id', requestId)
    .maybeSingle();

  if (!job) {
    // 우리가 트래킹 안 하는 작업 — 무시. fal 에 200 으로 응답해 재시도 안 받게.
    console.warn('[fal-webhook] unknown request_id', requestId);
    return NextResponse.json({ ok: true, ignored: true }, { headers: NO_STORE_HEADERS });
  }

  // 멱등성 — 이미 종료 상태면 재처리 X.
  if (job.status === 'completed' || job.status === 'failed' || job.status === 'timeout') {
    return NextResponse.json({ ok: true, already_settled: job.status }, { headers: NO_STORE_HEADERS });
  }

  if (body.status === 'ERROR') {
    const msg = await buildErrorMessage(
      body,
      (job.model as string | null) ?? null,
      requestId,
    );
    console.error('[fal-webhook] job ERROR', requestId, msg);
    // markSnapJobFailed 가 status='failed' 로 전이 → trigger 자동 환불.
    void markSnapJobFailed(requestId, msg);
    return NextResponse.json({ ok: true, failed: msg }, { headers: NO_STORE_HEADERS });
  }

  // OK 또는 미지정 (보수적으로 OK 처리). catalog 결과는 finalize 로, anchor 는
  // 별도 라우트(/api/snap/anchor) 가 처리하므로 여기선 catalog 만 finalize.
  // anchor 의 경우 클라이언트가 명시적으로 선택 후 저장하는 흐름이라
  // webhook 만 받고 finalize 는 사용자 액션 기다림. 상태만 in_progress → 그대로 둠.
  if (job.kind === 'catalog') {
    try {
      await finalizeSnapJob({
        userId: job.user_id as string,
        falRequestId: requestId,
        catalogId: (job.catalog_id as string | null) ?? null,
      });
      return NextResponse.json({ ok: true, finalized: true }, { headers: NO_STORE_HEADERS });
    } catch (e) {
      console.error('[fal-webhook] finalize failed', requestId, e);
      // finalize 실패 시 markSnapJobFailed 가 내부에서 호출됨 → trigger 환불.
      return NextResponse.json(
        { ok: false, error: e instanceof Error ? e.message : 'finalize failed' },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }
  }

  // anchor 작업 — 사용자가 명시적으로 저장 액션을 해야 finalize 됨.
  // webhook 으로는 상태만 'in_progress' → ready 의미로 표시 가능. 단순화를 위해
  // 그대로 두고 클라이언트가 polling 으로 status 확인하게 함.
  return NextResponse.json({ ok: true, anchor: 'awaiting user save' }, { headers: NO_STORE_HEADERS });
}
