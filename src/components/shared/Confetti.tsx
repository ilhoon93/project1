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

const PIECE_COUNT = 110;
const LAUNCH_MS = 700; // 양쪽 가장자리에서 위로 발사되는 구간 — 빠르게
const FALL_MIN_MS = 4500;
const FALL_MAX_MS = 7500;
const STAGGER_MAX_MS = 600;
const ACTIVE_MS = LAUNCH_MS + FALL_MAX_MS + STAGGER_MAX_MS + 400;

type Shape = 'rect' | 'streamer' | 'circle';
type Side = 'left' | 'right';

interface Piece {
  id: number;
  side: Side;
  delay: number;
  fallDuration: number;
  /** 발사 시작 위치 (vw) */
  startX: number;
  /** 정점 위치 — 화면 가운데 위쪽 (vw, vh) */
  apexX: number;
  apexY: number;
  /** 정점 도달 후 좌우로 천천히 흔들리는 폭 (px) */
  swayPx: number;
  swayDir: 1 | -1;
  color: string;
  rotate: number;
  flipDuration: number;
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
 * One-shot confetti, "cannon" style.
 *
 * Pieces start at the bottom-left and bottom-right edges and shoot upward
 * to an apex near the top of the viewport in ~700ms (LAUNCH_MS, ease-out so
 * it feels like a quick burst), then a second animation takes over with a
 * gravity-style ease-in fall — same vibe as the previous version, but the
 * source is "two cannons firing inward" instead of rain from the top.
 *
 * Each piece also pulses brightness + a soft glow (confetti-sparkle) so the
 * muted palette still reads as shimmery rather than flat construction paper.
 */
export function Confetti({ trigger }: { trigger: number | null }) {
  const [active, setActive] = useState(false);

  const pieces = useMemo<Piece[]>(() => {
    void trigger;
    return Array.from({ length: PIECE_COUNT }, (_, i) => {
      const shape = pickShape();
      const baseSize = 6 + Math.random() * 6;
      const side: Side = i % 2 === 0 ? 'left' : 'right';

      // 가장자리 안쪽 0~10vw 사이에서 발사
      const startEdge = Math.random() * 10;
      const startX = side === 'left' ? startEdge : 100 - startEdge;

      // 정점은 화면 안쪽으로 25~75vw 정도 들어오고, 위쪽 -15 ~ +10vh
      const apexInset = 25 + Math.random() * 50;
      const apexX = side === 'left' ? startEdge + apexInset : 100 - startEdge - apexInset;
      const apexY = -15 + Math.random() * 25;

      return {
        id: i,
        side,
        delay: Math.random() * STAGGER_MAX_MS,
        fallDuration: FALL_MIN_MS + Math.random() * (FALL_MAX_MS - FALL_MIN_MS),
        startX,
        apexX,
        apexY,
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
              left: `${p.startX}vw`,
              top: '90vh',
              ['--apex-dx' as never]: `${p.apexX - p.startX}vw`,
              ['--apex-dy' as never]: `${p.apexY - 90}vh`,
              ['--sway' as never]: `${p.swayPx * p.swayDir}px`,
              ['--rz-start' as never]: `${p.rotate}deg`,
              // 발사 + 낙하를 두 개의 chain animation 으로 — keyframe 안에서
              // 직접 변수를 percentage 로 쓸 수 없어서 두 단계를 분리한다.
              animation: `
                confetti-launch ${LAUNCH_MS}ms cubic-bezier(0.18, 0.7, 0.3, 1) ${p.delay}ms forwards,
                confetti-fall ${p.fallDuration}ms cubic-bezier(0.4, 0, 0.6, 1) ${p.delay + LAUNCH_MS}ms forwards
              `,
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
                  // 조각마다 시점이 다른 sparkle — 동일 듀레이션이지만 delay 가
                  // 달라서 전체적으로 깜빡이는 느낌이 난다.
                  animationDelay: `${(p.id * 137) % 600}ms`,
                }}
              />
            </span>
          </span>
        );
      })}

      <style jsx>{`
        .confetti-wrap {
          position: absolute;
          opacity: 0;
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
          animation-name: confetti-sparkle;
          animation-duration: 900ms;
          animation-iteration-count: infinite;
          animation-timing-function: ease-in-out;
        }
        /* 1단계: 가장자리에서 정점까지 빠르게 발사 (~700ms) */
        @keyframes confetti-launch {
          0% {
            transform: translate3d(0, 0, 0) rotate(var(--rz-start));
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          100% {
            transform: translate3d(var(--apex-dx), var(--apex-dy), 0)
              rotate(calc(var(--rz-start) + 200deg));
            opacity: 1;
          }
        }
        /* 2단계: 정점에서 흔들리며 낙하 — 이전 버전과 같은 느낌 */
        @keyframes confetti-fall {
          0% {
            transform: translate3d(var(--apex-dx), var(--apex-dy), 0)
              rotate(calc(var(--rz-start) + 200deg));
            opacity: 1;
          }
          25% {
            transform: translate3d(
                calc(var(--apex-dx) + var(--sway) * 1),
                calc(var(--apex-dy) + 22vh),
                0
              )
              rotate(calc(var(--rz-start) + 320deg));
          }
          55% {
            transform: translate3d(
                calc(var(--apex-dx) + var(--sway) * -1),
                calc(var(--apex-dy) + 50vh),
                0
              )
              rotate(calc(var(--rz-start) + 480deg));
          }
          80% {
            transform: translate3d(
                calc(var(--apex-dx) + var(--sway) * 0.6),
                calc(var(--apex-dy) + 80vh),
                0
              )
              rotate(calc(var(--rz-start) + 600deg));
            opacity: 1;
          }
          100% {
            transform: translate3d(
                calc(var(--apex-dx) + var(--sway) * -0.3),
                calc(var(--apex-dy) + 110vh),
                0
              )
              rotate(calc(var(--rz-start) + 700deg));
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
        /* 반짝임: 밝기 + 살짝의 글로우 펄스 */
        @keyframes confetti-sparkle {
          0%,
          100% {
            filter: brightness(1) drop-shadow(0 0 0 rgba(255, 255, 255, 0));
          }
          50% {
            filter: brightness(1.35)
              drop-shadow(0 0 4px rgba(255, 245, 220, 0.85));
          }
        }
      `}</style>
    </div>
  );
}
