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
  onEnter?: () => void;
}

export function MainSlide({ groomName, brideName, weddingDate, main, onEnter }: Props) {
  const [confettiTrigger, setConfettiTrigger] = useState<number | null>(null);

  const handleEnter = () => {
    openSignatureGate();
    onEnter?.();
  };

  const handleCelebrate = () => setConfettiTrigger(Date.now());

  const layout = main.layout ?? 'poster';
  const hasImage = !!main.heroImage;
  const overlay = layout === 'poster' && hasImage;

  return (
    <section className="relative flex min-h-full items-center justify-center px-6 py-10 text-center">
      {/* 배경 */}
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

      {/* 메인 컨텐츠 (절대 수정 안함) */}
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

        {/* 폴라로이드 */}
        {layout === 'polaroid' && (
          <div className="relative rotate-[-3deg] rounded-sm bg-white p-3 pb-10 shadow-xl">
            {hasImage ? (
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

        {/* 일러스트 */}
        {layout === 'illustration' && <CoupleIllustration />}

        {/* 이름 */}
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
          <h1 className="flex flex-col items-center gap-2 text-3xl font-light">
            <span>{groomName}</span>
            <span className="text-base opacity-60">·</span>
            <span>{brideName}</span>
          </h1>
        ) : null}

        {/* 날짜 */}
        {weddingDate && (
          <p className={`text-sm tracking-widest ${overlay ? 'text-white/90' : 'opacity-80'}`}>
            {formatDate(weddingDate)}
          </p>
        )}

        {/* 인사말 */}
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

      {/* 하단 그라데이션 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/50 to-transparent" />

      {/* CTA (위치 살짝 내림) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-10 z-20 flex flex-col items-center gap-2 px-6">
        <button
          type="button"
          onClick={handleEnter}
          className="pointer-events-auto w-full max-w-xs rounded-full bg-white py-3 text-sm font-semibold text-[#3D2E1F] shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.97]"
        >
          입장하기
        </button>

        <button
          type="button"
          onClick={handleCelebrate}
          className={`pointer-events-auto text-xs underline underline-offset-4 ${
            overlay ? 'text-white/80 hover:text-white' : 'text-gray-600 hover:text-black'
          }`}
        >
          축하하기 🎉
        </button>
      </div>

      <Confetti trigger={confettiTrigger} />
    </section>
  );
}

function CoupleIllustration() {
  return (
    <svg viewBox="0 0 160 140" width="140" height="120" className="opacity-90">
      <g fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="55" cy="42" r="14" />
        <circle cx="105" cy="42" r="14" />
      </g>
    </svg>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}`;
}