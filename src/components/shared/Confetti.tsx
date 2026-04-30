'use client';

import { useEffect, useMemo, useState } from 'react';

// 부드러운 톤 위주의 결혼식 팔레트. 채도가 너무 높은 색은 빼서
// "꽃가루" 라기보다 색종이 느낌이 나도록.
const COLORS = [
  '#F4D9D0',
  '#E8C2B8',
  '#FFD1D9',
  '#FFE4E1',
  '#D4B5A0',
  '#F1E0D6',
  '#E8D5A0',
  '#F5E1DA',
  '#FFFFFF',
];

const PIECE_COUNT = 90;
const FALL_DURATION_MIN_MS = 5000;
const FALL_DURATION_MAX_MS = 8500;
const STAGGER_MAX_MS = 2200;
const ACTIVE_MS = FALL_DURATION_MAX_MS + STAGGER_MAX_MS + 400;

type Shape = 'rect' | 'streamer' | 'circle';

interface Piece {
  id: number;
  left: number;
  delay: number;
  duration: number;
  swayPx: number; // 좌우 흔들림 진폭(px)
  swayDir: 1 | -1; // 첫 흔들림 방향
  color: string;
  rotate: number; // z축 시작 각도
  flipDuration: number; // y축 플립 한 사이클 ms
  size: number;
  shape: Shape;
}

function pickShape(): Shape {
  const r = Math.random();
  if (r < 0.55) return 'rect';
  if (r < 0.85) return 'streamer';
  return 'circle';
}

/**
 * One-shot confetti. Each piece has independent fall duration, sway amplitude,
 * and a y-axis flip so paper-like rectangles tumble in 3D rather than just
 * rotate flat. Easing is cubic-bezier(0.4, 0, 0.6, 1) so falls feel like
 * gravity acceleration instead of a linear march.
 */
export function Confetti({ trigger }: { trigger: number | null }) {
  const [active, setActive] = useState(false);

  const pieces = useMemo<Piece[]>(() => {
    void trigger;
    return Array.from({ length: PIECE_COUNT }, (_, i) => {
      const shape = pickShape();
      const baseSize = 6 + Math.random() * 6;
      return {
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * STAGGER_MAX_MS,
        duration:
          FALL_DURATION_MIN_MS +
          Math.random() * (FALL_DURATION_MAX_MS - FALL_DURATION_MIN_MS),
        swayPx: 14 + Math.random() * 32,
        swayDir: Math.random() > 0.5 ? 1 : -1,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotate: Math.random() * 360,
        flipDuration: 700 + Math.random() * 1400,
        size: baseSize,
        shape,
      };
    });
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
      style={{ perspective: '700px' }}
    >
      {pieces.map((p) => {
        const w =
          p.shape === 'streamer'
            ? p.size * 0.45
            : p.shape === 'circle'
              ? p.size
              : p.size;
        const h =
          p.shape === 'streamer'
            ? p.size * 2.6
            : p.shape === 'circle'
              ? p.size
              : p.size * 1.4;
        return (
          <span
            key={`${trigger}-${p.id}`}
            className="confetti-wrap"
            style={{
              left: `${p.left}%`,
              animationDelay: `${p.delay}ms`,
              animationDuration: `${p.duration}ms`,
              ['--sway' as never]: `${p.swayPx * p.swayDir}px`,
              ['--rz-start' as never]: `${p.rotate}deg`,
            }}
          >
            <span
              className="confetti-flip"
              style={{ animationDuration: `${p.flipDuration}ms` }}
            >
              <span
                className="confetti-piece"
                style={{
                  width: `${w}px`,
                  height: `${h}px`,
                  backgroundColor: p.color,
                  borderRadius:
                    p.shape === 'circle'
                      ? '50%'
                      : p.shape === 'streamer'
                        ? '4px'
                        : '1.5px',
                  boxShadow:
                    p.shape === 'rect'
                      ? '0 0 0 0.5px rgba(120,80,80,0.08), 0 1px 2px rgba(120,80,80,0.12)'
                      : 'none',
                }}
              />
            </span>
          </span>
        );
      })}

      <style jsx>{`
        .confetti-wrap {
          position: absolute;
          top: -8%;
          opacity: 0;
          animation-name: confetti-fall;
          animation-iteration-count: 1;
          animation-timing-function: cubic-bezier(0.42, 0, 0.58, 1);
          animation-fill-mode: forwards;
          will-change: transform, opacity;
        }
        .confetti-flip {
          display: inline-block;
          transform-style: preserve-3d;
          animation-name: confetti-flip;
          animation-iteration-count: infinite;
          animation-timing-function: linear;
        }
        .confetti-piece {
          display: inline-block;
        }
        @keyframes confetti-fall {
          0% {
            transform: translate3d(0, 0, 0) rotate(var(--rz-start));
            opacity: 0;
          }
          6% {
            opacity: 1;
          }
          20% {
            transform: translate3d(calc(var(--sway) * 1), 22vh, 0)
              rotate(calc(var(--rz-start) + 80deg));
          }
          40% {
            transform: translate3d(calc(var(--sway) * -1), 44vh, 0)
              rotate(calc(var(--rz-start) + 160deg));
          }
          60% {
            transform: translate3d(calc(var(--sway) * 0.9), 66vh, 0)
              rotate(calc(var(--rz-start) + 250deg));
          }
          80% {
            transform: translate3d(calc(var(--sway) * -0.6), 88vh, 0)
              rotate(calc(var(--rz-start) + 340deg));
            opacity: 1;
          }
          100% {
            transform: translate3d(calc(var(--sway) * 0.3), 115vh, 0)
              rotate(calc(var(--rz-start) + 480deg));
            opacity: 0;
          }
        }
        @keyframes confetti-flip {
          0% {
            transform: rotateY(0deg) rotateX(0deg);
          }
          50% {
            transform: rotateY(180deg) rotateX(20deg);
          }
          100% {
            transform: rotateY(360deg) rotateX(0deg);
          }
        }
      `}</style>
    </div>
  );
}
