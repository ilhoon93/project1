'use client';

import React, { useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { FallingPetals } from '@/components/shared/FallingPetals';
import { BgmPlayer } from './BgmPlayer';
import {
  FONT_OPTIONS,
  THEME_PALETTES,
  type ColorTheme,
  type FontKey,
  type PetalType,
} from '@/lib/theme';

const SWIPE_THRESHOLD = 50;
const VERTICAL_BIAS = 1.2;

interface Props {
  children: ReactNode[];
  colorTheme?: ColorTheme;
  petalType?: PetalType;
  font?: FontKey;
  bgmUrl?: string | null;
}

export function SlideContainer({
  children,
  colorTheme = 'cream',
  petalType = 'flower',
  font = 'serif',
  bgmUrl = null,
}: Props) {
  const slides = children.filter(Boolean);
  const [index, setIndex] = useState(0);
  const palette = THEME_PALETTES[colorTheme];
  const fontFamily = FONT_OPTIONS[font].family;

  const slidesLen = slides.length;
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const commitSwipe = (dx: number, dy: number) => {
    if (Math.abs(dy) > Math.abs(dx) * VERTICAL_BIAS) return;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;

    if (dx < 0) {
      setIndex((i) => Math.min(i + 1, slidesLen - 1));
    } else {
      setIndex((i) => Math.max(i - 1, 0));
    }
  };

  const goPrev = () => setIndex((i) => Math.max(i - 1, 0));
  const goNext = () => setIndex((i) => Math.min(i + 1, slidesLen - 1));

  const isInsideNoSwipe = (target: EventTarget | null) =>
    target instanceof Element && !!target.closest('[data-noswipe]');

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isInsideNoSwipe(e.target)) {
      startRef.current = null;
      return;
    }
    const t = e.touches[0];
    if (!t) return;
    startRef.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = startRef.current;
    startRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    if (!t) return;
    commitSwipe(t.clientX - start.x, t.clientY - start.y);
  };

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || isInsideNoSwipe(e.target)) return;
    startRef.current = { x: e.clientX, y: e.clientY };
    const onUp = (evt: MouseEvent) => {
      const start = startRef.current;
      startRef.current = null;
      window.removeEventListener('mouseup', onUp);
      if (!start) return;
      commitSwipe(evt.clientX - start.x, evt.clientY - start.y);
    };
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div
      className="relative h-[100dvh] w-screen overflow-hidden"
      style={{
        backgroundColor: palette.bg,
        color: palette.fg,
        fontFamily,
        // bgPattern은 background-image로 베이스 컬러 위에 얹는다.
        ...(palette.bgPattern
          ? {
              backgroundImage: palette.bgPattern,
              backgroundRepeat: 'repeat',
            }
          : {}),
      }}
    >
      <FallingPetals type={petalType} colors={palette.petals} />
      {bgmUrl && <BgmPlayer url={bgmUrl} color={palette.accent} />}

      <motion.div
        className="flex h-full"
        animate={{ x: `-${index * 100}vw` }}
        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => {
          startRef.current = null;
        }}
        onMouseDown={onMouseDown}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            className="relative h-full w-screen flex-shrink-0 touch-pan-y overflow-y-auto"
          >
            {slide}
          </div>
        ))}
      </motion.div>

      {/* 하단 점 표시 (인디케이터) */}
      <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`${i + 1}번 슬라이드로 이동`}
            className="pointer-events-auto h-1.5 rounded-full transition-all"
            style={{
              width: i === index ? 20 : 6,
              backgroundColor: i === index ? palette.accent : palette.dot,
            }}
          />
        ))}
      </div>

      {/* 좌우 화살표: 끝 위치에선 disabled:opacity-0 으로 자연스레 사라짐 */}
      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-between px-2 md:px-4">
        <button
          type="button"
          onClick={goPrev}
          disabled={index === 0}
          aria-label="이전"
          className="pointer-events-auto grid h-9 w-9 place-items-center bg-transparent text-lg disabled:opacity-0 md:h-10 md:w-10"
          style={{ color: palette.accent, background: 'transparent' }}
        >
          ‹
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={index === slides.length - 1}
          aria-label="다음"
          className="pointer-events-auto grid h-9 w-9 place-items-center bg-transparent text-lg disabled:opacity-0 md:h-10 md:w-10"
          style={{ color: palette.accent, background: 'transparent' }}
        >
          ›
        </button>
      </div>
    </div>
  );
}
