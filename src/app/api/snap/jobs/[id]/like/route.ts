import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/snap/jobs/[id]/like
 *
 * 마이페이지 결과 카드의 좋아요 토글. 요청 body 없음 — 현재 liked 의 반대로 토글.
 * 응답: { liked: boolean }
 *
 * 권한: 본인 user_id 의 job 만. RLS 가 막아주지만 server 에서도 한 번 더 확인.
 */
export async function POST(
  _req: Request,
  ctx: { params: { id: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const jobId = ctx.params.id;
  if (!jobId) {
    return NextResponse.json({ error: 'job id required' }, { status: 400 });
  }

  const admin = createAdminClient();

  // 현재 상태 조회 — 본인 job 인지 확인 + liked 반전.
  const { data: existing, error: selectErr } = await admin
    .from('snap_jobs')
    .select('id, user_id, liked')
    .eq('id', jobId)
    .single();

  if (selectErr || !existing) {
    return NextResponse.json({ error: 'job not found' }, { status: 404 });
  }
  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const nextLiked = !existing.liked;
  const { error: updateErr } = await admin
    .from('snap_jobs')
    .update({
      liked: nextLiked,
      liked_at: nextLiked ? new Date().toISOString() : null,
    })
    .eq('id', jobId);

  if (updateErr) {
    return NextResponse.json(
      { error: 'update failed', detail: updateErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ liked: nextLiked });
}
