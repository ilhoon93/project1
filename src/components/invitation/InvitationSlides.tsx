import type { InvitationContent } from '@/types/invitation';
import { SlideContainer } from './SlideContainer';
import { SignatureGate } from './SignatureGate';
import { VisitTracker } from './VisitTracker';
import { MainSlide } from './slides/MainSlide';
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
  const slides = [
    <MainSlide
      key="main"
      groomName={groomName}
      brideName={brideName}
      weddingDate={weddingDate}
      main={content.main}
    />,
    content.story.enabled && <StorySlide key="story" story={content.story} />,
    content.gallery.enabled && <GallerySlide key="gallery" gallery={content.gallery} />,
    content.video.enabled && content.video.url && (
      <VideoSlide key="video" video={content.video} />
    ),
    content.quiz.enabled && content.quiz.questions.length > 0 && (
      <QuizSlide
        key="quiz"
        quiz={content.quiz}
        invitationId={invitationId}
        isPreview={isPreview}
      />
    ),
    content.vote.enabled && content.vote.questions.length > 0 && (
      <VoteSlide
        key="vote"
        vote={content.vote}
        invitationId={invitationId}
        isPreview={isPreview}
      />
    ),
    content.guestbook.enabled && (
      <GuestbookSlide
        key="guestbook"
        guestbook={content.guestbook}
        invitationId={invitationId}
        initialMessages={guestbookMessages}
        isPreview={isPreview}
      />
    ),
    content.account.enabled &&
      (content.account.groom.length > 0 || content.account.bride.length > 0) && (
        <AccountSlide key="account" account={content.account} />
      ),
    <ClosingSlide key="closing" message={content.closing} />,
  ].filter(Boolean);

  return (
    <SignatureGate invitationId={invitationId} disabled={isPreview}>
      <VisitTracker invitationId={invitationId} disabled={isPreview} />
      <SlideContainer>{slides}</SlideContainer>
    </SignatureGate>
  );
}
