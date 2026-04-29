'use client';

import { useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { FallingPetals } from '@/components/shared/FallingPetals';
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
}

/**
 * Insta-style horizontal slide deck.
 *
 * Why this is implemented with raw touch+mouse events instead of
 * framer-motion's `drag`: dragConstraints + an animated `x` competed badly on
 * touch inside `overflow-y-auto`, and pointer events would sometimes never
 * fire `pointerup` once the browser claimed the gesture for scroll. Raw
 * touchstart/touchend always fires, even after a scroll, and the threshold +
 * vertical-bias check filters out scroll-only gestures.
 */
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

  const slidesLen = slides.length;
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const commitSwipe = (dx: number, dy: number) => {
    if (Math.abs(dy) > Math.abs(dx) * VERTICAL_BIAS) return;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    // Standard mobile / Instagram convention: swipe LEFT (finger moves right→left,
    // dx < 0) advances to the next slide; swipe RIGHT goes back.
    if (dx < 0) {
      setIndex((i) => Math.min(i + 1, slidesLen - 1));
    } else {
      setIndex((i) => Math.max(i - 1, 0));
    }
  };

  const goPrev = () => setIndex((i) => Math.max(i - 1, 0));
  const goNext = () => setIndex((i) => Math.min(i + 1, slidesLen - 1));

  // Skip swipe detection when the gesture starts inside something that owns
  // its own horizontal pan (e.g. the gallery's slide layout).
  const isInsideNoSwipe = (target: EventTarget | null) =>
    target instanceof Element && !!target.closest('[data-noswipe]');

  // ── touch handlers ─────────────────────────────────────────
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

  // ── mouse handlers (desktop) ──────────────────────────────
  // We attach the up handler to window so a release outside the slide row
  // still gets caught.
  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (isInsideNoSwipe(e.target)) return;
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
      style={{ backgroundColor: palette.bg, color: palette.fg, fontFamily }}
    >
      <FallingPetals type={petalType} colors={palette.petals} />

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
            // touch-pan-y lets the browser handle vertical scroll natively
            // while horizontal swipes bubble up to the touch handlers above.
            className="relative h-full w-screen flex-shrink-0 touch-pan-y overflow-y-auto"
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
          onClick={goPrev}
          disabled={index === 0}
          aria-label="이전"
          className="pointer-events-auto grid h-9 w-9 place-items-center rounded-full bg-white/15 text-lg backdrop-blur-sm transition-colors hover:bg-white/35 disabled:opacity-15 md:h-10 md:w-10"
          style={{ color: palette.accent }}
        >
          ‹
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={index === slides.length - 1}
          aria-label="다음"
          className="pointer-events-auto grid h-9 w-9 place-items-center rounded-full bg-white/15 text-lg backdrop-blur-sm transition-colors hover:bg-white/35 disabled:opacity-15 md:h-10 md:w-10"
          style={{ color: palette.accent }}
        >
          ›
        </button>
      </div>
    </div>
  );
}
