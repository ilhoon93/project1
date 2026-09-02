import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { InvitationContentSchema, type InvitationContent } from '@/types/invitation';
import { fetchLiveDisplaySettings, applyLiveDisplaySettings } from '@/lib/invitation/live-display';
import { InvitationSlides } from '@/components/invitation/InvitationSlides';
import { InvitationEntryGate } from '@/components/invitation/InvitationEntryGate';
import { FullscreenToggle } from '@/components/invitation/FullscreenToggle';

interface PageProps {
  params: { slug: string; token: string };
}

// 같은 이유로 캐시 우회 — 다른 기기에서 저장한 최신 본이 즉시 반영되도록.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

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

  // 발행 row 검증 — slug + owner_token 매치 필수. archived=true 면 expires_at 무시(영구).
  const { data: pub } = await supabase
    .from('publications')
    .select(
      'id, invitation_id, slug, owner_token, archived, groom_name, bride_name, wedding_date, content, expires_at, revoked_at',
    )
    .eq('slug', params.slug)
    .eq('owner_token', params.token)
    .maybeSingle();
  if (!pub || pub.revoked_at) notFound();
  // 비-영구소장 + 만료 → 404 (하객용은 별도 [slug]/page.tsx 가 처리).
  if (!pub.archived && pub.expires_at && new Date(pub.expires_at) < new Date()) {
    notFound();
  }

  const content = InvitationContentSchema.parse(pub.content ?? {});

  // service-role 로 통계 데이터 prefetch — 익명 owner 페이지에서 RLS 우회 필요.
  const admin = createAdminClient();
  const invitationId = pub.invitation_id;

  // 표시용 설정(갤러리 확대 보기 등)은 재발행 없이 저장 즉시 반영되도록 원본에서 덮어쓴다.
  const live = await fetchLiveDisplaySettings(invitationId);
  applyLiveDisplaySettings(content, live);

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

  return <OwnerView invitationId={invitationId} pub={pub} content={content} showEntryGate={!!live.ownerIsAdmin} cheersCount={cheers?.cheers_count ?? 0} galleryLikes={galleryLikes} quizPicks={(quizPicks ?? []) as OwnerQuizPick[]} votePicks={(votePicks ?? []) as OwnerVotePick[]} messages={(messages ?? []) as OwnerMessage[]} signatures={ownerSignatures} />;
}

/**
 * 소장용 뷰 — 모바일은 풀스크린, 노트북/태블릿(>= md)은 화면 가운데에 9:16 박스로
 * 가둬 보여준다. 큰 모니터에서 가로로 늘어진 알림장이 어색해 보이는 문제 해결.
 * scoped=true 로 InvitationSlides 가 vw/dvh 가 아닌 부모 박스 기준으로 렌더되며
 * 슬라이드 스와이프(터치/마우스 드래그) 도 박스 내부에서 정상 동작.
 */
function OwnerView(props: {
  invitationId: string;
  pub: { groom_name: string; bride_name: string; wedding_date: string | null };
  content: InvitationContent;
  showEntryGate: boolean;
  cheersCount: number;
  galleryLikes: Record<number, number>;
  quizPicks: OwnerQuizPick[];
  votePicks: OwnerVotePick[];
  messages: OwnerMessage[];
  signatures: OwnerSignature[];
}) {
  return (
    <div className="flex min-h-[100dvh] w-full items-center justify-center bg-neutral-950 md:p-6">
      {/* 진입 인트로 — 관리자 계정이 만든 알림장에만(테스트용). 탭이 곧 사용자 제스처가
          되어 배경음악이 입장과 동시에 재생됨. */}
      {props.showEntryGate && (
        <InvitationEntryGate
          groomName={props.pub.groom_name}
          brideName={props.pub.bride_name}
          colorTheme={props.content.theme.colorTheme}
        />
      )}
      <FullscreenToggle />
      <div className="relative h-[100dvh] w-full overflow-hidden bg-black md:h-[min(92dvh,calc(100vw*16/9))] md:max-h-[min(92dvh,900px)] md:w-[min(92vw,calc(92dvh*9/16))] md:max-w-[506px] md:rounded-2xl md:shadow-2xl">
        <InvitationSlides
          invitationId={props.invitationId}
          groomName={props.pub.groom_name}
          brideName={props.pub.bride_name}
          weddingDate={props.pub.wedding_date}
          content={props.content}
          mode="owner"
          scoped
          // 진입 게이트가 있으면 마운트 자동재생 대신 게이트 탭에서만 재생.
          autoplayBgmOnMount={!props.showEntryGate}
          ownerData={{
            cheersCount: props.cheersCount,
            galleryLikes: props.galleryLikes,
            quizPicks: props.quizPicks,
            votePicks: props.votePicks,
            messages: props.messages,
            signatures: props.signatures,
          }}
        />
      </div>
    </div>
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
