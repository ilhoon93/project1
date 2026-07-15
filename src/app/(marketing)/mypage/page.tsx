import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getDisplayEmail } from '@/lib/naver/account';
import { MyPageClient, type MyPageInvitation, type MyPagePublication } from './mypage-client';

export const metadata = {
  title: '마이페이지 — 우리다운',
};

export const dynamic = 'force-dynamic';

export default async function MyPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/mypage');

  // Pull saved invitations + every publication + balances + entitlements.
  const [
    { data: invs },
    { data: pubs },
    { data: balance },
    { data: archiveBalance },
    { data: orders },
    { data: aiSnap },
    { data: aiVideo },
    { data: familyPack },
    { data: snapCreditsBalance },
  ] = await Promise.all([
    // showcase_consent 는 자동생성 DB 타입(063 미반영)에 아직 없어 any 캐스팅.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('invitations') as any)
      .select(
        'id, slug, groom_name, bride_name, wedding_date, is_published, published_at, expires_at, updated_at, created_at, content, showcase_consent',
      )
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false }),
    supabase
      .from('publications')
      .select('id, invitation_id, slug, owner_token, archived, published_at, expires_at, revoked_at')
      .eq('user_id', user.id)
      .order('published_at', { ascending: false }),
    supabase.rpc('publish_credits_balance', { uid: user.id }),
    supabase.rpc('archive_credits_balance', { uid: user.id }),
    supabase
      .from('purchase_orders')
      .select('id, source, package_code, amount, granted_credits, naver_product_order_no, portone_payment_id, status, created_at, raw_data')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase.rpc('user_has_package', { uid: user.id, pkg_code: 'ai_snap' }),
    supabase.rpc('user_has_package', { uid: user.id, pkg_code: 'ai_video' }),
    supabase.rpc('user_has_package', { uid: user.id, pkg_code: 'family_pack' }),
    supabase.rpc('snap_credits_balance', { uid: user.id }),
  ]);

  const pubsByInvitation = new Map<string, MyPagePublication[]>();
  for (const p of pubs ?? []) {
    const arr = pubsByInvitation.get(p.invitation_id) ?? [];
    arr.push(p);
    pubsByInvitation.set(p.invitation_id, arr);
  }

  // content 에서 썸네일 / 레이아웃 / 테마 정보를 안전하게 추출.
  const extractInvitationMeta = (
    content: unknown,
  ): { heroImage: string | null; layout: string | null; colorTheme: string | null } => {
    if (!content || typeof content !== 'object')
      return { heroImage: null, layout: null, colorTheme: null };
    const c = content as Record<string, unknown>;
    const main = c.main as Record<string, unknown> | undefined;
    const theme = c.theme as Record<string, unknown> | undefined;
    return {
      heroImage:
        main && typeof main.heroImage === 'string' && main.heroImage
          ? (main.heroImage as string)
          : null,
      layout: main && typeof main.layout === 'string' ? (main.layout as string) : null,
      colorTheme:
        theme && typeof theme.colorTheme === 'string' ? (theme.colorTheme as string) : null,
    };
  };

  const invitations: MyPageInvitation[] = (invs ?? []).map((i: {
    id: string;
    slug: string;
    groom_name: string;
    bride_name: string;
    wedding_date: string | null;
    is_published: boolean;
    published_at: string | null;
    expires_at: string | null;
    updated_at: string;
    created_at: string;
    content: unknown;
    showcase_consent?: boolean;
  }) => {
    const meta = extractInvitationMeta(i.content);
    return {
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
      heroImage: meta.heroImage,
      layout: meta.layout,
      colorTheme: meta.colorTheme,
      showcaseConsent: i.showcase_consent ?? false,
      publications: pubsByInvitation.get(i.id) ?? [],
    };
  });

  return (
    <MyPageClient
      userEmail={await getDisplayEmail(user.id, user.email ?? null)}
      invitations={invitations}
      creditsBalance={typeof balance === 'number' ? balance : 0}
      archiveBalance={typeof archiveBalance === 'number' ? archiveBalance : 0}
      snapCreditsBalance={typeof snapCreditsBalance === 'number' ? snapCreditsBalance : 0}
      orders={(orders ?? []).map((o) => {
        const rd = (o.raw_data ?? null) as {
          option_label?: string | null;
          granted?: {
            publish?: number;
            archive?: number;
            snap?: number;
            regen?: number;
          };
        } | null;
        return {
          id: o.id,
          source: o.source,
          package_code: o.package_code,
          amount: o.amount,
          granted_credits: o.granted_credits,
          naver_product_order_no: o.naver_product_order_no,
          portone_payment_id: o.portone_payment_id,
          status: o.status,
          created_at: o.created_at,
          optionLabel: rd?.option_label ?? null,
          granted: rd?.granted ?? null,
        };
      })}
      entitlements={{
        aiSnap: !!aiSnap,
        aiVideo: !!aiVideo,
        familyPack: !!familyPack,
      }}
    />
  );
}
