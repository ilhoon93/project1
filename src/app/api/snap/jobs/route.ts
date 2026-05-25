import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/snap/jobs?kind=catalog|anchor&limit=500
 *
 * 현재 사용자의 snap_jobs 목록 반환 — 마이페이지 결과 갤러리용.
 * 가장 최근 순. status='failed' 도 포함 (사용자가 환불/재시도 판단).
 *
 * default limit 500 으로 늘림 — 한 사용자가 수백 장씩 생성하는 케이스에서
 * 오래된 결과가 마이페이지에서 사라져 보이지 않게 되는 문제 fix.
 * max 1000 까지 허용 (response 용량 trade-off — 응답 크기는 수십 KB 수준).
 */

const NO_STORE_HEADERS = {
  'cache-control': 'no-store, no-cache, must-revalidate',
} as const;

export async function GET(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE_HEADERS });

  const url = new URL(req.url);
  const kind = url.searchParams.get('kind');
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 500), 1000);

  const admin = createAdminClient();
  let query = admin
    .from('snap_jobs')
    .select(
      'id, kind, fal_request_id, model, catalog_id, catalog_path, anchor_slot, anchor_framing, status, result_url, credit_delta, error_message, submitted_at, completed_at',
    )
    .eq('user_id', user.id)
    .order('submitted_at', { ascending: false })
    .limit(limit);

  if (kind === 'catalog' || kind === 'anchor') {
    query = query.eq('kind', kind);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[snap/jobs] fetch error', error);
    return NextResponse.json(
      { error: 'Jobs 조회 실패', detail: error.message },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }

  return NextResponse.json({ jobs: data ?? [] }, { headers: NO_STORE_HEADERS });
}
