import type { ReactNode } from 'react';
import type { InvitationContent } from '@/types/invitation';
import { reconcilePageOrder, type SectionKey } from '@/lib/theme';
import { SlideContainer } from './SlideContainer';
import { VisitTracker } from './VisitTracker';
import { MainSlide } from './slides/MainSlide';
import { BasicInfoSlide } from './slides/BasicInfoSlide';
import { StorySlide } from './slides/StorySlide';
import { GallerySlide } from './slides/GallerySlide';
import { VideoSlide } from './slides/VideoSlide';
import { QuizSlide } from './slides/QuizSlide';
import { VoteSlide } from './slides/VoteSlide';
import { GuestbookSlide } from './slides/GuestbookSlide';
import { AccountSlide } from './slides/AccountSlide';
import { ClosingSlide } from './slides/ClosingSlide';

export interface OwnerData {
  cheersCount: number;
  galleryLikes: Record<number, number>;
  quizPicks: { question_index: number; selected_option: number; is_correct: boolean }[];
  votePicks: { question_index: number; selected_option: number }[];
  messages: { id: string; visitor_name: string | null; message: string; created_at: string }[];
  signatures: {
    id: string;
    visitor_name: string | null;
    visitor_side: 'groom' | 'bride' | null;
    signature_data_url: string | null;
    created_at: string;
  }[];
}

interface Props {
  invitationId: string;
  groomName: string;
  brideName: string;
  weddingDate: string | null;
  content: InvitationContent;
  isPreview?: boolean;
  /**
   * scoped: 부모 박스 안에서만 렌더(viewport 단위 미사용). 데스크톱 에디터의
   * 좌측 미리보기 패널처럼 화면 일부에 띄울 때 사용.
   */
  scoped?: boolean;
  /** owner 모드 — 신랑신부 전용 소장용 뷰. quiz/vote 통계, 방명록·서명 모음 표시. */
  mode?: 'guest' | 'owner';
  ownerData?: OwnerData;
}

export function InvitationSlides({
  invitationId,
  groomName,
  brideName,
  weddingDate,
  content,
  isPreview,
  scoped,
  mode = 'guest',
  ownerData,
}: Props) {
  const storyHasContent = content.story.chapters.some(
    (c) => c.title.trim() || c.text.trim() || c.image,
  );
  const quizHasPlayable = content.quiz.questions.some(
    (q) => q.q.trim() && q.options.every((opt) => opt.trim()),
  );
  const voteHasPlayable = content.vote.questions.some(
    (q) => q.q.trim() && q.options.every((opt) => opt.trim()),
  );

  const slidesByKey: Record<SectionKey, ReactNode | null> = {
    main: (
      <MainSlide
        invitationId={invitationId}
        groomName={groomName}
        brideName={brideName}
        weddingDate={weddingDate}
        main={content.main}
        isPreview={isPreview}
        scoped={scoped}
        mode={mode}
        cheersCount={ownerData?.cheersCount ?? 0}
      />
    ),
    basic: content.basic.enabled ? (
      <BasicInfoSlide
        basic={content.basic}
        groomName={groomName}
        brideName={brideName}
        weddingDate={weddingDate}
      />
    ) : null,
    story:
      content.story.enabled && storyHasContent ? (
        <StorySlide story={content.story} />
      ) : null,
    gallery: content.gallery.enabled ? (
      <GallerySlide
        gallery={content.gallery}
        invitationId={invitationId}
        isPreview={isPreview}
        mode={mode}
        initialLikes={ownerData?.galleryLikes}
      />
    ) : null,
    video:
      content.video.enabled && content.video.url ? (
        <VideoSlide video={content.video} />
      ) : null,
    quiz:
      content.quiz.enabled && quizHasPlayable ? (
        <QuizSlide
          quiz={content.quiz}
          invitationId={invitationId}
          isPreview={isPreview}
          mode={mode}
          ownerPicks={ownerData?.quizPicks}
        />
      ) : null,
    vote:
      content.vote.enabled && voteHasPlayable ? (
        <VoteSlide
          vote={content.vote}
          invitationId={invitationId}
          isPreview={isPreview}
          mode={mode}
          ownerPicks={ownerData?.votePicks}
        />
      ) : null,
    guestbook: content.guestbook.enabled ? (
      <GuestbookSlide
        guestbook={content.guestbook}
        invitationId={invitationId}
        isPreview={isPreview}
        mode={mode}
        ownerMessages={ownerData?.messages}
        ownerSignatures={ownerData?.signatures}
      />
    ) : null,
    account:
      content.account.enabled &&
      (content.account.groom.length > 0 ||
        content.account.bride.length > 0 ||
        content.account.groomFather.length > 0 ||
        content.account.groomMother.length > 0 ||
        content.account.brideFather.length > 0 ||
        content.account.brideMother.length > 0 ||
        // 등록된 계좌가 없어도 안내문구만 있으면 슬라이드 노출
        // (예: "축의금은 정중히 사양합니다" 안내).
        content.account.guide.trim().length > 0) ? (
        <AccountSlide account={content.account} />
      ) : null,
    closing: <ClosingSlide message={content.closing} />,
  };

  const orderedKeys = reconcilePageOrder(content.theme.pageOrder);
  
  // SlideContainer의 cloneElement가 정상 작동하도록 컴포넌트 자체를 넘김
  const slides = orderedKeys
    .map((key) => slidesByKey[key])
    .filter(Boolean) as ReactNode[];

  return (
    <>
      <VisitTracker invitationId={invitationId} disabled={isPreview} />
      <SlideContainer
        colorTheme={content.theme.colorTheme}
        petalType={content.theme.petalType}
        font={content.theme.font}
        bgmUrl={content.theme.bgm?.enabled ? content.theme.bgm.url : null}
        scoped={scoped}
      >
        {slides}
      </SlideContainer>
    </>
  );
}
