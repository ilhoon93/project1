'use client';

import { useState } from 'react';
import {
  IllustrationDesignSchema,
  PosterDesignSchema,
  type InvitationContent,
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

  // 그 외 (polaroid / text / 이미지 없는 poster) — 기존 레이아웃 그대로 유지.
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

  return (
    <section className="relative h-full min-h-full w-full overflow-hidden text-white">
      {/* 배경 이미지 */}
      <img
        src={main.heroImage!}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* 가독성 확보용 살짝의 어두운 오버레이 */}
      <div className="absolute inset-0 bg-black/25" />

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

      {/* 5) 메시지 박스 — 인사말 */}
      {main.greeting && (
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
    // overflow-hidden + 압축된 vertical spacing 으로 세로 스크롤 발생 방지.
    // 폰트/패딩 단위는 cqw/cqh — 모바일 풀스크린과 데스크톱 미리보기 패널이
    // 비율적으로 동일하게 보이도록 컨테이너 기준 단위로 통일.
    <section
      className="relative flex h-full min-h-full w-full flex-col items-center overflow-hidden text-center"
      style={{ padding: '5cqh 6cqw 4cqh' }}
    >
      {/* 제목 — Playfair Display, 굵은 굵기, cqw 기반 사이즈 */}
      <h1
        className="font-bold leading-tight"
        style={{
          fontFamily: PLAYFAIR,
          color: titleColor,
          fontSize: 'clamp(28px, 9cqw, 44px)',
        }}
      >
        {design.title.text}
      </h1>

      {/* 메시지 (부제 위치) */}
      {main.greeting && (
        <p
          className="max-w-md whitespace-pre-line leading-relaxed opacity-80"
          style={{
            fontFamily: 'inherit',
            fontSize: 'clamp(12px, 3.6cqw, 16px)',
            marginTop: '1.5cqh',
          }}
        >
          {main.greeting}
        </p>
      )}

      {/* 일러스트 — public/illustrations/ 의 PNG 를 그대로 사용.
          --mw-illust-filter / --mw-illust-blend 로 테마 대응. flex-1 으로
          남는 공간 차지하면서도 max-w-md 로 무한 확장은 막는다. */}
      <div
        className="flex w-full max-w-md flex-1 items-center justify-center"
        style={{ marginTop: '2cqh', marginBottom: '2cqh', minHeight: 0 }}
      >
        <IllustrationImage src={illustSrc} variant={design.variant} />
      </div>

      {/* 이름 박스 */}
      {design.nameBox.enabled && (
        <p
          className="font-light tracking-wide"
          style={{
            fontFamily: 'inherit',
            fontSize: 'clamp(14px, 4cqw, 18px)',
          }}
        >
          신랑 {groomName} · 신부 {brideName}
        </p>
      )}

      {/* 날짜 박스 — 요일/시간은 표기 안 함 (사용자 요청) */}
      {design.dateBox.enabled && weddingDate && (
        <p
          className="tracking-[0.2em]"
          style={{
            fontFamily: PLAYFAIR,
            fontSize: 'clamp(13px, 3.8cqw, 17px)',
            marginTop: '1.2cqh',
          }}
        >
          {formatDateForIllust(weddingDate)}
        </p>
      )}

      {/* 하단 축하하기 버튼 */}
      <div style={{ marginTop: '1.8cqh' }} className="flex flex-col items-center">
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
