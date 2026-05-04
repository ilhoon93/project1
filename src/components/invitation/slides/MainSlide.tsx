'use client';

import { useState } from 'react';
import {
  PosterDesignSchema,
  type InvitationContent,
  type PosterDesign,
} from '@/types/invitation';
import { TITLE_FONT_OPTIONS } from '@/lib/theme';
import { Confetti } from '@/components/shared/Confetti';

interface Props {
  groomName: string;
  brideName: string;
  weddingDate: string | null;
  main: InvitationContent['main'];
}

export function MainSlide({ groomName, brideName, weddingDate, main }: Props) {
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
      />
    );
  }

  // 풀이미지가 아닐 때 — 기존 레이아웃 그대로 유지.
  return (
    <LegacyMainSlide
      main={main}
      groomName={groomName}
      brideName={brideName}
      weddingDate={weddingDate}
      onCelebrate={handleCelebrate}
      confettiTrigger={confettiTrigger}
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
}

function PosterFullImageSlide({
  main,
  groomName,
  brideName,
  weddingDate,
  onCelebrate,
  confettiTrigger,
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

      {/* 1-a) 하단 그라데이션 — 테마 배경색에 맞춰 페이드 */}
      {design.effects.gradient && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
          style={{
            backgroundImage:
              'linear-gradient(to bottom, transparent 0%, var(--mw-bg, rgba(0,0,0,0.6)) 100%)',
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
          className={`whitespace-pre-wrap text-center font-light leading-snug ${
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
      <div className="absolute bottom-20 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center">
        <button
          type="button"
          onClick={onCelebrate}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-white opacity-80 transition-opacity hover:opacity-100"
        >
          <span className="underline underline-offset-4">축하하기</span>
          <span aria-hidden className="text-base leading-none">🎉</span>
        </button>
      </div>

      <Confetti trigger={confettiTrigger} />

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

function LegacyMainSlide({
  main,
  groomName,
  brideName,
  weddingDate,
  onCelebrate,
  confettiTrigger,
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

      <div className="absolute bottom-20 left-1/2 z-20 flex w-full -translate-x-1/2 flex-col items-center gap-4 px-10">
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

      <Confetti trigger={confettiTrigger} />
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
