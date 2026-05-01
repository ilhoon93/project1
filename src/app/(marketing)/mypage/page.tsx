import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MyPageClient, type MyPageInvitation, type MyPagePublication } from './mypage-client';

export const metadata = {
  title: '마이페이지 — 미니멈 웨딩 스튜디오',
};

export const dynamic = 'force-dynamic';

export default async function MyPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/mypage');

  // Pull saved invitations + every publication so we can render
  // "저장 내역" with publish status and remaining days inline.
  const [{ data: invs }, { data: pubs }, { data: balance }, { data: orders }] = await Promise.all([
    supabase
      .from('invitations')
      .select('id, slug, groom_name, bride_name, wedding_date, is_published, published_at, expires_at, updated_at, created_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false }),
    supabase
      .from('publications')
      .select('id, invitation_id, slug, published_at, expires_at, revoked_at')
      .eq('user_id', user.id)
      .order('published_at', { ascending: false }),
    supabase.rpc('publish_credits_balance', { uid: user.id }),
    supabase
      .from('purchase_orders')
      .select('id, source, package_code, amount, granted_credits, naver_product_order_no, portone_payment_id, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ]);

  const pubsByInvitation = new Map<string, MyPagePublication[]>();
  for (const p of pubs ?? []) {
    const arr = pubsByInvitation.get(p.invitation_id) ?? [];
    arr.push(p);
    pubsByInvitation.set(p.invitation_id, arr);
  }

  const invitations: MyPageInvitation[] = (invs ?? []).map((i) => ({
    id: i.id,
    slug: i.slug,
    groomName: i.groom_name,
    brideName: i.bride_name,
    weddingDate: i.wedding_date,
    isPublished: i.is_published,
    publishedAt: i.published_at,
    expiresAt: i.expires_at,
    updatedAt: i.updated_at,
    createdAt: i.created_at,
    publications: pubsByInvitation.get(i.id) ?? [],
  }));

  return (
    <MyPageClient
      userEmail={user.email ?? null}
      userName={
        user.user_metadata?.name ??
        user.user_metadata?.preferred_username ??
        user.user_metadata?.nickname ??
        null
      }
      invitations={invitations}
      creditsBalance={typeof balance === 'number' ? balance : 0}
      orders={orders ?? []}
    />
  );
}
