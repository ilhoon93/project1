import type { ReactNode } from 'react';
import type { InvitationContent } from '@/types/invitation';
import { resolveSectionHeader } from '@/types/invitation';
import { reconcilePageOrder, type SectionKey } from '@/lib/theme';
import { formatWeddingDate } from '@/lib/utils/format-date';
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
  /** isPreview 여도 배경음악 플레이어를 노출 + 자동재생 — 마케팅 전체보기 모달의 샘플 음악용. */
  forceBgm?: boolean;
  /** isPreview 에서 음악 버튼만 노출(자동재생 X) — 에디터 실시간 미리보기용. */
  manualBgm?: boolean;
  /**
   * coverOnly: 메인 표지 한 장만 렌더(다른 슬라이드로 넘어갈 수 없음). 홈 쇼케이스
   * 커버처럼 표지만 보여줄 때 사용. pageOrder 를 무시하고 main 만 노출한다.
   */
  coverOnly?: boolean;
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
  forceBgm,
  manualBgm,
  coverOnly,
}: Props) {
  // 운영자가 고른 출력 형식으로 사전 포맷팅 — 자식 슬라이드들은 받은 문자열을
  // 그대로 표시(슬라이드별로 다른 변환을 거치지 않게 단일 출처).
  const formattedWeddingDate = weddingDate
    ? formatWeddingDate(weddingDate, content.basic.dateFormat)
    : null;

  const storyHasContent = content.story.chapters.some(
    (c) => c.title.trim() || c.text.trim() || c.image,
  );
  const quizHasPlayable = content.quiz.questions.some(
    (q) => q.q.trim() && q.options.every((opt) => opt.trim()),
  );
  const voteHasPlayable = content.vote.questions.some(
    (q) => q.q.trim() && q.options.every((opt) => opt.trim()),
  );

  // 슬라이드 상단 헤더(영문/한글) override 를 기본값과 합쳐 각 슬라이드에 전달.
  const headers = content.sectionHeaders ?? {};
  const hdr = (key: Parameters<typeof resolveSectionHeader>[0]) =>
    resolveSectionHeader(key, headers[key]);

  const slidesByKey: Record<SectionKey, ReactNode | null> = {
    main: (
      <MainSlide
        invitationId={invitationId}
        groomName={groomName}
        brideName={brideName}
        weddingDate={formattedWeddingDate}
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
        weddingDate={formattedWeddingDate}
        header={hdr('basic')}
      />
    ) : null,
    story:
      content.story.enabled && storyHasContent ? (
        <StorySlide story={content.story} header={hdr('story')} />
      ) : null,
    gallery: content.gallery.enabled ? (
      <GallerySlide
        gallery={content.gallery}
        invitationId={invitationId}
        isPreview={isPreview}
        mode={mode}
        initialLikes={ownerData?.galleryLikes}
        header={hdr('gallery')}
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
          header={hdr('quiz')}
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
          header={hdr('vote')}
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
        header={hdr('guestbook')}
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
        <AccountSlide account={content.account} header={hdr('account')} />
      ) : null,
    closing: (
      <ClosingSlide
        message={content.closing}
        // 공유 버튼은 기본 노출(샘플·미리보기 포함). 사용자가 closingShare 를
        // 끄면 숨김.
        showShare={content.closingShare !== false}
      />
    ),
  };

  // coverOnly 면 표지(main) 한 장만 — pageOrder 무시(다음 슬라이드 없음).
  const orderedKeys = coverOnly
    ? (['main'] as SectionKey[])
    : reconcilePageOrder(content.theme.pageOrder);

  // 슬라이드 전환 효과 — 렌더되는(비어있지 않은) 슬라이드만 골라 순서를 유지한다.
  // 슬라이드별 등장 방식:
  //   'none'     : 효과 없음(메인 표지 / 옵션 off)
  //   'stagger'  : 제목부터 아래로 요소를 계단식으로 순차 등장
  //   'together' : 제목만 먼저 뜨고 나머지는 한번에 — 요소가 많은 방명록에 사용
  const slideAnimationOn = content.theme.slideAnimation ?? false;
  const rendered = orderedKeys
    .map((key) => ({ key, node: slidesByKey[key] }))
    .filter((s) => Boolean(s.node));
  const slides = rendered.map((s) => s.node) as ReactNode[];
  const slideReveal = rendered.map<'none' | 'stagger' | 'together'>((s) => {
    if (!slideAnimationOn || s.key === 'main') return 'none';
    if (s.key === 'guestbook') return 'together';
    return 'stagger';
  });

  return (
    <>
      <VisitTracker invitationId={invitationId} disabled={isPreview} />
      <SlideContainer
        colorTheme={content.theme.colorTheme}
        petalType={content.theme.petalType}
        font={content.theme.font}
        bgmUrl={content.theme.bgm?.enabled ? content.theme.bgm.url : null}
        scoped={scoped}
        isPreview={isPreview}
        forceBgm={forceBgm}
        manualBgm={manualBgm}
        hostMode={content.theme.hostMode}
        slideReveal={slideReveal}
      >
        {slides}
      </SlideContainer>
    </>
  );
}
