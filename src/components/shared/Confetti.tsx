'use client';

import { useEffect, useMemo, useState } from 'react';

const COLORS = ['#F4D9D0', '#E8C2B8', '#FFB6C1', '#D4B5A0', '#C9748E', '#FFD700', '#A8C5A1'];
const PIECE_COUNT = 60;
const DURATION_MS = 2200;

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
 * One-shot confetti burst. Renders nothing when `trigger` is null. Each new
 * trigger value (e.g. an incrementing counter) replays the burst.
 */
export function Confetti({ trigger }: { trigger: number | null }) {
  const [active, setActive] = useState(false);
  const pieces = useMemo<Piece[]>(() => {
    // depend on trigger so each new burst gets a fresh random layout
    void trigger;
    return Array.from({ length: PIECE_COUNT }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 200,
      duration: 1400 + Math.random() * 1200,
      drift: -120 + Math.random() * 240,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotate: Math.random() * 360,
      size: 6 + Math.random() * 8,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
    }));
  }, [trigger]);

  useEffect(() => {
    if (trigger == null) return;
    setActive(true);
    const t = setTimeout(() => setActive(false), DURATION_MS);
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
            ['--drift' as never]: `${p.drift}px`,
            ['--rotate-start' as never]: `${p.rotate}deg`,
          }}
        />
      ))}

      <style jsx>{`
        .confetti {
          position: absolute;
          top: 40%;
          opacity: 0;
          animation-name: burst;
          animation-iteration-count: 1;
          animation-timing-function: cubic-bezier(0.18, 0.7, 0.5, 1);
          animation-fill-mode: forwards;
          will-change: transform, opacity;
        }
        @keyframes burst {
          0% {
            transform: translate3d(0, 0, 0) rotate(var(--rotate-start)) scale(0.6);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          100% {
            transform: translate3d(var(--drift), 90vh, 0)
              rotate(calc(var(--rotate-start) + 720deg)) scale(1);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
