'use client';

import { useState } from 'react';
import {
  FrameDesignSchema,
  IllustrationDesignSchema,
  PosterDesignSchema,
  type InvitationContent,
  type FrameDesign,
  type PosterDesign,
  type IllustrationDesign,
} from '@/types/invitation';
import { TITLE_FONT_OPTIONS } from '@/lib/theme';
import { Confetti } from '@/components/shared/Confetti';

interface Props {
  groomName: string;
  brideName: string;
  weddingDate: string | null;
  main: InvitationContent['main'];
  /** scoped: 좌측 미리보기 패널처럼 부모 박스 안에서만 컨페티가 동작하도록. */
  scoped?: boolean;
}

export function MainSlide({ groomName, brideName, weddingDate, main, scoped }: Props) {
  const [confettiTrigger, setConfettiTrigger] = useState<number | null>(null);

  const handleCelebrate = () => setConfettiTrigger(Date.now());

  const layout = main.layout ?? 'poster';
  const hasImage = !!main.heroImage;

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
      />
    );
  }

  // 'frame' 신규 키 + 'polaroid' 구버전 키 둘 다 액자프레임 분기로 보낸다.
  // 변형(폴라로이드/하트/스크린) 은 frameDesign.variant 로 결정.
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
      />
    );
  }

  // 그 외 (text / 이미지 없는 poster) — 기존 레이아웃 그대로 유지.
  return (
    <LegacyMainSlide
      main={main}
      groomName={groomName}
      brideName={brideName}
      weddingDate={weddingDate}
      onCelebrate={handleCelebrate}
      confettiTrigger={confettiTrigger}
      scoped={scoped}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// 풀이미지형 (poster + heroImage) — 디자인 컨트롤 적용 슬라이드
// ─────────────────────────────────────────────────────────────

interface PosterProps {
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
      {/* 배경 이미지 */}
      <img
        src={main.heroImage!}
        alt=""
        className={`absolute inset-0 h-full w-full ${
          imageFit === 'contain' ? 'object-contain' : 'object-cover'
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

      {/* 2) 제목 텍스트 — 절대 위치 + 옵션 애니메이션, 슬라이더로 크기 조절 */}
      <PositionedBox position={design.title.position}>
        <h1
          key={`${design.title.text}-${design.title.animate}`}
          className={`whitespace-pre-wrap text-center font-bold leading-snug ${
            design.title.animate ? 'mw-title-reveal' : ''
          }`}
          style={{
            fontFamily: titleFont,
            color: design.title.color,
            fontSize: `${design.title.fontSize}px`,
          }}
        >
          {design.title.text}
        </h1>
      </PositionedBox>

      {/* 4) 이름 박스 — 글로벌 테마 폰트·색 그대로 */}
      {design.nameBox.enabled && (
        <PositionedBox position={design.nameBox.position}>
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
        <PositionedBox position={design.dateBox.position}>
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
        <PositionedBox position={design.messageBox.position}>
          <p
            className="max-w-md whitespace-pre-line text-center leading-relaxed drop-shadow-sm"
            style={{ fontSize: `${design.messageBox.fontSize}px` }}
          >
            {main.greeting}
          </p>
        </PositionedBox>
      )}

      {/* 하단 축하하기 버튼 */}
      <div className="absolute bottom-12 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center">
        <button
          type="button"
          onClick={onCelebrate}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-white opacity-80 transition-opacity hover:opacity-100"
        >
          <span className="underline underline-offset-4">축하하기</span>
          <span aria-hidden className="text-base leading-none">🎉</span>
        </button>
      </div>

      <Confetti trigger={confettiTrigger} scoped={scoped} />

      <style jsx>{`
        :global(.mw-title-reveal) {
          animation: mw-title-reveal 2.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          clip-path: inset(0 100% 0 0);
        }
        @keyframes mw-title-reveal {
          to {
            clip-path: inset(0 0 0 0);
          }
        }
      `}</style>
    </section>
  );
}

/**
 * 0–100 % 좌표를 화면 절대 위치로 변환. 앵커는 박스 중앙.
 * 양옆은 화면을 벗어나지 않도록 max-width 와 padding 으로 가둔다.
 */
function PositionedBox({
  position,
  children,
}: {
  position: { x: number; y: number };
  children: React.ReactNode;
}) {
  return (
    <div
      className="absolute z-10 w-full px-6"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: 'translate(-50%, -50%)',
        maxWidth: 'min(90vw, 32rem)',
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

function IllustrationSlide({
  main,
  groomName,
  brideName,
  weddingDate,
  onCelebrate,
  confettiTrigger,
  scoped,
}: PosterProps) {
  const design: IllustrationDesign =
    main.illustrationDesign ?? IllustrationDesignSchema.parse(undefined);

  const titleColor = design.title.color || 'currentColor';
  const illustSrc = `/illustrations/illust-${design.variant}.png`;

  return (
    // 레이아웃 구조 (위→아래):
    //   ┌───────────────────────────────┐
    //   │ flex-1 (justify-end)          │ ← 제목+인사말이 이 영역의 BOTTOM 에 붙음
    //   │   (overflow-hidden)           │   = 이미지 상단 바로 위
    //   │   h1 title                    │
    //   │   p  greeting                 │
    //   ├───────────────────────────────┤
    //   │ shrink-0 image                │ ← 고정 높이, 위치 흔들리지 않음
    //   ├───────────────────────────────┤
    //   │ shrink-0 divider/names/date   │ ← 이미지 바로 아래 가깝게 붙음
    //   │ flex-1 (spacer)               │
    //   └───────────────────────────────┘
    //   absolute 축하하기 버튼 (위치 고정)
    //
    // 인사말이 길어져도 이미지 자리는 그대로 유지된다 — overflow-hidden 으로
    // 상단으로 자연스럽게 잘리고, 이미지·이름·날짜·버튼은 흔들리지 않는다.
    <section
      className="relative flex h-full min-h-full w-full flex-col items-center overflow-hidden text-center"
    >
      {/* 1) 상단 영역 — 제목 + 인사말. justify-end + overflow-hidden 로
          이미지 상단을 기준으로 위로 자라는 형태.
          paddingBottom 으로 인사말과 이미지 상단 사이 간격 확보. */}
      <div
        className="flex w-full flex-col items-center justify-end overflow-hidden px-6"
        style={{ flex: '1 1 0', minHeight: 0, paddingTop: '4cqh', paddingBottom: '2.5cqh' }}
      >
        <h1
          className="font-bold leading-tight"
          style={{
            fontFamily: PLAYFAIR,
            color: titleColor,
            fontSize: `${design.title.fontSize}px`,
            transform: design.title.offsetY ? `translateY(${design.title.offsetY}cqh)` : undefined,
          }}
        >
          {design.title.text}
        </h1>

        {design.messageBox.enabled && main.greeting && (
          <p
            className="max-w-md whitespace-pre-line leading-relaxed opacity-80"
            style={{
              fontFamily: 'inherit',
              fontSize: `${design.messageBox.fontSize}px`,
              marginTop: '1.4cqh',
              transform: design.messageBox.offsetY
                ? `translateY(${design.messageBox.offsetY}cqh)`
                : undefined,
            }}
          >
            {main.greeting}
          </p>
        )}
      </div>

      {/* 2) 일러스트 이미지 — 고정 높이, 흔들리지 않음. */}
      <div
        className="flex w-full max-w-sm shrink-0 items-center justify-center px-6"
      >
        <IllustrationImage src={illustSrc} variant={design.variant} />
      </div>

      {/* 3) 이미지 하단 디바이더 — 가로폭 절반 정도, 이미지와 살짝 띄움 */}
      <IllustDivider />

      {/* 4) 이름 — 디바이더 아래 충분한 간격 + offsetY 로 미세 조정 */}
      {design.nameBox.enabled && (
        <p
          className="shrink-0 font-light tracking-wide"
          style={{
            fontFamily: 'inherit',
            fontSize: `${design.nameBox.fontSize}px`,
            marginTop: '2.2cqh',
            transform: design.nameBox.offsetY
              ? `translateY(${design.nameBox.offsetY}cqh)`
              : undefined,
          }}
        >
          신랑 {groomName} · 신부 {brideName}
        </p>
      )}

      {/* 5) 날짜 — 이름 바로 아래 + offsetY 로 미세 조정 */}
      {design.dateBox.enabled && weddingDate && (
        <p
          className="shrink-0 tracking-[0.2em]"
          style={{
            fontFamily: PLAYFAIR,
            fontSize: `${design.dateBox.fontSize}px`,
            marginTop: '0.8cqh',
            transform: design.dateBox.offsetY
              ? `translateY(${design.dateBox.offsetY}cqh)`
              : undefined,
          }}
        >
          {formatDateForIllust(weddingDate)}
        </p>
      )}

      {/* 6) 하단 spacer — 인사말 길이와 무관하게 축하하기 자리를 비워둠 */}
      <div style={{ flex: '1 1 0', minHeight: '6cqh' }} />

      {/* 7) 하단 축하하기 버튼 — absolute 로 위치 고정 */}
      <div className="absolute bottom-0 left-1/2 z-20 -translate-x-1/2" style={{ marginBottom: '4cqh' }}>
        <button
          type="button"
          onClick={onCelebrate}
          className="inline-flex items-center gap-1.5 text-xs font-medium opacity-70 transition-opacity hover:opacity-100"
        >
          <span className="underline underline-offset-4">축하하기</span>
          <span aria-hidden className="text-base leading-none">🎉</span>
        </button>
      </div>

      <Confetti trigger={confettiTrigger} scoped={scoped} />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// 일러스트 하단 디바이더 — 가는 라인 + 가운데 작은 다이아 글리프
// ─────────────────────────────────────────────────────────────

function IllustDivider() {
  // 가로폭은 화면의 절반 이하 — 이미지·이름과 자연스럽게 어울리도록 컨테이너 width 의 약 40%.
  return (
    <div
      aria-hidden
      className="flex shrink-0 items-center justify-center gap-2 opacity-60"
      style={{ marginTop: '1.8cqh', width: 'min(40%, 9rem)' }}
    >
      <span className="h-px flex-1 bg-current" style={{ opacity: 0.55 }} />
      <span className="text-[0.85em] leading-none">✦</span>
      <span className="h-px flex-1 bg-current" style={{ opacity: 0.55 }} />
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
  variant: 'arch' | 'dance';
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

// 날짜만 표시 — 요일/시간은 사용자 요청으로 제거. YYYY. MM. DD 형식.
function formatDateForIllust(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}`;
}

function LegacyMainSlide({
  main,
  groomName,
  brideName,
  weddingDate,
  onCelebrate,
  confettiTrigger,
  scoped,
}: PosterProps) {
  const layout = main.layout ?? 'poster';
  const hasImage = !!main.heroImage;
  const overlay = layout === 'poster' && hasImage;

  return (
    <section className="relative flex h-full min-h-full items-center justify-center px-6 py-10 text-center">
      {overlay && (
        <>
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
        {layout === 'text' && (
          <p className="text-xs uppercase tracking-[0.4em] opacity-70">— Save the Date —</p>
        )}

        {layout === 'polaroid' && (
          // 직각 모서리(rounded-none), 사진 크기 확대(h-80 w-64),
          // 하단 신랑·신부 이름은 사용자 요청으로 제거.
          <div className="relative rotate-[-3deg] rounded-none bg-white p-3 pb-3 shadow-xl">
            {hasImage ? (
              <img src={main.heroImage!} alt="" className="h-80 w-64 object-cover" />
            ) : (
              <div className="grid h-80 w-64 place-items-center bg-gradient-br from-stone-200 to-stone-300 text-3xl text-stone-400">
                📷
              </div>
            )}
          </div>
        )}
        {layout === 'illustration' && <CoupleIllustration />}

        {layout === 'text' ? (
          <h1 className="flex flex-col items-center gap-3 text-4xl font-light leading-tight">
            <span>{groomName}</span>
            <span className="h-px w-12 bg-current opacity-50" />
            <span>{brideName}</span>
          </h1>
        ) : layout === 'illustration' ? (
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

      <div className="absolute bottom-12 left-1/2 z-20 flex w-full -translate-x-1/2 flex-col items-center gap-4 px-10">
        <button
          type="button"
          onClick={onCelebrate}
          className="inline-flex items-center gap-1.5 text-xs font-medium opacity-60 transition-opacity hover:opacity-100"
          style={{ color: overlay ? 'white' : 'inherit' }}
        >
          <span className="underline underline-offset-4">축하하기</span>
          <span aria-hidden className="text-base leading-none">🎉</span>
        </button>
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

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────
// 액자프레임 (폴라로이드 / 하트 / 스크린) — 같은 디자인 컨트롤(FrameDesign) 공유,
// variant 별로 이미지 프레임만 다르게 렌더한다.
// ─────────────────────────────────────────────────────────────

type FrameVariant = 'polaroid' | 'heart' | 'screen';

interface FrameProps {
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
}: FrameProps) {
  const design: FrameDesign = main.frameDesign ?? FrameDesignSchema.parse(undefined);
  const variant: FrameVariant = design.variant;
  const titleFont = TITLE_FONT_OPTIONS[design.title.font].family;
  const titleColor = design.title.color || 'currentColor';
  const isScreen = variant === 'screen';
  const imagePos = design.imagePosition ?? { x: 50, y: 50 };

  return (
    // 스크린 변형은 letterbox 효과를 위해 슬라이드 전체에 어두운 배경을 깐다.
    <section
      className={`relative flex h-full min-h-full w-full flex-col items-center overflow-hidden text-center ${
        isScreen ? 'text-white' : ''
      }`}
      style={isScreen ? { backgroundColor: '#0F0F12' } : undefined}
    >
      {/* 1) 상단 영역 — 제목 + 인사말. 이미지 위쪽에서 자라고 길어지면 위로 잘림. */}
      <div
        className="flex w-full flex-col items-center justify-end overflow-hidden px-6"
        style={{ flex: '1 1 0', minHeight: 0, paddingTop: '4cqh', paddingBottom: '2cqh' }}
      >
        {design.title.enabled && design.title.text && (
          <h1
            className="font-bold leading-tight"
            style={{
              fontFamily: titleFont,
              color: titleColor,
              fontSize: `${design.title.fontSize}px`,
              transform: design.title.offsetY ? `translateY(${design.title.offsetY}cqh)` : undefined,
            }}
          >
            {design.title.text}
          </h1>
        )}

        {design.messageBox.enabled && main.greeting && (
          <p
            className="max-w-md whitespace-pre-line leading-relaxed opacity-80"
            style={{
              fontSize: `${design.messageBox.fontSize}px`,
              marginTop: '1.4cqh',
              transform: design.messageBox.offsetY
                ? `translateY(${design.messageBox.offsetY}cqh)`
                : undefined,
            }}
          >
            {main.greeting}
          </p>
        )}
      </div>

      {/* 2) 액자 이미지 — variant 별로 모양만 달라짐. 잘리는 변형은 imagePosition 으로 보일 영역 선택. */}
      <FrameImage variant={variant} src={main.heroImage ?? null} imagePosition={imagePos} />

      {/* 3) 이름 — 이미지 아래 살짝 띄움 */}
      {design.nameBox.enabled && (
        <p
          className="shrink-0 font-light tracking-wide"
          style={{
            fontSize: `${design.nameBox.fontSize}px`,
            marginTop: '2.2cqh',
            transform: design.nameBox.offsetY
              ? `translateY(${design.nameBox.offsetY}cqh)`
              : undefined,
          }}
        >
          {groomName} <span className="opacity-60">&amp;</span> {brideName}
        </p>
      )}

      {/* 4) 날짜 — 이름 바로 아래 */}
      {design.dateBox.enabled && weddingDate && (
        <p
          className="shrink-0 tracking-[0.2em] opacity-90"
          style={{
            fontSize: `${design.dateBox.fontSize}px`,
            marginTop: '0.8cqh',
            transform: design.dateBox.offsetY
              ? `translateY(${design.dateBox.offsetY}cqh)`
              : undefined,
          }}
        >
          {formatDate(weddingDate)}
        </p>
      )}

      {/* 5) 하단 spacer */}
      <div style={{ flex: '1 1 0', minHeight: '5cqh' }} />

      {/* 6) 축하하기 버튼 — absolute 로 고정 */}
      <div className="absolute bottom-0 left-1/2 z-20 -translate-x-1/2" style={{ marginBottom: '4cqh' }}>
        <button
          type="button"
          onClick={onCelebrate}
          className="inline-flex items-center gap-1.5 text-xs font-medium opacity-70 transition-opacity hover:opacity-100"
        >
          <span className="underline underline-offset-4">축하하기</span>
          <span aria-hidden className="text-base leading-none">🎉</span>
        </button>
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
}: {
  variant: FrameVariant;
  src: string | null;
  imagePosition: { x: number; y: number };
}) {
  const objectPos = `${imagePosition.x}% ${imagePosition.y}%`;

  if (variant === 'polaroid') {
    // 흰 테두리 + 살짝 기울임. 그림자로 입체감.
    return (
      <div className="shrink-0 rotate-[-3deg] bg-white p-3 pb-8 shadow-xl">
        <div className="flex h-[34cqh] w-[60cqw] max-w-[16rem] items-center justify-center overflow-hidden bg-stone-100">
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

  if (variant === 'heart') {
    // 하트 모양 클립 + 외곽 그림자.
    // SVG image 의 보일 영역 선택은 viewBox 좌표 ↔ 이미지 좌표를 직접 매핑할
    // 수 없어 SVG mask + foreignObject 가 복잡함. 대신 div + clipPath:
    // <div clip-path:path('...') overflow:hidden> 안에 일반 <img> 로 렌더해
    // object-position 을 그대로 활용한다. 이렇게 하면 imagePosition 슬라이더가
    // 폴라로이드와 동일하게 동작한다.
    const heartPath =
      "path('M50 85 C 40 75, 10 55, 10 32 C 10 18, 22 8, 32 8 C 40 8, 46 12, 50 18 C 54 12, 60 8, 68 8 C 78 8, 90 18, 90 32 C 90 55, 60 75, 50 85 Z')";
    return (
      <div
        className="relative shrink-0 overflow-hidden bg-stone-100"
        style={{
          width: 'min(60cqw, 16rem)',
          aspectRatio: '100 / 90',
          clipPath: heartPath,
          WebkitClipPath: heartPath,
          // SVG viewBox 가 100×90 이라 컨테이너도 10:9 비율로 맞춤.
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
          <div className="grid h-full w-full place-items-center text-3xl text-stone-400">💗</div>
        )}
      </div>
    );
  }

  // screen — 영화관 스크린. 정사각형 비율 + object-contain 으로 좌우가 잘리지
  // 않게 채우고, 작은 이미지는 컨테이너에 맞춰 확대된다 (img 기본 동작).
  // 비어 있는 위/아래(또는 좌/우) 영역은 컨테이너 검정 배경이 letterbox 처럼 보임.
  return (
    <div className="flex w-full shrink-0 items-center justify-center" style={{ paddingInline: '4cqw' }}>
      <div
        className="relative w-full max-w-sm overflow-hidden bg-black"
        style={{
          aspectRatio: '1 / 1',
          boxShadow:
            '0 0 0 1px rgba(255,255,255,0.08), 0 12px 30px rgba(0,0,0,0.55)',
        }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-full w-full object-contain" />
        ) : (
          <div className="grid h-full w-full place-items-center text-3xl text-white/40">🎬</div>
        )}
      </div>
    </div>
  );
}
