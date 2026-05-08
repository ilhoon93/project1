import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/me/entitlements
 *
 * 현재 로그인한 사용자가 보유한 패키지 entitlement 를 반환한다.
 * 에디터에서 탭 활성화/비활성화 분기에 사용.
 */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [{ data: aiSnap }, { data: aiVideo }, { data: familyPack }, { data: publishCredits }, { data: archiveCredits }] =
    await Promise.all([
      supabase.rpc('user_has_package', { uid: user.id, pkg_code: 'ai_snap' }),
      supabase.rpc('user_has_package', { uid: user.id, pkg_code: 'ai_video' }),
      supabase.rpc('user_has_package', { uid: user.id, pkg_code: 'family_pack' }),
      supabase.rpc('publish_credits_balance', { uid: user.id }),
      supabase.rpc('archive_credits_balance', { uid: user.id }),
    ]);

  return NextResponse.json({
    aiSnap: !!aiSnap,
    aiVideo: !!aiVideo,
    familyPack: !!familyPack,
    publishCredits: typeof publishCredits === 'number' ? publishCredits : 0,
    archiveCredits: typeof archiveCredits === 'number' ? archiveCredits : 0,
  });
}
