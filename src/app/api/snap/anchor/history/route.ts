import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * /api/snap/anchor/history
 *
 * GET    — 라이브러리(과거 앵커) 목록 반환. 최신 archive 순.
 * DELETE — 라이브러리 한 행 영구 삭제. query `?id=<historyId>`.
 *
 * 라이브러리는 POST /api/snap/anchor 시 기존 완전 앵커를 자동 archive 한 결과.
 * 사용자가 명시적으로 한 행을 지우고 싶을 때 DELETE 호출.
 */

const NO_STORE_HEADERS = {
  'cache-control': 'no-store, no-cache, must-revalidate',
} as const;

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE_HEADERS });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('snap_anchor_history')
    .select(
      'id, groom_anchor_url, bride_anchor_url, source_mode, groom_height_cm, groom_weight_kg, bride_height_cm, bride_weight_kg, anchor_created_at, discarded_at',
    )
    .eq('user_id', user.id)
    .order('discarded_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[snap/anchor/history] fetch error', error);
    return NextResponse.json(
      { error: '폐기 앵커 조회 실패', detail: error.message },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }

  return NextResponse.json({ entries: data ?? [] }, { headers: NO_STORE_HEADERS });
}

export async function DELETE(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE_HEADERS });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) {
    return NextResponse.json(
      { error: 'id query param is required' },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const admin = createAdminClient();
  // user_id 동등 조건을 함께 걸어 RLS 우회 admin 클라이언트로도 소유자 외 행은 못 지움.
  const { error, count } = await admin
    .from('snap_anchor_history')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('[snap/anchor/history DELETE] error', error);
    return NextResponse.json(
      { error: '라이브러리 삭제 실패', detail: error.message },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
  if ((count ?? 0) === 0) {
    return NextResponse.json(
      { error: '해당 항목을 찾을 수 없습니다.' },
      { status: 404, headers: NO_STORE_HEADERS },
    );
  }
  return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
}
