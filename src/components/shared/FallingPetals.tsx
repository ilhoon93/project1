'use client';

import { useMemo } from 'react';

const PETAL_COUNT = 14;
const COLORS = ['#F4D9D0', '#E8C2B8', '#F1E0D6', '#D4B5A0'];

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

/**
 * Decorative falling petals overlay. Pointer-events:none so it never
 * blocks slide interaction. Animations are pure CSS — no JS RAF loop.
 *
 * Note: petal positions are seeded once on mount. They differ between
 * server and client render but the component is client-only so there's
 * no hydration mismatch.
 */
export function FallingPetals({ count = PETAL_COUNT }: { count?: number }) {
  const petals = useMemo<Petal[]>(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 10 + Math.random() * 14,
        delay: Math.random() * 12,
        duration: 9 + Math.random() * 7,
        drift: -40 + Math.random() * 80,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotate: Math.random() * 360,
      })),
    [count],
  );

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
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            // CSS custom prop consumed by the @keyframes
            ['--drift' as never]: `${p.drift}px`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}

      <style jsx>{`
        .petal {
          position: absolute;
          top: -24px;
          border-radius: 80% 0 80% 0;
          opacity: 0.75;
          animation-name: fall;
          animation-iteration-count: infinite;
          animation-timing-function: linear;
          will-change: transform;
        }
        @keyframes fall {
          0% {
            transform: translate3d(0, -40px, 0) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 0.8;
          }
          100% {
            transform: translate3d(var(--drift), 110vh, 0) rotate(540deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
