import type { ReactNode } from 'react';
import type { InvitationContent } from '@/types/invitation';
import { reconcilePageOrder, type SectionKey } from '@/lib/theme';
import { SlideContainer } from './SlideContainer';
import { SignatureGate } from './SignatureGate';
import { VisitTracker } from './VisitTracker';
import { MainSlide } from './slides/MainSlide';
import { BasicInfoSlide } from './slides/BasicInfoSlide';
import { StorySlide } from './slides/StorySlide';
import { GallerySlide } from './slides/GallerySlide';
import { VideoSlide } from './slides/VideoSlide';
import { QuizSlide } from './slides/QuizSlide';
import { VoteSlide } from './slides/VoteSlide';
import { GuestbookSlide, type GuestbookMessage } from './slides/GuestbookSlide';
import { AccountSlide } from './slides/AccountSlide';
import { ClosingSlide } from './slides/ClosingSlide';

interface Props {
  invitationId: string;
  groomName: string;
  brideName: string;
  weddingDate: string | null;
  content: InvitationContent;
  guestbookMessages?: GuestbookMessage[];
  /** Author preview mode — interactive forms are disabled, no signature gate. */
  isPreview?: boolean;
}

export function InvitationSlides({
  invitationId,
  groomName,
  brideName,
  weddingDate,
  content,
  guestbookMessages = [],
  isPreview,
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
        groomName={groomName}
        brideName={brideName}
        weddingDate={weddingDate}
        main={content.main}
      />
    ),
    basic: content.basic.enabled ? (
      <BasicInfoSlide basic={content.basic} weddingDate={weddingDate} />
    ) : null,
    story:
      content.story.enabled && storyHasContent ? (
        <StorySlide story={content.story} />
      ) : null,
    gallery: content.gallery.enabled ? <GallerySlide gallery={content.gallery} /> : null,
    video:
      content.video.enabled && content.video.url ? (
        <VideoSlide video={content.video} />
      ) : null,
    quiz:
      content.quiz.enabled && quizHasPlayable ? (
        <QuizSlide quiz={content.quiz} invitationId={invitationId} isPreview={isPreview} />
      ) : null,
    vote:
      content.vote.enabled && voteHasPlayable ? (
        <VoteSlide vote={content.vote} invitationId={invitationId} isPreview={isPreview} />
      ) : null,
    guestbook: content.guestbook.enabled ? (
      <GuestbookSlide
        guestbook={content.guestbook}
        invitationId={invitationId}
        initialMessages={guestbookMessages}
        isPreview={isPreview}
      />
    ) : null,
    account:
      content.account.enabled &&
      (content.account.groom.length > 0 || content.account.bride.length > 0) ? (
        <AccountSlide account={content.account} />
      ) : null,
    closing: <ClosingSlide message={content.closing} />,
  };

  const orderedKeys = reconcilePageOrder(content.theme.pageOrder);
  const slides = orderedKeys
    .map((key) => {
      const node = slidesByKey[key];
      return node ? <div key={key}>{node}</div> : null;
    })
    .filter(Boolean) as ReactNode[];

  return (
    <SignatureGate invitationId={invitationId} disabled={isPreview}>
      <VisitTracker invitationId={invitationId} disabled={isPreview} />
      <SlideContainer
        colorTheme={content.theme.colorTheme}
        petalType={content.theme.petalType}
        font={content.theme.font}
      >
        {slides}
      </SlideContainer>
    </SignatureGate>
  );
}
