'use client';

import { useState } from 'react';
import type { InvitationContent } from '@/types/invitation';
import { Confetti } from '@/components/shared/Confetti';
import { openSignatureGate } from '../SignatureGate';

interface Props {
  groomName: string;
  brideName: string;
  weddingDate: string | null;
  main: InvitationContent['main'];
}

/**
 * Main slide. All four layouts share the same outer wrapper that vertically
 * centers ONE tight content stack (header → visual → names → date → greeting
 * → buttons). Keeping the buttons inside the same flex group prevents the
 * "half empty bottom" effect that appears when buttons are pinned to the
 * bottom of a tall section.
 */
export function MainSlide({ groomName, brideName, weddingDate, main }: Props) {
  const [confettiTrigger, setConfettiTrigger] = useState<number | null>(null);

  const handleEnter = () => {
    openSignatureGate();
  };
  const handleCelebrate = () => setConfettiTrigger(Date.now());

  const layout = main.layout ?? 'poster';
  const hasImage = !!main.heroImage;
  const overlay = layout === 'poster' && hasImage;

  return (
    <section className="relative flex min-h-full items-center justify-center px-6 py-10 text-center">
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
        className={`relative z-10 flex w-full max-w-md flex-col items-center gap-4 ${
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
              // eslint-disable-next-line @next/next/no-img-element
              <img src={main.heroImage!} alt="" className="h-56 w-48 object-cover" />
            ) : (
              <div className="grid h-56 w-48 place-items-center bg-gradient-to-br from-stone-200 to-stone-300 text-3xl text-stone-400">
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
        ) : null /* polaroid puts names in the frame caption */}

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

        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={handleEnter}
            className="rounded-full bg-white/85 px-5 py-2 text-xs font-medium text-[#3D2E1F] shadow-sm backdrop-blur-sm transition-colors hover:bg-white"
          >
            입장하기
          </button>
          <button
            type="button"
            onClick={handleCelebrate}
            className="rounded-full border border-current/40 bg-transparent px-5 py-2 text-xs font-medium text-current backdrop-blur-sm transition-colors hover:bg-current/10"
          >
            축하하기 🎉
          </button>
        </div>
      </div>

      <Confetti trigger={confettiTrigger} />
    </section>
  );
}

function CoupleIllustration() {
  return (
    <svg
      viewBox="0 0 160 140"
      width="140"
      height="120"
      aria-hidden
      className="opacity-90"
    >
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
