import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteStoragePrefix } from '@/lib/storage/delete-prefix';

/**
 * POST /api/account/withdraw
 *
 * 회원 탈퇴(익명화 방식). 개인정보/개인 콘텐츠는 전부 파기하고, 전자상거래법상
 * 보존 의무가 있는 결제·거래 기록만 개인 식별 불가능한 형태로 보존한다.
 *
 * 순서(개인정보 파기 전에 스토리지·결제기록을 먼저 처리):
 *   1. 개인 콘텐츠 스토리지 파기 — invitations/{id}/…, wedding-snap/{userId}/…
 *      (public-images / private-uploads 두 버킷). DB row 삭제 전에 id 가 필요.
 *   2. withdraw_user RPC — purchase_orders 의 비개인정보 거래 필드만 익명 보존.
 *   3. auth.users hard-delete — 모든 개인 테이블이 on delete cascade 로 함께 삭제
 *      (naver_accounts·profiles·invitations+하객데이터·snap·크레딧·quota·주문 등).
 *   4. 현재 세션 로그아웃.
 *
 * 되돌릴 수 없다. UI 에서 강한 확인 후에만 호출한다.
 */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  // 1) 개인 콘텐츠 스토리지 파기 (best-effort). 유저 삭제(cascade)로도 DB row 는
  //    지워지지만, Supabase Storage 객체는 cascade 대상이 아니라 직접 지워야 한다.
  const { data: invs } = await admin
    .from('invitations')
    .select('id')
    .eq('user_id', user.id);
  for (const inv of (invs ?? []) as { id: string }[]) {
    await deleteStoragePrefix(admin.storage, 'public-images', `invitations/${inv.id}`);
  }
  // 스냅 결과/앵커/전처리 입력은 모두 wedding-snap/{userId}/ 하위에 있다(양 버킷).
  await deleteStoragePrefix(admin.storage, 'public-images', `wedding-snap/${user.id}`);
  await deleteStoragePrefix(admin.storage, 'private-uploads', `wedding-snap/${user.id}`);

  // 2) 법령상 보존 대상(결제·거래 기록)만 익명화하여 보존. (auth 유저 삭제 시
  //    purchase_orders 도 cascade 삭제되므로 반드시 그 전에 복사해 둔다.)
  // withdraw_user 는 자동생성 DB 타입에 아직 없어 캐스팅.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: retainErr } = await (admin as any).rpc('withdraw_user', {
    p_user_id: user.id,
  });
  if (retainErr) {
    console.error('[account/withdraw] retain failed', retainErr);
    return NextResponse.json(
      { error: '탈퇴 처리 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.' },
      { status: 500 },
    );
  }

  // 3) auth 유저 hard-delete → 개인 데이터 전부 cascade 삭제.
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) {
    console.error('[account/withdraw] deleteUser failed', delErr);
    return NextResponse.json(
      { error: '탈퇴 처리 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.' },
      { status: 500 },
    );
  }

  // 4) 현재 세션 로그아웃 (쿠키 정리).
  await supabase.auth.signOut();

  return NextResponse.json({ success: true });
}
