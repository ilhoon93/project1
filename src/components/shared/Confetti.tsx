'use client';

import { useEffect, useMemo, useState } from 'react';

const COLORS = ['#F4D9D0', '#E8C2B8', '#FFB6C1', '#D4B5A0', '#C9748E', '#FFD700', '#A8C5A1'];
const PIECE_COUNT = 70;
const FALL_DURATION_MIN_MS = 4500;
const FALL_DURATION_MAX_MS = 7000;
const STAGGER_MAX_MS = 1500;
// How long to keep the layer mounted after the trigger fires. Must comfortably
// outlast the slowest piece (start delay + fall duration).
const ACTIVE_MS = FALL_DURATION_MAX_MS + STAGGER_MAX_MS + 300;

interface Piece {
  id: number;
  left: number;
  delay: number;
  duration: number;
  drift: number;
  color: string;
  rotate: number;
  size: number;
  shape: 'rect' | 'circle';
}

/**
 * One-shot confetti that falls slowly from the top of the screen. Each new
 * `trigger` value (e.g. an incrementing counter) replays the burst.
 */
export function Confetti({ trigger }: { trigger: number | null }) {
  const [active, setActive] = useState(false);

  const pieces = useMemo<Piece[]>(() => {
    void trigger; // re-roll the random layout on each new trigger
    return Array.from({ length: PIECE_COUNT }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * STAGGER_MAX_MS,
      duration:
        FALL_DURATION_MIN_MS +
        Math.random() * (FALL_DURATION_MAX_MS - FALL_DURATION_MIN_MS),
      // Sideways drift while falling, in viewport-width units.
      drift: -8 + Math.random() * 16,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotate: Math.random() * 360,
      size: 6 + Math.random() * 8,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
    }));
  }, [trigger]);

  useEffect(() => {
    if (trigger == null) return;
    setActive(true);
    const t = setTimeout(() => setActive(false), ACTIVE_MS);
    return () => clearTimeout(t);
  }, [trigger]);

  if (!active || trigger == null) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
    >
      {pieces.map((p) => (
        <span
          key={`${trigger}-${p.id}`}
          className="confetti"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size * (p.shape === 'rect' ? 1.6 : 1)}px`,
            backgroundColor: p.color,
            borderRadius: p.shape === 'circle' ? '50%' : '2px',
            animationDelay: `${p.delay}ms`,
            animationDuration: `${p.duration}ms`,
            ['--drift' as never]: `${p.drift}vw`,
            ['--rotate-start' as never]: `${p.rotate}deg`,
          }}
        />
      ))}

      <style jsx>{`
        .confetti {
          position: absolute;
          /* Start just above the viewport so each piece appears to fall in. */
          top: -8%;
          opacity: 0;
          animation-name: drift-fall;
          animation-iteration-count: 1;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
          will-change: transform, opacity;
        }
        @keyframes drift-fall {
          0% {
            transform: translate3d(0, 0, 0) rotate(var(--rotate-start));
            opacity: 0;
          }
          5% {
            opacity: 1;
          }
          95% {
            opacity: 1;
          }
          100% {
            transform: translate3d(var(--drift), 115vh, 0)
              rotate(calc(var(--rotate-start) + 540deg));
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
