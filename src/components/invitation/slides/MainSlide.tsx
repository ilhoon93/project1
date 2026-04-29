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

export function MainSlide({ groomName, brideName, weddingDate, main }: Props) {
  const [confettiTrigger, setConfettiTrigger] = useState<number | null>(null);

  const handleEnter = () => {
    // Works in both preview and live; SignatureGate's submit is a no-op in
    // preview so the author can verify the popup appears.
    openSignatureGate();
  };
  const handleCelebrate = () => setConfettiTrigger(Date.now());

  const layout = main.layout ?? 'poster';

  const buttons = (
    <div className="relative z-10 flex flex-wrap items-center justify-center gap-2">
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
        className="rounded-full border border-white/70 bg-transparent px-5 py-2 text-xs font-medium text-current backdrop-blur-sm transition-colors hover:bg-white/20"
      >
        축하하기 🎉
      </button>
    </div>
  );

  return (
    <>
      {layout === 'poster' && (
        <PosterLayout
          groomName={groomName}
          brideName={brideName}
          weddingDate={weddingDate}
          main={main}
          buttons={buttons}
        />
      )}
      {layout === 'polaroid' && (
        <PolaroidLayout
          groomName={groomName}
          brideName={brideName}
          weddingDate={weddingDate}
          main={main}
          buttons={buttons}
        />
      )}
      {layout === 'illustration' && (
        <IllustrationLayout
          groomName={groomName}
          brideName={brideName}
          weddingDate={weddingDate}
          main={main}
          buttons={buttons}
        />
      )}
      {layout === 'text' && (
        <TextLayout
          groomName={groomName}
          brideName={brideName}
          weddingDate={weddingDate}
          main={main}
          buttons={buttons}
        />
      )}
      <Confetti trigger={confettiTrigger} />
    </>
  );
}

interface LayoutProps {
  groomName: string;
  brideName: string;
  weddingDate: string | null;
  main: InvitationContent['main'];
  buttons: React.ReactNode;
}

function PosterLayout({ groomName, brideName, weddingDate, main, buttons }: LayoutProps) {
  const hasImage = !!main.heroImage;
  return (
    <section className="relative flex min-h-full flex-col items-center justify-center gap-10 px-6 py-12 text-center">
      {hasImage && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={main.heroImage!}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/30" />
        </>
      )}

      <p className={`relative z-10 text-sm tracking-[0.3em] ${hasImage ? 'text-white/90' : 'opacity-70'}`}>
        OUR WEDDING
      </p>

      <div className="relative z-10 flex flex-col items-center gap-5">
        <h1
          className={`flex flex-col items-center gap-2 text-3xl font-light ${
            hasImage ? 'text-white' : ''
          }`}
        >
          <span>{groomName}</span>
          <span className={`text-base ${hasImage ? 'text-white/80' : 'opacity-70'}`}>·</span>
          <span>{brideName}</span>
        </h1>
        {weddingDate && (
          <p className={`text-sm tracking-widest ${hasImage ? 'text-white/90' : 'opacity-80'}`}>
            {formatDate(weddingDate)}
          </p>
        )}
        {main.greeting && (
          <p
            className={`max-w-md whitespace-pre-line text-sm leading-relaxed ${
              hasImage ? 'text-white/95' : 'opacity-90'
            }`}
          >
            {main.greeting}
          </p>
        )}
      </div>

      {buttons}
    </section>
  );
}

function PolaroidLayout({ groomName, brideName, weddingDate, main, buttons }: LayoutProps) {
  return (
    <section className="relative flex min-h-full flex-col items-center justify-center gap-8 px-6 py-12 text-center">
      <p className="text-xs uppercase tracking-[0.3em] opacity-70">Save the Date</p>

      <div className="relative rotate-[-3deg] rounded-sm bg-white p-3 pb-12 shadow-xl">
        {main.heroImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={main.heroImage}
            alt=""
            className="h-64 w-56 object-cover"
          />
        ) : (
          <div className="grid h-64 w-56 place-items-center bg-gradient-to-br from-stone-200 to-stone-300 text-3xl text-stone-400">
            📷
          </div>
        )}
        <p
          className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-sm text-stone-700"
          style={{ fontFamily: "'Gaegu', cursive" }}
        >
          {groomName} ♥ {brideName}
        </p>
      </div>

      {weddingDate && (
        <p className="text-sm tracking-widest opacity-80">{formatDate(weddingDate)}</p>
      )}

      {main.greeting && (
        <p className="max-w-md whitespace-pre-line text-sm leading-relaxed opacity-90">
          {main.greeting}
        </p>
      )}

      {buttons}
    </section>
  );
}

function IllustrationLayout({ groomName, brideName, weddingDate, main, buttons }: LayoutProps) {
  return (
    <section className="relative flex min-h-full flex-col items-center justify-center gap-7 px-6 py-12 text-center">
      <p className="text-xs uppercase tracking-[0.3em] opacity-70">Wedding Day</p>

      <CoupleIllustration />
      <h1 className="flex items-baseline gap-3 text-2xl font-light">
        <span>{groomName}</span>
        <span className="text-base opacity-60">&</span>
        <span>{brideName}</span>
      </h1>
      {weddingDate && (
        <p className="text-sm tracking-widest opacity-80">{formatDate(weddingDate)}</p>
      )}

      {main.greeting && (
        <p className="max-w-md whitespace-pre-line text-sm leading-relaxed opacity-90">
          {main.greeting}
        </p>
      )}

      {buttons}
    </section>
  );
}

function TextLayout({ groomName, brideName, weddingDate, main, buttons }: LayoutProps) {
  return (
    <section className="relative flex min-h-full flex-col items-center justify-center gap-10 px-6 py-12 text-center">
      <p className="text-xs uppercase tracking-[0.4em] opacity-70">— Save the Date —</p>

      <h1 className="flex flex-col items-center gap-3 text-4xl font-light leading-tight">
        <span>{groomName}</span>
        <span className="h-px w-12 bg-current opacity-50" />
        <span>{brideName}</span>
      </h1>
      {weddingDate && (
        <p className="text-base tracking-[0.25em] opacity-80">{formatDate(weddingDate)}</p>
      )}
      {main.greeting && (
        <p className="max-w-md whitespace-pre-line text-sm leading-relaxed opacity-90">
          {main.greeting}
        </p>
      )}

      {buttons}
    </section>
  );
}

function CoupleIllustration() {
  // Simple couple illustration — two stylized figures with a heart.
  return (
    <svg
      viewBox="0 0 160 140"
      width="160"
      height="140"
      aria-hidden
      className="opacity-90"
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {/* groom */}
        <circle cx="55" cy="42" r="14" />
        <path d="M55 56 L55 98 M55 70 L40 88 M55 70 L70 88 M55 98 L46 130 M55 98 L64 130" />
        {/* bride */}
        <circle cx="105" cy="42" r="14" />
        <path d="M105 56 L105 98 M105 70 L90 88 M105 70 L120 88" />
        <path d="M88 130 L88 100 Q105 95 122 100 L122 130 Z" />
        {/* heart */}
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
