import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { InvitationContentSchema } from '@/types/invitation';
import { InvitationSlides } from '@/components/invitation/InvitationSlides';

interface PageProps {
  params: { slug: string; token: string };
}

/**
 * 소장용(owner) 뷰 라우트.
 * `/{slug}/o/{owner_token}` — slug + token 둘 다 일치해야만 진입.
 *
 * 진입 시 발행 이후 누적된 데이터(축하하기 카운트, 갤러리 좋아요, 퀴즈/투표 통계,
 * 방명록·서명 메시지) 를 prefetch 해 InvitationSlides 의 owner 모드로 전달한다.
 *
 * 미발행 / 미리보기 단계에서는 데이터가 수집되지 않는다 (각 guest API 가
 * isPreview 분기에서 fetch 를 생략).
 */
export const generateMetadata = async (): Promise<Metadata> => ({
  title: '소장용 알림장 — 우리다운',
  robots: { index: false, follow: false },
});

export default async function OwnerInvitationPage({ params }: PageProps) {
  const supabase = createClient();

  // 발행 row 검증 — slug + owner_token 매치 필수.
  const { data: pub } = await supabase
    .from('publications')
    .select(
      'id, invitation_id, slug, owner_token, groom_name, bride_name, wedding_date, content, expires_at, revoked_at',
    )
    .eq('slug', params.slug)
    .eq('owner_token', params.token)
    .maybeSingle();
  if (!pub || pub.revoked_at) notFound();

  const content = InvitationContentSchema.parse(pub.content ?? {});

  // service-role 로 통계 데이터 prefetch — 익명 owner 페이지에서 RLS 우회 필요.
  const admin = createAdminClient();
  const invitationId = pub.invitation_id;

  const [{ data: cheers }, { data: likes }, { data: quizPicks }, { data: votePicks }, { data: messages }, { data: signatures }] =
    await Promise.all([
      admin
        .from('invitation_cheers')
        .select('cheers_count')
        .eq('invitation_id', invitationId)
        .maybeSingle(),
      admin
        .from('gallery_likes')
        .select('image_index, like_count')
        .eq('invitation_id', invitationId),
      admin
        .from('quiz_responses')
        .select('question_index, selected_option, is_correct')
        .eq('invitation_id', invitationId),
      admin
        .from('vote_responses')
        .select('question_index, selected_option')
        .eq('invitation_id', invitationId),
      admin
        .from('guestbook_messages')
        .select('id, visitor_name, message, created_at')
        .eq('invitation_id', invitationId)
        .order('created_at', { ascending: false }),
      admin
        .from('signatures')
        .select('id, visitor_name, visitor_side, signature_data, created_at')
        .eq('invitation_id', invitationId)
        .order('created_at', { ascending: false }),
    ]);

  const ownerSignatures: OwnerSignature[] = (signatures ?? []).map((s) => ({
    id: s.id as string,
    visitor_name: (s.visitor_name as string | null) ?? null,
    visitor_side: ((s.visitor_side as string | null) ?? null) as 'groom' | 'bride' | null,
    signature_data_url: (s.signature_data as string | null) ?? null,
    created_at: s.created_at as string,
  }));

  const galleryLikes: Record<number, number> = {};
  for (const row of likes ?? []) {
    galleryLikes[row.image_index] = row.like_count;
  }

  return (
    <InvitationSlides
      invitationId={invitationId}
      groomName={pub.groom_name}
      brideName={pub.bride_name}
      weddingDate={pub.wedding_date}
      content={content}
      mode="owner"
      ownerData={{
        cheersCount: cheers?.cheers_count ?? 0,
        galleryLikes,
        quizPicks: (quizPicks ?? []) as OwnerQuizPick[],
        votePicks: (votePicks ?? []) as OwnerVotePick[],
        messages: (messages ?? []) as OwnerMessage[],
        signatures: ownerSignatures,
      }}
    />
  );
}

export interface OwnerQuizPick {
  question_index: number;
  selected_option: number;
  is_correct: boolean;
}
export interface OwnerVotePick {
  question_index: number;
  selected_option: number;
}
export interface OwnerMessage {
  id: string;
  visitor_name: string | null;
  message: string;
  created_at: string;
}
export interface OwnerSignature {
  id: string;
  visitor_name: string | null;
  visitor_side: 'groom' | 'bride' | null;
  signature_data_url: string | null;
  created_at: string;
}
