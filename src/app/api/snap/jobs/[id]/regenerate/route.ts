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
 *         mode:   'strict' | 'prompt-only' }
 *
 * 동작:
 *   1. 원본 job 조회 + 권한 확인.
 *   2. 한 카탈로그 결과당 처음 재생성은 무료 (regen_used_free=false 면 1회).
 *   3. /api/snap/generate 를 같은 process 에서 호출해 새 job 생성
 *      (anchor 모드는 'current' 앵커 사용 — 사용자가 마이페이지에서 재생성하는
 *      케이스이므로 활성 앵커 그대로 적용).
 *      커플 모드는 원본 couple_photo_url 을 다시 사용.
 *   4. 무료 회차였다면 refund_snap_credit RPC 로 1 크레딧 환불 (net 0).
 *   5. 원본 job 의 regen_to_job_id, regen_reason, regen_used_free 갱신.
 *
 * 응답: { jobId: string (new), liked: false, balance: number, freeUsed: boolean }
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

  const jobId = ctx.params.id;
  if (!jobId) {
    return NextResponse.json({ error: 'job id required' }, { status: 400 });
  }

  const admin = createAdminClient();

  // 1. 원본 job 조회 + 권한 + 무료 사용 여부.
  const { data: originalJob, error: selectErr } = await admin
    .from('snap_jobs')
    .select(
      'id, user_id, kind, catalog_id, catalog_path, couple_photo_url, regen_used_free, status',
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

  const freeAvailable = !originalJob.regen_used_free;

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
    });
  }

  // 4. 무료 회차였다면 refund 1 크레딧 (generate 가 -1 차감했으므로 net 0).
  let finalBalance = generateData.balance ?? null;
  if (freeAvailable) {
    const { data: refundData, error: refundErr } = await admin.rpc(
      'refund_snap_credit',
      {
        p_user_id: user.id,
        p_amount: 1,
        p_note: `regen-free ${originalJob.id}`,
      } as never,
    );
    if (refundErr) {
      // refund 실패해도 생성 자체는 성공 — 로그만 남기고 사용자에겐 정상 응답.
      // (다음 PR 에서 admin 알람 / 자동 retry 가능.)
      console.error('[snap/regenerate] refund failed', refundErr);
    } else {
      // RPC return 타입이 환경별로 void 또는 jsonb 라 unknown cast 후 안전하게 추출.
      const r = refundData as { balance?: number } | null | undefined;
      if (r && typeof r.balance === 'number') {
        finalBalance = r.balance;
      }
    }
  }

  // 5. 원본 job 의 regen_* 컬럼 업데이트.
  const { error: linkErr } = await admin
    .from('snap_jobs')
    .update({
      regen_to_job_id: newJob.id,
      regen_reason: body.reason,
      regen_used_free: true,
    })
    .eq('id', jobId);
  if (linkErr) {
    console.error('[snap/regenerate] parent link update failed', linkErr);
    // chain link 실패해도 새 job 은 정상 작동.
  }

  return NextResponse.json({
    jobId: newJob.id,
    requestId: generateData.requestId,
    balance: finalBalance,
    freeUsed: freeAvailable,
  });
}
