import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/snap/anchor/history
 *
 * 폐기된 앵커 목록 반환 — 마이페이지에서 모아 보기.
 * 최신 폐기 순.
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
