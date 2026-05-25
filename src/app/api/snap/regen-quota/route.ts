import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/snap/regen-quota
 *
 * 현재 사용자의 무료 재생성 quota 잔량 조회. 마이페이지의 재생성 모달이 "무료 N회
 * 남음" / "1 크레딧" 라벨을 그리기 위해 호출.
 *
 * 응답: { freeRemaining: number, totalGranted: number }
 *   - row 가 없으면 freeRemaining=0, totalGranted=0 으로 반환.
 *
 * 032 마이그에서 도입된 snap_user_quota 테이블을 그대로 읽어온다. 사용자 본인
 * 행만 RLS 로 select 허용되어 있어 admin client 가 아닌 server client 로도 가능
 * 하지만 일관성을 위해 admin 으로 조회 (다른 마이페이지 endpoint 와 동일).
 */

const NO_STORE_HEADERS = {
  'cache-control': 'no-store, no-cache, must-revalidate',
} as const;

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('snap_user_quota')
    .select('free_regen_remaining, total_granted')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[snap/regen-quota] fetch error', error);
    return NextResponse.json(
      { error: 'quota 조회 실패', detail: error.message },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }

  return NextResponse.json(
    {
      freeRemaining: data?.free_regen_remaining ?? 0,
      totalGranted: data?.total_granted ?? 0,
    },
    { headers: NO_STORE_HEADERS },
  );
}
