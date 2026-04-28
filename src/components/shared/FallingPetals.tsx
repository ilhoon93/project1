'use client';

import { useMemo } from 'react';
import { PETAL_GLYPHS, type PetalType } from '@/lib/theme';

const PETAL_COUNT = 14;
const DEFAULT_COLORS = ['#F4D9D0', '#E8C2B8', '#F1E0D6', '#D4B5A0'];

interface Petal {
  id: number;
  left: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  color: string;
  rotate: number;
}

interface Props {
  count?: number;
  type?: PetalType;
  colors?: readonly string[];
}

/**
 * Decorative falling overlay. Pointer-events:none so it never blocks slide
 * interaction. Glyph and palette come from the active theme.
 */
export function FallingPetals({
  count = PETAL_COUNT,
  type = 'flower',
  colors = DEFAULT_COLORS,
}: Props) {
  const palette = colors.length > 0 ? colors : DEFAULT_COLORS;
  const petals = useMemo<Petal[]>(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 14 + Math.random() * 16,
        delay: Math.random() * 12,
        duration: 9 + Math.random() * 7,
        drift: -40 + Math.random() * 80,
        color: palette[Math.floor(Math.random() * palette.length)],
        rotate: Math.random() * 360,
      })),
    [count, palette],
  );

  if (type === 'none') return null;
  const glyph = PETAL_GLYPHS[type];

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
    >
      {petals.map((p) => (
        <span
          key={p.id}
          className="petal"
          style={{
            left: `${p.left}%`,
            fontSize: `${p.size}px`,
            color: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ['--drift' as never]: `${p.drift}px`,
            ['--rotate-start' as never]: `${p.rotate}deg`,
          }}
        >
          {glyph}
        </span>
      ))}

      <style jsx>{`
        .petal {
          position: absolute;
          top: -32px;
          line-height: 1;
          opacity: 0.85;
          animation-name: fall;
          animation-iteration-count: infinite;
          animation-timing-function: linear;
          will-change: transform;
        }
        @keyframes fall {
          0% {
            transform: translate3d(0, -40px, 0) rotate(var(--rotate-start));
            opacity: 0;
          }
          10% {
            opacity: 0.9;
          }
          100% {
            transform: translate3d(var(--drift), 110vh, 0)
              rotate(calc(var(--rotate-start) + 540deg));
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
