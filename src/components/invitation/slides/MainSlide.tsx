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
  onEnter?: () => void; // optional (없어도 문제 없음)
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
    <section className="relative flex h-[100dvh] items-center justify-center px-6 py-10 text-center">
      {/* 배경 이미지 */}
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

      {/* 메인 컨텐츠 */}
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

        {layout === 'text' ? (
          <h1 className="flex flex-col items-center gap-3 text-4xl font-light leading-tight">
            <span>{groomName}</span>
            <span className="h-px w-12 bg-current opacity-50" />
            <span>{brideName}</span>
          </h1>
        ) : (
          <h1 className={`flex flex-col items-center gap-2 text-3xl font-light`}>
            <span>{groomName}</span>
            <span className="text-base opacity-60">·</span>
            <span>{brideName}</span>
          </h1>
        )}

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

      {/* 👇 그라데이션 (가독성 강화) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/50 to-transparent" />

      {/* 👇 CTA 영역 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-8 z-20 flex flex-col items-center gap-3 px-6">
        {/* 입장하기 (메인 CTA) */}
        <button
          type="button"
          onClick={handleEnter}
          className="pointer-events-auto w-full max-w-sm rounded-full bg-white py-4 text-base font-semibold text-[#3D2E1F] shadow-lg backdrop-blur-md transition-all duration-300 hover:scale-[1.02] active:scale-[0.97]"
        >
          입장하기
        </button>

        {/* 축하하기 (서브 CTA) */}
        <button
          type="button"
          onClick={handleCelebrate}
          className={`pointer-events-auto text-xs underline underline-offset-4 transition-opacity ${
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

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}`;
}