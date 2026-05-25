import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { POST as generatePOST } from '@/app/api/snap/generate/route';

/**
 * POST /api/snap/jobs/[id]/regenerate
 *
 * 마이페이지 결과 카드의 "재생성" 액션. 같은 catalog 를 다시 만들되 사용자가
 * 선택한 합성 방식(기본 / 얼굴 강화) 으로.
 *
 * body: { reason: 'face_unnatural' | 'pose_diff' | 'outfit_bg' | 'other',
 *         mode:   'strict' | 'prompt-only',
 *         reasonText?: string }
 *
 * ── 무료 재생성 quota 정책 (032 마이그) ──
 *  결과당 무료 1회가 아닌, 사용자 단위 패키지별 누적 quota.
 *    snap_5 → +1, snap_20 → +4, snap_40 → +8 (대략 결제 크레딧의 20%)
 *  consume_free_regen RPC 가 row-level lock 으로 안전하게 차감.
 *  잔량 > 0 이면 generate 가 차감한 1 크레딧을 refund (net 0).
 *  잔량 0 이면 1 크레딧 그대로 차감.
 *
 * ── 동작 ──
 *  1. 원본 job 조회 + 권한 확인.
 *  2. reason === 'other' 면 reasonText 필수 (1자 이상, trim 후).
 *  3. /api/snap/generate 를 같은 process 에서 호출해 새 job 생성
 *     (anchor 모드는 'current' 앵커 사용 — 사용자가 마이페이지에서 재생성하는
 *     케이스이므로 활성 앵커 그대로 적용).
 *     커플 모드는 원본 couple_photo_url 을 다시 사용.
 *  4. 무료 quota 잔량 차감 시도. 성공이면 1 크레딧 refund. 실패면 그대로 진행.
 *  5. 원본 job 의 regen_to_job_id, regen_reason, regen_reason_text 갱신.
 *
 * 응답: { jobId, requestId, balance, freeUsed, freeRemaining }
 *
 * 한계:
 *   - 커플 모드 재생성은 원본 couple_photo_url 이 만료됐을 수 있음. 그 경우는
 *     generate 가 fal 호출 단계에서 실패. 사용자가 새로 생성 페이지 가서 재시도.
 *   - 셀카 모드는 활성 앵커 사용. 원본 생성 시 사용했던 라이브러리 앵커 id 까지
 *     기억하진 않음 (snap_jobs 에 anchor_id 컬럼 없음).
 */

const Body = z.object({
  reason: z.enum(['face_unnatural', 'pose_diff', 'outfit_bg', 'other']),
  mode: z.enum(['strict', 'prompt-only']),
  reasonText: z.string().trim().max(500).optional(),
});

export async function POST(
  req: Request,
  ctx: { params: { id: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // body 검증.
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', issues: e.issues },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // 'other' 이유일 때는 텍스트 필수.
  if (body.reason === 'other') {
    const text = body.reasonText?.trim() ?? '';
    if (text.length === 0) {
      return NextResponse.json(
        { error: '기타 이유는 직접 입력해주세요' },
        { status: 400 },
      );
    }
  }

  const jobId = ctx.params.id;
  if (!jobId) {
    return NextResponse.json({ error: 'job id required' }, { status: 400 });
  }

  const admin = createAdminClient();

  // 1. 원본 job 조회 + 권한.
  const { data: originalJob, error: selectErr } = await admin
    .from('snap_jobs')
    .select(
      'id, user_id, kind, catalog_id, catalog_path, couple_photo_url, status',
    )
    .eq('id', jobId)
    .single();

  if (selectErr || !originalJob) {
    return NextResponse.json({ error: 'job not found' }, { status: 404 });
  }
  if (originalJob.user_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (originalJob.kind !== 'catalog' || !originalJob.catalog_id) {
    return NextResponse.json(
      { error: '이 작업은 재생성할 수 없습니다 (catalog 작업이 아니거나 catalog id 없음)' },
      { status: 400 },
    );
  }
  if (originalJob.status !== 'completed' && originalJob.status !== 'failed') {
    return NextResponse.json(
      { error: '진행 중인 작업은 재생성할 수 없습니다' },
      { status: 400 },
    );
  }

  // 2. generate route 를 같은 process 에서 호출. 새 Request 객체 + cookie 전달.
  const generatePayload: Record<string, unknown> = {
    catalogId: originalJob.catalog_id,
    imageReference: body.mode,
  };
  if (originalJob.catalog_path === 'couple') {
    if (!originalJob.couple_photo_url) {
      return NextResponse.json(
        {
          error:
            '원본 커플 사진이 만료됐어요. 카탈로그 페이지에서 새 사진으로 다시 만들어주세요',
        },
        { status: 400 },
      );
    }
    generatePayload.mode = 'couple';
    generatePayload.couplePhotoUrl = originalJob.couple_photo_url;
  } else {
    // anchor / selfies — 활성 앵커 사용 ('current').
    generatePayload.mode = 'anchor';
    generatePayload.groomAnchorId = 'current';
    generatePayload.brideAnchorId = 'current';
  }

  const fakeReq = new Request(req.url.replace(/\/jobs\/.*\/regenerate/, '/generate'), {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify(generatePayload),
  });

  const generateResp = await generatePOST(fakeReq);
  if (!generateResp.ok) {
    // generate 에러를 그대로 전달. (insufficient_credits 등.)
    const errBody = await generateResp.json().catch(() => ({}));
    return NextResponse.json(errBody, { status: generateResp.status });
  }
  const generateData = (await generateResp.json()) as {
    requestId: string;
    balance?: number;
  };

  // 3. 새 snap_jobs row 찾기 (fal_request_id 로 lookup).
  const { data: newJob, error: newJobErr } = await admin
    .from('snap_jobs')
    .select('id')
    .eq('fal_request_id', generateData.requestId)
    .single();
  if (newJobErr || !newJob) {
    // generate 는 성공했지만 lookup 실패 — 매우 드문 케이스. 클라이언트엔 성공
    // 응답 보내되 regen_to_job_id linking 은 skip.
    console.error('[snap/regenerate] new job lookup failed', newJobErr);
    return NextResponse.json({
      jobId: null,
      requestId: generateData.requestId,
      balance: generateData.balance,
      freeUsed: false,
      freeRemaining: null,
    });
  }

  // 4. 무료 quota 차감 시도. 성공이면 1 크레딧 refund (net 0).
  let finalBalance = generateData.balance ?? null;
  let freeUsed = false;
  let freeRemaining: number | null = null;

  const { data: consumeData, error: consumeErr } = await admin.rpc(
    'consume_free_regen',
    { p_user_id: user.id, p_amount: 1 },
  );
  if (consumeErr) {
    console.error('[snap/regenerate] consume_free_regen failed', consumeErr);
  } else {
    const r = consumeData as { consumed?: boolean; remaining?: number } | null;
    if (r && r.consumed === true) {
      freeUsed = true;
      freeRemaining = typeof r.remaining === 'number' ? r.remaining : null;

      // 1 크레딧 refund — refund_snap_credit 은 always +1.
      const { error: refundErr } = await admin.rpc(
        'refund_snap_credit',
        {
          p_user_id: user.id,
          p_note: `regen-free ${originalJob.id}`,
          p_ref_id: originalJob.id,
        },
      );
      if (refundErr) {
        console.error('[snap/regenerate] refund failed', refundErr);
        // refund 실패해도 quota 는 이미 차감됨 — 다음 회차에서 사용자가 손해.
        // 운영팀이 로그 보고 수동 보정 (드문 케이스).
      } else {
        // refund 1 = balance + 1.
        if (finalBalance !== null) finalBalance += 1;
      }
    } else if (r) {
      freeRemaining = typeof r.remaining === 'number' ? r.remaining : 0;
    }
  }

  // 5. 원본 job 의 regen_* 컬럼 업데이트.
  const parentUpdate: {
    regen_to_job_id: string;
    regen_reason: 'face_unnatural' | 'pose_diff' | 'outfit_bg' | 'other';
    regen_reason_text?: string;
  } = {
    regen_to_job_id: newJob.id,
    regen_reason: body.reason,
  };
  if (body.reason === 'other' && body.reasonText) {
    parentUpdate.regen_reason_text = body.reasonText.trim();
  }
  const { error: linkErr } = await admin
    .from('snap_jobs')
    .update(parentUpdate)
    .eq('id', jobId);
  if (linkErr) {
    console.error('[snap/regenerate] parent link update failed', linkErr);
    // chain link 실패해도 새 job 은 정상 작동.
  }

  return NextResponse.json({
    jobId: newJob.id,
    requestId: generateData.requestId,
    balance: finalBalance,
    freeUsed,
    freeRemaining,
  });
}
