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
    <section className="relative flex h-full min-h-full w-full flex-col items-center overflow-y-auto px-6 pb-20 pt-12">
      {/* 제목 — Playfair Display 고정, 굵은 굵기 */}
      <h1
        className="text-center font-bold leading-tight"
        style={{
          fontFamily: PLAYFAIR,
          color: titleColor,
          fontSize: 'clamp(32px, 8vw, 48px)',
        }}
      >
        {design.title.text}
      </h1>

      {/* 메시지 (부제 위치) */}
      {main.greeting && (
        <p
          className="mt-3 max-w-md whitespace-pre-line text-center text-sm leading-relaxed opacity-80 md:text-base"
          style={{ fontFamily: 'inherit' }}
        >
          {main.greeting}
        </p>
      )}

      {/* 일러스트 — public/illustrations/ 의 PNG 를 그대로 사용.
          --mw-illust-filter / --mw-illust-blend 로 다크 테마 대응. */}
      <div className="my-6 w-full max-w-md flex-1">
        <IllustrationImage src={illustSrc} variant={design.variant} />
      </div>

      {/* 작은 장식 디바이더 */}
      <Divider />

      {/* 이름 박스 */}
      {design.nameBox.enabled && (
        <p
          className="mt-3 text-center text-base font-light tracking-wide"
          style={{ fontFamily: 'inherit' }}
        >
          신랑 {groomName} · 신부 {brideName}
        </p>
      )}

      {/* 디바이더 (이름·날짜 사이) */}
      {design.nameBox.enabled && design.dateBox.enabled && weddingDate && (
        <Divider className="mt-3" />
      )}

      {/* 날짜 박스 */}
      {design.dateBox.enabled && weddingDate && (
        <div className="mt-3 text-center">
          <p className="text-sm tracking-[0.2em]" style={{ fontFamily: PLAYFAIR }}>
            {formatDateForIllust(weddingDate)}
          </p>
          <p className="mt-1 text-xs tracking-[0.2em] opacity-70" style={{ fontFamily: PLAYFAIR }}>
            {formatTimeForIllust(weddingDate)}
          </p>
        </div>
      )}

      {/* 하단 축하하기 버튼 */}
      <div className="mt-6 flex flex-col items-center">
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
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt=""
      className="mx-auto block h-auto w-full select-none"
      style={{
        filter: 'var(--mw-illust-filter, none)',
        mixBlendMode: 'var(--mw-illust-blend, normal)' as React.CSSProperties['mixBlendMode'],
      }}
      onError={() => setErrored(true)}
      draggable={false}
    />
  );
}

function Divider({ className }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center gap-2 opacity-60 ${className ?? ''}`}
      aria-hidden
    >
      <span className="h-px w-12 bg-current" />
      <span className="text-xs">❀</span>
      <span className="h-px w-12 bg-current" />
    </div>
  );
}

function formatDateForIllust(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')} ${days[d.getDay()]}`;
}

function formatTimeForIllust(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  // 시간 정보가 자정(00:00) 이면 표시 생략 — 데이터에 시간이 안 들어 있는 경우.
  if (hours === 0 && d.getMinutes() === 0) return '';
  const period = hours < 12 ? 'AM' : 'PM';
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${period} ${h12}:${minutes}`;
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
          <div className="relative rotate-[-3deg] rounded-sm bg-white p-3 pb-10 shadow-xl">
            {hasImage ? (
              <img src={main.heroImage!} alt="" className="h-56 w-48 object-cover" />
            ) : (
              <div className="grid h-56 w-48 place-items-center bg-gradient-br from-stone-200 to-stone-300 text-3xl text-stone-400">
                📷
              </div>
            )}
            <p
              className="absolute bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-sm text-stone-700"
              style={{ fontFamily: "'Gaegu', cursive" }}
            >
              {groomName} ♥ {brideName}
            </p>
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
