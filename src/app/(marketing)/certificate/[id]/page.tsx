import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CertificateView } from './certificate-view';

interface PageProps {
  params: { id: string };
}

/**
 * 혼인서약서 페이지 — 마이페이지에서 발행된 알림장에 한해 진입 가능.
 *
 * 본인(소유자) 만 접근 가능하도록 user_id 매칭 + 활성 publication 존재 확인.
 * 활성 publication 의 slug 로 모바일 알림장 URL 을 만들어 QR 코드에 임베드한다.
 */
export default async function CertificatePage({ params }: PageProps) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/mypage');

  const { data: inv } = await supabase
    .from('invitations')
    .select('id, groom_name, bride_name, wedding_date, is_published')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!inv) notFound();

  // 활성 publication 의 slug — 모바일 알림장 URL (QR 코드용).
  const { data: pubs } = await supabase
    .from('publications')
    .select('slug')
    .eq('invitation_id', params.id)
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .order('created_at', { ascending: true })
    .limit(1);

  const slug = pubs?.[0]?.slug ?? null;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? '';
  const invitationUrl = slug ? `${baseUrl}/${slug}` : null;

  return (
    <CertificateView
      groomName={inv.groom_name || '신랑'}
      brideName={inv.bride_name || '신부'}
      weddingDate={inv.wedding_date}
      invitationUrl={invitationUrl}
    />
  );
}

export const metadata = {
  title: '혼인서약서',
};
