import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/me/entitlements
 *
 * 현재 로그인한 사용자가 보유한 패키지 entitlement + 크레딧 잔액을 반환한다.
 * 에디터에서 탭 활성화/비활성화 분기 + 마이페이지 잔액 표시 양쪽에 사용.
 *
 * aiSnap 은 1회 entitlement 모델 시절의 잔재 — snap 크레딧 모델 도입 후엔
 * "legacy 구매자 OR 잔액 > 0" 으로 해석되도록 함께 반환 (UI 가 점진적으로
 * snapCredits 로 이전).
 */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [
    { data: aiSnapLegacy },
    { data: aiVideo },
    { data: familyPack },
    { data: publishCredits },
    { data: archiveCredits },
    { data: snapCredits },
  ] = await Promise.all([
    supabase.rpc('user_has_package', { uid: user.id, pkg_code: 'ai_snap' }),
    supabase.rpc('user_has_package', { uid: user.id, pkg_code: 'ai_video' }),
    supabase.rpc('user_has_package', { uid: user.id, pkg_code: 'family_pack' }),
    supabase.rpc('publish_credits_balance', { uid: user.id }),
    supabase.rpc('archive_credits_balance', { uid: user.id }),
    supabase.rpc('snap_credits_balance', { uid: user.id }),
  ]);

  const snapBalance = typeof snapCredits === 'number' ? snapCredits : 0;

  return NextResponse.json({
    // 신규 사용자도 snap 크레딧 잔액 > 0 이면 "잠금 해제" 로 표시.
    aiSnap: !!aiSnapLegacy || snapBalance > 0,
    aiVideo: !!aiVideo,
    familyPack: !!familyPack,
    publishCredits: typeof publishCredits === 'number' ? publishCredits : 0,
    archiveCredits: typeof archiveCredits === 'number' ? archiveCredits : 0,
    snapCredits: snapBalance,
  });
}
