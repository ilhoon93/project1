'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import {
  FrameDesignSchema,
  IllustrationDesignSchema,
  PosterDesignSchema,
  TextDesignSchema,
  type InvitationContent,
  type FrameDesign,
  type PosterDesign,
  type IllustrationDesign,
  type TextDesign,
  type TextNameLayout,
} from '@/types/invitation';
import {
  TITLE_FONT_OPTIONS,
  isKoreanTitleText,
  DEFAULT_TITLE_FONT_KO,
  getDisplayFontSize,
  type TitleFontKey,
} from '@/lib/theme';
import { Confetti } from '@/components/shared/Confetti';
import { HeartClip } from '@/components/shared/HeartClip';
import { HandwritingStroke } from '@/components/invitation/slides/HandwritingStroke';

/**
 * 정적 렌더 모드 — true 면 메인 슬라이드의 "그려지는" 등장 효과(제목 필기, 위치
 * 박스 페이드인)를 끄고 최종 상태로 즉시 렌더한다. 관리자 샘플 목록 썸네일처럼
 * "첫 로딩 시 이미지만" 보여야 하는 정적 미리보기에서 사용. 편집용 실시간
 * 미리보기(기본 false)에서는 평소대로 애니메이션이 재생된다.
 */
export const StaticRenderContext = createContext(false);

interface Props {
  invitationId: string;
  groomName: string;
  brideName: string;
  weddingDate: string | null;
  main: InvitationContent['main'];
  /** scoped: 좌측 미리보기 패널처럼 부모 박스 안에서만 컨페티가 동작하도록. */
  scoped?: boolean;
  /** isPreview: 에디터 미리보기 — 축하하기 카운트가 서버에 기록되지 않음. */
  isPreview?: boolean;
  /**
   * mode === 'owner' 인 경우(소장용 URL)
   *   - 진입 시 컨페티가 자동으로 한 번 터짐
   *   - 축하하기 버튼은 누적 카운트 표시로 대체
   */
  mode?: 'guest' | 'owner';
  /** owner 모드에서 표시할 누적 축하 횟수. */
  cheersCount?: number;
  /** 정적 렌더 — 제목 필기·텍스트 페이드인 등 등장 효과 없이 최종 상태로 즉시 표시. */
  staticRender?: boolean;
}

export function MainSlide({
  invitationId,
  groomName,
  brideName,
  weddingDate,
  main,
  scoped,
  isPreview,
  mode = 'guest',
  cheersCount = 0,
  staticRender = false,
}: Props) {
  const [confettiTrigger, setConfettiTrigger] = useState<number | null>(null);

  // owner 모드 — 진입 시 컨페티 자동 한 번 터트림.
  useEffect(() => {
    if (mode === 'owner') {
      const t = setTimeout(() => setConfettiTrigger(Date.now()), 350);
      return () => clearTimeout(t);
    }
  }, [mode]);

  const handleCelebrate = () => {
    setConfettiTrigger(Date.now());
    // guest 모드 + 발행된 페이지에서만 카운트 기록 (미리보기 제외).
    if (mode === 'guest' && !isPreview) {
      void fetch('/api/guest/cheer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({ invitationId }),
      }).catch(() => {});
    }
  };

  const layout = main.layout ?? 'poster';
  const hasImage = !!main.heroImage;

  // 레이아웃별 슬라이드를 고른 뒤, 정적 렌더 여부를 컨텍스트로 하위(제목·위치박스)에 전달.
  const rendered = (() => {
  if (layout === 'poster' && hasImage) {
    return (
      <PosterFullImageSlide
        main={main}
        groomName={groomName}
        brideName={brideName}
        weddingDate={weddingDate}
        onCelebrate={handleCelebrate}
        confettiTrigger={confettiTrigger}
        scoped={scoped}
        mode={mode}
        cheersCount={cheersCount}
      />
    );
  }

  if (layout === 'illustration') {
    return (
      <IllustrationSlide
        main={main}
        groomName={groomName}
        brideName={brideName}
        weddingDate={weddingDate}
        onCelebrate={handleCelebrate}
        confettiTrigger={confettiTrigger}
        scoped={scoped}
        mode={mode}
        cheersCount={cheersCount}
      />
    );
  }

  if (layout === 'text') {
    return (
      <TextLayoutSlide
        main={main}
        groomName={groomName}
        brideName={brideName}
        weddingDate={weddingDate}
        onCelebrate={handleCelebrate}
        confettiTrigger={confettiTrigger}
        scoped={scoped}
        mode={mode}
        cheersCount={cheersCount}
      />
    );
  }

  if (layout === 'frame' || layout === 'polaroid') {
    return (
      <FrameSlide
        main={main}
        groomName={groomName}
        brideName={brideName}
        weddingDate={weddingDate}
        onCelebrate={handleCelebrate}
        confettiTrigger={confettiTrigger}
        scoped={scoped}
        mode={mode}
        cheersCount={cheersCount}
      />
    );
  }

  return (
    <LegacyMainSlide
      main={main}
      groomName={groomName}
      brideName={brideName}
      weddingDate={weddingDate}
      onCelebrate={handleCelebrate}
      confettiTrigger={confettiTrigger}
      scoped={scoped}
      mode={mode}
      cheersCount={cheersCount}
    />
  );
  })();

  return (
    <StaticRenderContext.Provider value={staticRender}>{rendered}</StaticRenderContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────
// 풀이미지형 (poster + heroImage) — 디자인 컨트롤 적용 슬라이드
// ─────────────────────────────────────────────────────────────

interface CelebrationFooterProps {
  mode: 'guest' | 'owner';
  cheersCount: number;
  onCelebrate: () => void;
}

/**
 * 메인 슬라이드 하단 "축하하기" 버튼 / 누적 카운트 표시.
 *  - guest 모드: 축하하기 클릭으로 컨페티 + 카운트 +1 (handler 가 처리)
 *  - owner 모드: 클릭 불가능. "총 N번의 축하가 터졌습니다" 텍스트로 대체.
 *
 * 각 메인 슬라이드 variant 가 동일한 footer 를 쓸 수 있도록 추출.
 */
function CelebrationFooter({
  mode,
  cheersCount,
  onCelebrate,
  inverse,
}: CelebrationFooterProps & { inverse?: boolean }) {
  // poster fullImage / 가로 스크린 처럼 어두운 오버레이 위에 띄울 땐 inverse=true 로 흰색 톤.
  const baseColor = inverse ? 'text-white' : '';
  if (mode === 'owner') {
    return (
      <div className={`flex flex-col items-center text-xs font-medium opacity-80 ${baseColor}`}>
        <span aria-hidden className="text-base leading-none">🎉</span>
        <span className="mt-1">
          총 <span className="font-semibold">{cheersCount.toLocaleString()}</span>번의 축하가 터졌습니다
        </span>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onCelebrate}
      className={`inline-flex items-center gap-1.5 text-xs font-medium opacity-80 transition-opacity hover:opacity-100 ${baseColor}`}
    >
      <span className="underline underline-offset-4">축하하기</span>
      <span aria-hidden className="text-base leading-none">🎉</span>
    </button>
  );
}

type FooterMode = Pick<CelebrationFooterProps, 'mode' | 'cheersCount'>;

interface PosterProps extends FooterMode {
  main: InvitationContent['main'];
  groomName: string;
  brideName: string;
  weddingDate: string | null;
  onCelebrate: () => void;
  confettiTrigger: number | null;
  scoped?: boolean;
}

function PosterFullImageSlide({
  main,
  groomName,
  brideName,
  weddingDate,
  onCelebrate,
  confettiTrigger,
  scoped,
  mode,
  cheersCount,
}: PosterProps) {
  // 구버전 데이터에 posterDesign 이 없을 수도 있어 안전하게 기본값 폴백.
  const design: PosterDesign = main.posterDesign ?? PosterDesignSchema.parse(undefined);

  const titleFont = TITLE_FONT_OPTIONS[design.title.font].family;

  const imageFit = design.image?.fit ?? 'cover';
  const imagePos = design.image?.position ?? { x: 50, y: 50 };

  return (
    <section
      className="relative h-full min-h-full w-full overflow-hidden text-white"
      style={
        // contain 모드는 이미지 외 영역을 테마 배경색으로 채운다.
        imageFit === 'contain'
          ? { backgroundColor: 'var(--mw-bg, #1a1a1a)' }
          : undefined
      }
    >
      {/* 배경 이미지 — 사용자가 업로드한 임의 URL 이라 next/image 의 도메인 화이트리스트
          를 적용하기 어렵다. eslint-disable 로 경고만 억제. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={main.heroImage!}
        alt=""
        className={`absolute inset-0 h-full w-full ${
          imageFit === 'contain' ? 'object-contain' : 'object-cover mw-kenburns'
        }`}
        style={
          imageFit === 'cover'
            ? { objectPosition: `${imagePos.x}% ${imagePos.y}%` }
            : undefined
        }
      />

      {/* 가독성 확보용 살짝의 어두운 오버레이 — contain 모드에선 이미지 밖 배경까지 어두워지지 않도록 생략 */}
      {imageFit === 'cover' && <div className="absolute inset-0 bg-black/25" />}

      {/* 1-a) 하단 그라데이션 — 테마 배경색에 맞춰 부드럽게 페이드.
          높이 1/2 → 1/3, 시작점에 더 큰 투명 영역을 둬서 전체 강도를 낮춘다. */}
      {design.effects.gradient && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3"
          style={{
            backgroundImage:
              'linear-gradient(to bottom, transparent 0%, transparent 35%, var(--mw-bg, rgba(0,0,0,0.6)) 100%)',
            opacity: 0.7,
          }}
        />
      )}

      {/* 1-b) 가장자리 테두리 — 모서리에서 띄운 간격, 직각 모서리 */}
      {design.effects.border && (
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            top: 16,
            right: 16,
            bottom: 16,
            left: 16,
            border: '1px solid var(--mw-bg, rgba(255,255,255,0.6))',
            borderRadius: 0,
          }}
        />
      )}

      {/* 2) 제목 텍스트 — 절대 위치 + 옵션 애니메이션, 슬라이더로 크기 조절.
          폰트별 시각 크기 보정(TITLE_FONT_SIZE_SCALE) 적용 — 장식 폰트가 같은
          px 에서도 더 크게 보이도록.
          animate=true 면 SVG path 의 stroke-dashoffset 으로 글자 한 자씩 진짜
          손글씨처럼 그려진 뒤 fill 이 채워지는 시퀀스 — opentype.js 로 선택된
          폰트의 글자 outline 을 SVG path 로 변환해 그려낸다. 폰트 URL 을 못
          찾는 케이스(외부 @import 등) 는 onUnsupported 콜백으로 글자별 fade
          폴백으로 자동 전환. */}
      <PositionedBox position={design.title.position}>
        <AnimatedTitleH1
          text={design.title.text}
          animate={design.title.animate}
          fontFamily={titleFont}
          color={design.title.color}
          fontSize={getDisplayFontSize(design.title.fontSize, design.title.font as TitleFontKey)}
        />
      </PositionedBox>

      {/* 4) 이름 박스 — 글로벌 테마 폰트·색 그대로 */}
      {design.nameBox.enabled && (
        <PositionedBox position={design.nameBox.position} delay={0.3}>
          <div
            className="flex items-baseline justify-center gap-3 text-center font-light tracking-wide drop-shadow-sm"
            style={{ fontSize: `${design.nameBox.fontSize}px` }}
          >
            <span>{groomName}</span>
            <span className="opacity-70" style={{ fontSize: '0.7em' }}>&</span>
            <span>{brideName}</span>
          </div>
        </PositionedBox>
      )}

      {/* 3) 날짜 박스 — 글로벌 테마 폰트·색 그대로 */}
      {design.dateBox.enabled && weddingDate && (
        <PositionedBox position={design.dateBox.position} delay={0.45}>
          <p
            className="text-center tracking-[0.3em] drop-shadow-sm"
            style={{ fontSize: `${design.dateBox.fontSize}px` }}
          >
            {formatDate(weddingDate)}
          </p>
        </PositionedBox>
      )}

      {/* 5) 인사말 — 토글이 켜져 있고 본문이 있을 때만 표시 */}
      {design.messageBox.enabled && main.greeting && (
        <PositionedBox position={design.messageBox.position} delay={0.15}>
          <p
            className="max-w-md whitespace-pre-line text-center leading-relaxed drop-shadow-sm"
            style={{ fontSize: `${design.messageBox.fontSize}px` }}
          >
            {main.greeting}
          </p>
        </PositionedBox>
      )}

      {/* 하단 축하하기 / 누적 카운트 — bottom-10 (40px). 진행 바(bottom-5=20px) 위로
          ≥20px 간격 확보. 사용자가 축하하기 버튼을 누르려다 진행 바가 잘못 눌리는
          일을 방지하면서도 슬라이드 콘텐츠와 충분한 거리를 둔다. */}
      <div className="absolute bottom-10 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center">
        <CelebrationFooter
          mode={mode}
          cheersCount={cheersCount}
          onCelebrate={onCelebrate}
          inverse
        />
      </div>

      <Confetti trigger={confettiTrigger} scoped={scoped} />
      {/* mw-title-wipe / mw-pos-fade 키프레임은 globals.css 에 글로벌로 정의 —
          모든 레이아웃(poster/frame/illustration/text)에서 동일하게 동작.
          stroke 필기 효과는 HandwritingStroke 가 Web Animations API 로 자체 처리. */}
    </section>
  );
}

/**
 * 메인 슬라이드 제목 h1 + 필기 애니메이션 분기.
 *  - animate=false : 그냥 텍스트.
 *  - animate=true  : 1) HandwritingStroke — fontkit 으로 추출한 글자 outline 을
 *                       SVG <path> 로 "한 획씩 그려지듯" 필기. 글리프 outline
 *                       그대로라 어떤 폰트·레이아웃에서도 모양이 안 깨진다.
 *                    2) 폰트 파일을 못 찾거나(파싱 실패) 시 onUnsupported 콜백 →
 *                       HandwritingWipe (좌→우 clip-path 리빌) 로 폴백.
 *                       텍스트를 단일 노드로 두고 클립만 움직이므로 합자·자간이
 *                       그대로 유지돼 "글자 분리(inline-block)" 가 깨던 문제 없음.
 *
 * Inner 에 key 를 걸어 텍스트/폰트가 바뀌면 fallback state 가 깔끔하게 초기화.
 */
function AnimatedTitleH1({
  text,
  animate,
  fontFamily,
  color,
  fontSize,
}: {
  text: string;
  animate: boolean;
  fontFamily: string;
  color: string;
  fontSize: number;
}) {
  // 정적 미리보기에서는 필기 애니메이션 없이 완성된 제목만 즉시 보여준다.
  const isStatic = useContext(StaticRenderContext);
  return (
    <h1
      className="whitespace-pre-wrap text-center font-bold leading-snug"
      style={{
        fontFamily,
        color,
        fontSize: `${fontSize}px`,
      }}
      aria-label={text}
    >
      {animate && !isStatic ? (
        <AnimatedTitleInner
          key={`${text}-${fontFamily}`}
          text={text}
          fontFamily={fontFamily}
          fontSize={fontSize}
          color={color}
        />
      ) : (
        text
      )}
    </h1>
  );
}

function AnimatedTitleInner({
  text,
  fontFamily,
  fontSize,
  color,
}: {
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
}) {
  // 1순위: 글자 outline 을 한 획씩 그리는 필기 효과(HandwritingStroke).
  //   glyph outline 을 그대로 path 로 그려 어떤 폰트도 모양이 깨지지 않는다.
  // 폴백: 폰트 파일 fetch/파싱 실패(예: CORS) 시 좌→우 clip 리빌(HandwritingWipe).
  //   per-char inline-block 으로 쪼개지 않아 합자·자간이 그대로 유지된다.
  const [strokeUnsupported, setStrokeUnsupported] = useState(false);
  if (strokeUnsupported) {
    return <HandwritingWipe text={text} />;
  }
  return (
    <HandwritingStroke
      text={text}
      fontFamily={fontFamily}
      fontSize={fontSize}
      color={color}
      onUnsupported={() => setStrokeUnsupported(true)}
    />
  );
}

/**
 * 폰트 안전 폴백 — 텍스트를 단일 노드로 두고 좌→우로 clip-path 리빌해
 * "써 내려가는" 인상을 준다. 글자를 inline-block 으로 쪼개지 않으므로 합자·
 * 자간(kerning)·자모 위치가 폰트 본연 그대로 유지된다 (폰트 안 깨짐).
 * 줄바꿈(\n)은 부모 h1 의 whitespace-pre-wrap 가 처리.
 */
function HandwritingWipe({ text }: { text: string }) {
  // text-align:center 를 명시 — inline-block 폭이 부모 가득일 때 내부 줄들도 가운데로.
  return (
    <span
      aria-hidden
      className="mw-title-wipe"
      style={{ display: 'inline-block', textAlign: 'center' }}
    >
      {text}
    </span>
  );
}

/**
 * 0–100 % 좌표를 화면 절대 위치로 변환. 앵커는 박스 중앙.
 * 양옆은 화면을 벗어나지 않도록 max-width 와 padding 으로 가둔다.
 */
function PositionedBox({
  position,
  delay = 0,
  children,
}: {
  position: { x: number; y: number };
  /** 메인 슬라이드 진입 시 텍스트 스태거 fade-in 딜레이(초). */
  delay?: number;
  children: React.ReactNode;
}) {
  // 정적 미리보기에서는 fade-in 없이 최종 위치·불투명도로 즉시 렌더.
  const isStatic = useContext(StaticRenderContext);
  return (
    <div
      className={`${isStatic ? '' : 'mw-pos-fade '}absolute z-10 w-full px-6`}
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: 'translate(-50%, -50%)',
        maxWidth: 'min(90vw, 32rem)',
        ...(isStatic ? {} : { animationDelay: `${delay}s` }),
      }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Legacy 레이아웃 (polaroid / illustration / text / 이미지 없는 poster)
// — 기존 동작 유지
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// 일러스트형 슬라이드 — arch / dance 두 베리언트
// ─────────────────────────────────────────────────────────────

const PLAYFAIR = "var(--font-playfair-display), serif";

// 일러스트형 / 텍스트형은 제목 폰트를 자체적으로 노출하지 않고, 한글이
// 포함된 문구일 때만 자동으로 한글 폰트(고운바탕 계열)로 전환한다.
function autoTitleFontFor(text: string): string {
  if (isKoreanTitleText(text)) {
    return TITLE_FONT_OPTIONS[DEFAULT_TITLE_FONT_KO].family;
  }
  return PLAYFAIR;
}

function IllustrationSlide({
  main,
  groomName,
  brideName,
  weddingDate,
  onCelebrate,
  confettiTrigger,
  scoped,
  mode,
  cheersCount,
}: PosterProps) {
  const design: IllustrationDesign =
    main.illustrationDesign ?? IllustrationDesignSchema.parse(undefined);

  const titleColor = design.title.color || 'currentColor';
  const illustSrc = `/illustrations/illust-${design.variant}.png`;
  // 사용자가 picker 에서 고른 폰트 우선. 한글 문구로 바뀌어 한글 폰트로 자동
  // 전환된 상태라면 design.title.font 가 이미 한글 키 — 그대로 사용.
  const titleFontFamily =
    TITLE_FONT_OPTIONS[design.title.font as TitleFontKey]?.family
    ?? autoTitleFontFor(design.title.text);

  return (
    // 통일 레이아웃 — 일러스트 카드 중앙, 텍스트(제목/인사말/이름/날짜)는 슬라이드
    // 전체에서 PositionedBox 로 자유 떠다님. 사용자가 0-100% 슬라이더로 위치 조정.
    <section className="relative h-full min-h-full w-full overflow-hidden text-center">
      {/* 일러스트 카드 — 슬라이드 정중앙에 고정 (z-0) */}
      <div className="absolute inset-0 z-0 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <IllustrationImage src={illustSrc} variant={design.variant} />
        </div>
      </div>

      {/* 제목 텍스트 — PositionedBox 로 절대 위치 */}
      <PositionedBox position={design.title.position}>
        <AnimatedTitleH1
          text={design.title.text}
          animate={design.title.animate}
          fontFamily={titleFontFamily}
          color={titleColor}
          fontSize={getDisplayFontSize(design.title.fontSize, design.title.font as TitleFontKey)}
        />
      </PositionedBox>

      {/* 인사말 */}
      {design.messageBox.enabled && main.greeting && (
        <PositionedBox position={design.messageBox.position} delay={0.15}>
          <p
            className="max-w-md whitespace-pre-line leading-relaxed opacity-80"
            style={{ fontSize: `${design.messageBox.fontSize}px` }}
          >
            {main.greeting}
          </p>
        </PositionedBox>
      )}

      {/* 이름 */}
      {design.nameBox.enabled && (
        <PositionedBox position={design.nameBox.position} delay={0.3}>
          <p
            className="font-light tracking-wide"
            style={{ fontSize: `${design.nameBox.fontSize}px` }}
          >
            신랑 {groomName} · 신부 {brideName}
          </p>
        </PositionedBox>
      )}

      {/* 날짜 */}
      {design.dateBox.enabled && weddingDate && (
        <PositionedBox position={design.dateBox.position} delay={0.45}>
          <p
            className="tracking-[0.2em]"
            style={{
              fontFamily: PLAYFAIR,
              fontSize: `${design.dateBox.fontSize}px`,
            }}
          >
            {formatDateForIllust(weddingDate)}
          </p>
        </PositionedBox>
      )}

      {/* 축하하기 footer */}
      <div className="absolute bottom-10 left-1/2 z-20 -translate-x-1/2">
        <CelebrationFooter
          mode={mode}
          cheersCount={cheersCount}
          onCelebrate={onCelebrate}
        />
      </div>

      <Confetti trigger={confettiTrigger} scoped={scoped} />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// 텍스트형 슬라이드 — 일러스트형과 같은 골격(제목 → 인사말 → 데코 →
// 디바이더 → 이름 → 날짜)을 따른다. 디자인 컨트롤(TextDesign)을 통해
// 제목 문구·색상·크기·상하 위치, 인사말/이름/날짜의 토글·크기·상하 위치,
// 그리고 가운데 데코 일러스트(flower / letter) 변형을 선택할 수 있다.
//
// 기존 LegacyMainSlide 의 단순한 "꽃 PNG + 이름·날짜" 레이아웃에서
// 일러스트형과 동일한 디자인 시그니처(영문 타이틀·디바이더·중앙 정렬
// 인사말)로 격상해 사용자가 텍스트형에서도 일러스트형과 같은 수준으로
// 디테일을 조정할 수 있게 한다.
// ─────────────────────────────────────────────────────────────

function TextLayoutSlide({
  main,
  groomName,
  brideName,
  weddingDate,
  onCelebrate,
  confettiTrigger,
  scoped,
  mode,
  cheersCount,
}: PosterProps) {
  // 구버전 데이터에 textDesign 이 없을 수도 있어 안전하게 기본값 폴백.
  const design: TextDesign = main.textDesign ?? TextDesignSchema.parse(undefined);

  const titleColor = design.title.color || 'currentColor';
  const decoSrc = `/illustrations/text-${design.variant}.png`;
  // 사용자가 picker 에서 고른 폰트 우선. 구버전 데이터로 font 가 없으면
  // autoTitleFontFor 로 한/영 자동 매핑.
  const titleFontFamily =
    TITLE_FONT_OPTIONS[design.title.font as TitleFontKey]?.family
    ?? autoTitleFontFor(design.title.text);

  // 이름 정렬/순서 — brideFirst 면 신부, 신랑 순. layout 'stack' 이면 위·아래 두 줄.
  // "신랑/신부" 접두어는 표시하지 않는다 (사용자 요청).
  const firstName = design.nameBox.brideFirst ? brideName : groomName;
  const secondName = design.nameBox.brideFirst ? groomName : brideName;

  return (
    // 통일 레이아웃 — 데코 일러스트(꽃/편지/없음) 중앙, 텍스트는 PositionedBox 로
    // 자유 떠다님. variant === 'none' 이면 데코 안 그림.
    <section className="relative h-full min-h-full w-full overflow-hidden text-center">
      {/* 데코 일러스트 — 슬라이드 정중앙. variant 'none' 면 skip.
          flower 는 채색 안 된 라인 스케치 → 다크 테마에서 invert 가 필요해
          --mw-sketch-filter 를 쓰고, letter 는 풀컬러 일러스트라 기존 글로우만
          더하는 --mw-illust-filter 그대로. */}
      {design.variant !== 'none' && (
        <div className="absolute inset-0 z-0 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={decoSrc}
            alt=""
            aria-hidden
            className="block h-auto w-full select-none object-cover"
            draggable={false}
            style={{
              filter:
                design.variant === 'flower'
                  ? 'var(--mw-sketch-filter, none)'
                  : 'var(--mw-illust-filter, none)',
            }}
          />
        </div>
      )}

      {/* 제목 */}
      <PositionedBox position={design.title.position}>
        <AnimatedTitleH1
          text={design.title.text}
          animate={design.title.animate}
          fontFamily={titleFontFamily}
          color={titleColor}
          fontSize={getDisplayFontSize(design.title.fontSize, design.title.font as TitleFontKey)}
        />
      </PositionedBox>

      {/* 인사말 */}
      {design.messageBox.enabled && main.greeting && (
        <PositionedBox position={design.messageBox.position} delay={0.15}>
          <p
            className="max-w-md whitespace-pre-line leading-relaxed opacity-80"
            style={{ fontSize: `${design.messageBox.fontSize}px` }}
          >
            {main.greeting}
          </p>
        </PositionedBox>
      )}

      {/* 이름 — 4가지 레이아웃 (inline / stack / stackHeart / inlineCross) */}
      {design.nameBox.enabled && (
        <PositionedBox position={design.nameBox.position} delay={0.3}>
          <NameLayout
            layout={design.nameBox.layout}
            firstName={firstName}
            secondName={secondName}
            fontSize={design.nameBox.fontSize}
          />
        </PositionedBox>
      )}

      {/* 날짜 */}
      {design.dateBox.enabled && weddingDate && (
        <PositionedBox position={design.dateBox.position} delay={0.45}>
          <p
            className="tracking-[0.2em]"
            style={{
              fontFamily: PLAYFAIR,
              fontSize: `${design.dateBox.fontSize}px`,
            }}
          >
            {formatDateForIllust(weddingDate)}
          </p>
        </PositionedBox>
      )}

      <div className="absolute bottom-10 left-1/2 z-20 -translate-x-1/2">
        <CelebrationFooter
          mode={mode}
          cheersCount={cheersCount}
          onCelebrate={onCelebrate}
        />
      </div>

      <Confetti trigger={confettiTrigger} scoped={scoped} />
    </section>
  );
}

/**
 * 텍스트형 이름 박스의 4가지 레이아웃 렌더러.
 *
 *   inline      : 신랑 · 신부
 *   stack       : 신랑
 *                  ✦
 *                 신부
 *   stackHeart  : 신랑
 *                ── ♥ ──
 *                 신부
 *   inlineCross :       │
 *                 신랑 ♥ 신부
 *                       │
 *
 * 하트는 너무 두드러지지 않게 본문 글자 크기 대비 0.55em 정도로 작게, 색은
 * currentColor (테마 색) — 라이트 테마면 검정 톤, 다크 테마면 밝은 톤이 되어
 * "흑백" 표현이 자연스럽게 적용된다. 가로선/세로선 길이도 본문 크기에 비례해
 * em 단위로 잡아 어떤 fontSize 에서도 균형이 유지됨.
 */
function NameLayout({
  layout,
  firstName,
  secondName,
  fontSize,
}: {
  layout: TextNameLayout;
  firstName: string;
  secondName: string;
  fontSize: number;
}) {
  if (layout === 'inline') {
    return (
      <div
        className="flex flex-col items-center font-bold tracking-wide"
        style={{ fontSize: `${fontSize}px` }}
      >
        <span>
          {firstName} · {secondName}
        </span>
      </div>
    );
  }

  if (layout === 'stack') {
    return (
      <div
        className="flex flex-col items-center font-bold tracking-wide"
        style={{ fontSize: `${fontSize}px` }}
      >
        <span className="leading-tight">{firstName}</span>
        <span
          aria-hidden
          className="font-normal leading-none opacity-50"
          style={{ fontSize: '0.55em', margin: '0.1em 0' }}
        >
          ✦
        </span>
        <span className="leading-tight">{secondName}</span>
      </div>
    );
  }

  if (layout === 'stackHeart') {
    // 신랑 / ── ♥ ── / 신부
    return (
      <div
        className="flex flex-col items-center font-bold tracking-wide"
        style={{ fontSize: `${fontSize}px` }}
      >
        <span className="leading-tight">{firstName}</span>
        <span
          aria-hidden
          className="flex items-center font-normal leading-none"
          style={{ margin: '0.18em 0', gap: '0.35em' }}
        >
          <span
            style={{
              display: 'inline-block',
              width: '3em',
              height: '1px',
              backgroundColor: 'currentColor',
              opacity: 0.6,
            }}
          />
          <span style={{ fontSize: '0.6em', lineHeight: 1 }}>♥</span>
          <span
            style={{
              display: 'inline-block',
              width: '3em',
              height: '1px',
              backgroundColor: 'currentColor',
              opacity: 0.6,
            }}
          />
        </span>
        <span className="leading-tight">{secondName}</span>
      </div>
    );
  }

  // inlineCross : 신랑 ♥ 신부 + 하트 위·아래로 세로선.
  return (
    <div
      className="flex flex-col items-center font-bold tracking-wide"
      style={{ fontSize: `${fontSize}px`, gap: '0.18em' }}
    >
      {/* 위 세로선 — 하트 바로 위에 정렬되도록 좌우 이름의 합산 폭 기준 가운데. */}
      <span
        aria-hidden
        style={{
          display: 'inline-block',
          width: '1px',
          height: '3em',
          backgroundColor: 'currentColor',
          opacity: 0.6,
        }}
      />
      <span className="flex items-center" style={{ gap: '0.4em' }}>
        <span className="leading-tight">{firstName}</span>
        <span
          aria-hidden
          className="font-normal leading-none"
          style={{ fontSize: '0.6em' }}
        >
          ♥
        </span>
        <span className="leading-tight">{secondName}</span>
      </span>
      <span
        aria-hidden
        style={{
          display: 'inline-block',
          width: '1px',
          height: '3em',
          backgroundColor: 'currentColor',
          opacity: 0.6,
        }}
      />
    </div>
  );
}

/**
 * 일러스트형 메인의 PNG 라인아트.
 *  - public/illustrations/illust-{variant}.png 를 로드
 *  - 다크 테마는 --mw-illust-filter (invert + hue-rotate) 로 명도 반전
 *  - 파일이 없으면 자리 안내 메시지를 보여줌
 */
function IllustrationImage({
  src,
  variant,
}: {
  src: string;
  variant: 'arch' | 'dance' | 'hanbok' | 'ani' | 'car';
}) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <div className="grid aspect-[4/5] w-full place-items-center rounded-md border border-dashed border-current/40 px-6 text-center text-xs opacity-70">
        <div className="space-y-1.5">
          <p className="font-medium">일러스트 이미지 추가 필요</p>
          <p className="font-mono text-[10px] opacity-80">
            public/illustrations/illust-{variant}.png
          </p>
          <p className="text-[10px]">
            투명 배경 PNG 를 위 경로에 저장해주세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    // isolation: isolate — 슬라이드 전환 같은 transform 애니메이션 중에도
    // 필터 합성 결과가 안정되도록 자체 stacking context 를 만든다.
    // mix-blend-mode 는 사용하지 않고 SVG feColorMatrix 필터로 흰/크림 배경을
    // 알파 0 으로 깎아내므로 화면 전환 시 흰 배경이 깜빡 보이는 현상이 없다.
    <div className="mx-auto w-full" style={{ isolation: 'isolate' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="block h-auto w-full select-none"
        style={{
          filter: 'var(--mw-illust-filter, none)',
        }}
        onError={() => setErrored(true)}
        draggable={false}
      />
    </div>
  );
}

// 사전 포맷팅된 string 그대로 표시 (formatDate 와 동일 — 일관성 위해 유지).
function formatDateForIllust(s: string) {
  return s;
}

function LegacyMainSlide({
  main,
  groomName,
  brideName,
  weddingDate,
  onCelebrate,
  confettiTrigger,
  scoped,
  mode,
  cheersCount,
}: PosterProps) {
  const layout = main.layout ?? 'poster';
  const hasImage = !!main.heroImage;
  const overlay = layout === 'poster' && hasImage;

  return (
    <section className="relative flex h-full min-h-full items-center justify-center px-6 py-10 text-center">
      {overlay && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={main.heroImage!}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/35" />
        </>
      )}

      <div
        className={`relative z-10 mb-24 flex w-full max-w-md flex-col items-center gap-4 ${
          overlay ? 'text-white' : ''
        }`}
      >
        {layout === 'poster' && (
          <p className={`text-xs tracking-[0.3em] ${overlay ? 'text-white/85' : 'opacity-70'}`}>
            OUR WEDDING
          </p>
        )}
        {layout === 'polaroid' && (
          <p className="text-xs uppercase tracking-[0.3em] opacity-70">Save the Date</p>
        )}
        {layout === 'illustration' && (
          <p className="text-xs uppercase tracking-[0.3em] opacity-70">Wedding Day</p>
        )}

        {layout === 'polaroid' && (
          // 직각 모서리(rounded-none), 사진 크기 확대(h-80 w-64),
          // 하단 신랑·신부 이름은 사용자 요청으로 제거.
          <div className="relative rotate-[-3deg] rounded-none bg-white p-3 pb-3 shadow-xl">
            {hasImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={main.heroImage!} alt="" className="h-80 w-64 object-cover" />
            ) : (
              <div className="grid h-80 w-64 place-items-center bg-gradient-br from-stone-200 to-stone-300 text-3xl text-stone-400">
                📷
              </div>
            )}
          </div>
        )}
        {layout === 'illustration' && <CoupleIllustration />}

        {layout === 'illustration' ? (
          <h1 className="flex items-baseline gap-3 text-2xl font-light">
            <span>{groomName}</span>
            <span className="text-base opacity-60">&</span>
            <span>{brideName}</span>
          </h1>
        ) : layout === 'poster' ? (
          <h1
            className={`flex flex-col items-center gap-2 text-3xl font-light ${overlay ? 'text-white' : ''}`}
          >
            <span>{groomName}</span>
            <span className={`text-base ${overlay ? 'text-white/80' : 'opacity-60'}`}>·</span>
            <span>{brideName}</span>
          </h1>
        ) : null}

        {weddingDate && (
          <p className={`text-sm tracking-widest ${overlay ? 'text-white/90' : 'opacity-80'}`}>
            {formatDate(weddingDate)}
          </p>
        )}

        {main.greeting && (
          <p
            className={`max-w-md whitespace-pre-line text-sm leading-relaxed ${
              overlay ? 'text-white/95' : 'opacity-90'
            }`}
          >
            {main.greeting}
          </p>
        )}
      </div>

      <div className="absolute bottom-10 left-1/2 z-20 flex w-full -translate-x-1/2 flex-col items-center gap-4 px-10">
        <CelebrationFooter
          mode={mode}
          cheersCount={cheersCount}
          onCelebrate={onCelebrate}
          inverse={overlay}
        />
      </div>

      <Confetti trigger={confettiTrigger} scoped={scoped} />
    </section>
  );
}

function CoupleIllustration() {
  return (
    <svg viewBox="0 0 160 140" width="140" height="120" aria-hidden className="opacity-90">
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="55" cy="42" r="14" />
        <path d="M55 56 L55 98 M55 70 L40 88 M55 70 L70 88 M55 98 L46 130 M55 98 L64 130" />
        <circle cx="105" cy="42" r="14" />
        <path d="M105 56 L105 98 M105 70 L90 88 M105 70 L120 88" />
        <path d="M88 130 L88 100 Q105 95 122 100 L122 130 Z" />
        <path
          d="M80 30 c-2 -6 -10 -6 -10 0 c0 6 10 12 10 12 c0 0 10 -6 10 -12 c0 -6 -8 -6 -10 0 z"
          fill="currentColor"
          stroke="none"
          opacity="0.7"
        />
      </g>
    </svg>
  );
}

// InvitationSlides 가 basic.dateFormat 으로 사전 포맷팅한 string 을 받아 그대로 표시.
// (예전엔 ISO 를 받아 '. ' 로 분리했으나, 운영자가 고른 형식을 일관 적용하기 위해
// 외부 포맷팅으로 통일.)
function formatDate(s: string) {
  return s;
}

// ─────────────────────────────────────────────────────────────
// 액자프레임 (폴라로이드 / 하트 / 스크린) — 같은 디자인 컨트롤(FrameDesign) 공유,
// variant 별로 이미지 프레임만 다르게 렌더한다.
// ─────────────────────────────────────────────────────────────

type FrameVariant =
  | 'polaroid'
  | 'heart'
  | 'screen'
  | 'arch'
  | 'classic'
  | 'photoBottom'
  | 'photoTop';

interface FrameProps extends FooterMode {
  main: InvitationContent['main'];
  groomName: string;
  brideName: string;
  weddingDate: string | null;
  onCelebrate: () => void;
  confettiTrigger: number | null;
  scoped?: boolean;
}

function FrameSlide({
  main,
  groomName,
  brideName,
  weddingDate,
  onCelebrate,
  confettiTrigger,
  scoped,
  mode,
  cheersCount,
}: FrameProps) {
  const design: FrameDesign = main.frameDesign ?? FrameDesignSchema.parse(undefined);
  const variant: FrameVariant = design.variant;
  const titleFont = TITLE_FONT_OPTIONS[design.title.font].family;
  const titleColor = design.title.color || 'currentColor';
  const isScreen = variant === 'screen';
  const imagePos = design.imagePosition ?? { x: 50, y: 50 };
  // 스크린 변형 — 업로드 이미지의 실제 가로:세로 비율(width/height) 을 측정해
  // FrameImage 가 변형마다 다른 박스 비율을 적용한다.
  //   landscape (>=1) : 이미지 자연 비율 + object-contain → 잘림 없이 전체 표시,
  //                     상하 빈 공간은 슬라이드(섹션) 배경 = 테마 배경색
  //   portrait  (<1)  : 1:1 정사각형 + object-cover + imagePosition 으로 크롭
  const [imageAspect, setImageAspect] = useState<number | null>(null);
  useEffect(() => {
    if (!isScreen || !main.heroImage) {
      setImageAspect(null);
      return;
    }
    const img = new window.Image();
    let canceled = false;
    img.onload = () => {
      if (canceled) return;
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        setImageAspect(img.naturalWidth / img.naturalHeight);
      }
    };
    img.src = main.heroImage;
    return () => {
      canceled = true;
    };
  }, [isScreen, main.heroImage]);

  return (
    // 통일 레이아웃 — 액자 카드 중앙 (variant 별 셰이프 유지), 텍스트는 슬라이드
    // 전체에서 PositionedBox 로 떠다님. 텍스트가 액자 위에 오버레이될 수도 있음.
    <section className="relative h-full min-h-full w-full overflow-hidden text-center">
      {/* 액자 바깥 배경 — 옵션(blurBackground) 켜짐 + 사진 있을 때만, 업로드 사진의
          흐린 버전을 전체에 깔아 갤러리 contain 배경과 유사한 효과를 준다. 꺼짐이면
          렌더하지 않아 기존 동작(테마 배경) 그대로 — 기존 알림장 무영향. */}
      {design.blurBackground && main.heroImage && (
        <div aria-hidden className="absolute inset-0 z-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={main.heroImage}
            alt=""
            className="h-full w-full scale-105 object-cover blur-sm"
          />
          {/* 어둡게 덮어 액자 프레임 사진이 더 돋보이게. */}
          <div className="absolute inset-0 bg-black/45" />
        </div>
      )}

      {/* 액자 이미지 — 슬라이드 정중앙에 카드로 */}
      <div className="absolute inset-0 z-0 flex items-center justify-center">
        <FrameImage
          variant={variant}
          src={main.heroImage ?? null}
          imagePosition={imagePos}
          imageAspect={imageAspect}
        />
      </div>

      {/* 제목 */}
      {design.title.enabled && design.title.text && (
        <PositionedBox position={design.title.position}>
          <AnimatedTitleH1
            text={design.title.text}
            animate={design.title.animate}
            fontFamily={titleFont}
            color={titleColor}
            fontSize={getDisplayFontSize(design.title.fontSize, design.title.font as TitleFontKey)}
          />
        </PositionedBox>
      )}

      {/* 인사말 */}
      {design.messageBox.enabled && main.greeting && (
        <PositionedBox position={design.messageBox.position} delay={0.15}>
          <p
            className="max-w-md whitespace-pre-line leading-relaxed opacity-80"
            style={{ fontSize: `${design.messageBox.fontSize}px` }}
          >
            {main.greeting}
          </p>
        </PositionedBox>
      )}

      {/* 이름 */}
      {design.nameBox.enabled && (
        <PositionedBox position={design.nameBox.position} delay={0.3}>
          <p
            className="font-light tracking-wide"
            style={{ fontSize: `${design.nameBox.fontSize}px` }}
          >
            {groomName} <span className="opacity-60">&amp;</span> {brideName}
          </p>
        </PositionedBox>
      )}

      {/* 날짜 */}
      {design.dateBox.enabled && weddingDate && (
        <PositionedBox position={design.dateBox.position} delay={0.45}>
          <p
            className="tracking-[0.2em] opacity-90"
            style={{ fontSize: `${design.dateBox.fontSize}px` }}
          >
            {formatDate(weddingDate)}
          </p>
        </PositionedBox>
      )}

      <div className="absolute bottom-10 left-1/2 z-20 -translate-x-1/2">
        <CelebrationFooter
          mode={mode}
          cheersCount={cheersCount}
          onCelebrate={onCelebrate}
          inverse={isScreen}
        />
      </div>

      <Confetti trigger={confettiTrigger} scoped={scoped} />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// 변형별 이미지 프레임 — 폴라로이드 / 하트 / 스크린
// ─────────────────────────────────────────────────────────────

function FrameImage({
  variant,
  src,
  imagePosition,
  imageAspect,
}: {
  variant: FrameVariant;
  src: string | null;
  imagePosition: { x: number; y: number };
  /** screen 변형 한정: 업로드 이미지의 실제 width/height 비율. null 이면 정사각형 폴백. */
  imageAspect?: number | null;
}) {
  const objectPos = `${imagePosition.x}% ${imagePosition.y}%`;

  if (variant === 'polaroid') {
    // 흰 테두리 + 살짝 기울임. 그림자로 입체감.
    // 사이즈는 원본(34/60/16rem) 과 1차 확대(42/74/20rem) 의 중간 — 원본보다 약간 큼.
    return (
      <div className="shrink-0 rotate-[-3deg] bg-white p-3 pb-8 shadow-xl">
        <div className="flex h-[37cqh] w-[66cqw] max-w-[17rem] items-center justify-center overflow-hidden bg-stone-100">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt=""
              className="h-full w-full object-cover"
              style={{ objectPosition: objectPos }}
            />
          ) : (
            <span className="text-3xl text-stone-400">📷</span>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'arch') {
    // 아치 — 세로 직사각형(3:4) + 상단만 둥근 곡선. 잘림 영역은 imagePosition 으로 조정.
    // 사이즈는 원본(68cqw / 18rem) 과 1차 확대(86cqw / 22rem) 의 중간 — 원본보다 약간 큼.
    // 테두리는 없이 그림자만 (사진 자체가 주인공).
    return (
      <div className="flex w-full shrink-0 items-center justify-center px-5">
        <div
          className="relative overflow-hidden shadow-md"
          style={{
            width: 'min(76cqw, 20rem)',
            aspectRatio: '3 / 4',
            borderRadius: '999px 999px 4px 4px',
          }}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt=""
              className="h-full w-full object-cover"
              style={{ objectPosition: objectPos }}
            />
          ) : (
            <div className="grid h-full w-full place-items-center bg-stone-100 text-3xl text-stone-400">
              🖼️
            </div>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'classic') {
    // 클래식 — 외곽선 / 매트(흰 테두리) 모두 제거. 사진만 깔끔하게 + shadow 로 입체감.
    return (
      <div className="flex w-full shrink-0 items-center justify-center px-4">
        <div
          className="relative overflow-hidden shadow-md"
          style={{
            width: 'min(78cqw, 20rem)',
            aspectRatio: '3 / 4',
          }}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt=""
              className="h-full w-full object-cover"
              style={{ objectPosition: objectPos }}
            />
          ) : (
            <div className="grid h-full w-full place-items-center bg-stone-100 text-3xl text-stone-400">
              🖼️
            </div>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'photoBottom' || variant === 'photoTop') {
    // 한쪽(위 또는 아래)에 테마 배경 여백을 두고, 반대쪽을 사진으로 가로 꽉 채운다.
    // 사진 영역 = 슬라이드 높이의 약 66% + object-cover + imagePosition 으로 크롭.
    // 남는 여백(약 34%)에는 제목·이름·날짜 텍스트(PositionedBox)가 떠서 올라간다.
    const alignBottom = variant === 'photoBottom';
    return (
      <div
        className="flex h-full w-full"
        style={{ alignItems: alignBottom ? 'flex-end' : 'flex-start' }}
      >
        <div className="w-full overflow-hidden" style={{ height: '66%' }}>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt=""
              className="h-full w-full object-cover"
              style={{ objectPosition: objectPos }}
            />
          ) : (
            <div className="grid h-full w-full place-items-center bg-stone-100 text-3xl text-stone-400">
              🖼️
            </div>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'heart') {
    // 하트 모양 클립 + 외곽 그림자.
    // aspectRatio 대신 width / height 를 동일 값으로 명시 — flex 컨텍스트나
    // 자식(이미지) 의 intrinsic size 가 컨테이너 높이를 끌어올리는 케이스 차단.
    // 사진이 세로로 긴 경우에도 항상 같은 정사각형 안에 하트가 자리잡는다.
    const heartSize = 'min(78cqw, 22rem)';
    return (
      <HeartClip
        className="shrink-0"
        style={{
          width: heartSize,
          height: heartSize,
          filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.18))',
        }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            className="h-full w-full object-cover"
            style={{ objectPosition: objectPos }}
          />
        ) : (
          // 빈 상태 — 하트 안쪽만 placeholder 색을 깔도록 children 안에 배경을 둔다.
          <div className="grid h-full w-full place-items-center bg-stone-100 text-3xl text-stone-400">
            💗
          </div>
        )}
      </HeartClip>
    );
  }

  // screen — 사진 비율에 따라 두 가지 모드:
  //   landscape (aspect ≥ 1): 사진 자연 비율 + object-contain → 잘림 없이 전체 표시.
  //                            컨테이너 폭 = 슬라이드 폭, 높이 = 폭 / 비율. 상하는 슬라이드(테마) 배경.
  //   portrait  (aspect < 1): 1:1 정사각형 + object-cover + imagePosition 으로 크롭.
  //                            상하는 슬라이드(테마) 배경 그대로 노출.
  // imageAspect 가 null(로드 전 / 이미지 없음) 이면 정사각형 + cover 폴백.
  // 좌/우 여백은 두지 않음 (슬라이드 폭을 100% 차지) — 사용자 요청. 상하는 letterbox.
  const isLandscape = (imageAspect ?? 1) >= 1;
  const containerAspect = isLandscape ? imageAspect ?? 1 : 1;
  const fitClass = isLandscape ? 'object-contain' : 'object-cover';
  return (
    <div className="flex w-full shrink-0 items-center justify-center">
      <div
        className="relative w-full overflow-hidden"
        style={{
          aspectRatio: `${containerAspect}`,
          // landscape: contain 모드라 이미지 옆에 빈 공간 거의 없음. portrait: square 안 잘린 이미지 영역.
          // 어느 쪽이든 컨테이너 배경은 테마 배경색을 그대로 깔아 둠.
          backgroundColor: 'var(--mw-bg, #1a1a1a)',
        }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            className={`h-full w-full ${fitClass}`}
            style={!isLandscape ? { objectPosition: objectPos } : undefined}
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-3xl opacity-40">🎬</div>
        )}
      </div>
    </div>
  );
}

