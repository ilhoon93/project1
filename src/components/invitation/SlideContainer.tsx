'use client';

import { useState, type ReactNode } from 'react';
import { motion, type PanInfo } from 'framer-motion';
import { FallingPetals } from '@/components/shared/FallingPetals';
import {
  FONT_OPTIONS,
  THEME_PALETTES,
  type ColorTheme,
  type FontKey,
  type PetalType,
} from '@/lib/theme';

const SWIPE_THRESHOLD = 60;

interface Props {
  children: ReactNode[];
  colorTheme?: ColorTheme;
  petalType?: PetalType;
  font?: FontKey;
}

export function SlideContainer({
  children,
  colorTheme = 'cream',
  petalType = 'flower',
  font = 'serif',
}: Props) {
  const slides = children.filter(Boolean);
  const [index, setIndex] = useState(0);
  const palette = THEME_PALETTES[colorTheme];
  const fontFamily = FONT_OPTIONS[font].family;

  const next = () => setIndex((i) => Math.min(i + 1, slides.length - 1));
  const prev = () => setIndex((i) => Math.max(i - 1, 0));

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE_THRESHOLD) next();
    else if (info.offset.x > SWIPE_THRESHOLD) prev();
  };

  return (
    <div
      className="relative h-[100dvh] w-screen overflow-hidden"
      style={{ backgroundColor: palette.bg, color: palette.fg, fontFamily }}
    >
      <FallingPetals type={petalType} colors={palette.petals} />

      <motion.div
        className="flex h-full"
        animate={{ x: `-${index * 100}vw` }}
        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={onDragEnd}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            className="relative h-full w-screen flex-shrink-0 overflow-y-auto"
          >
            {slide}
          </div>
        ))}
      </motion.div>

      {/* dot indicator */}
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

      {/* prev/next chevrons */}
      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-between px-2 md:px-4">
        <button
          type="button"
          onClick={prev}
          disabled={index === 0}
          aria-label="이전"
          className="pointer-events-auto grid h-9 w-9 place-items-center rounded-full bg-white/70 text-lg shadow disabled:opacity-30 md:h-10 md:w-10"
          style={{ color: palette.accent }}
        >
          ‹
        </button>
        <button
          type="button"
          onClick={next}
          disabled={index === slides.length - 1}
          aria-label="다음"
          className="pointer-events-auto grid h-9 w-9 place-items-center rounded-full bg-white/70 text-lg shadow disabled:opacity-30 md:h-10 md:w-10"
          style={{ color: palette.accent }}
        >
          ›
        </button>
      </div>
    </div>
  );
}
