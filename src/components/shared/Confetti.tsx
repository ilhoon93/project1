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

const PIECE_COUNT = 130;
// 1단계: 화면 양쪽 상단 모서리에서 안쪽으로 짧게 "터지는" 구간.
// 길이가 너무 짧으면 폭발이 잘 안 보이고, 너무 길면 빠른 느낌이 사라진다.
const BURST_MS = 550;
// 2단계: 화면 전체에 흩뿌려진 위치에서 천천히 자연스럽게 낙하.
const FALL_MIN_MS = 6000;
const FALL_MAX_MS = 9500;
const STAGGER_MAX_MS = 350;
const ACTIVE_MS = BURST_MS + FALL_MAX_MS + STAGGER_MAX_MS + 400;

type Shape = 'rect' | 'streamer' | 'circle';
type Side = 'left' | 'right';

interface Piece {
  id: number;
  side: Side;
  delay: number;
  fallDuration: number;
  /** 발사 시작 위치 — 화면 양쪽 상단 모서리 (vw, vh) */
  originX: number;
  originY: number;
  /** 폭발 후 흩뿌려질 목표 위치 — 화면 전체에 골고루 분포 (vw, vh) */
  scatterX: number;
  scatterY: number;
  /** 흩뿌려진 후 좌우로 천천히 흔들리는 폭 (px) */
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
 * One-shot confetti, "fireworks" style.
 *
 * Pieces start at the top-left and top-right corners and burst outward to a
 * scatter point distributed across the viewport (~550ms, ease-out so the
 * burst feels like an explosion, not a launch). The scatter points cover the
 * upper half of the screen on both sides with overlap in the middle, so by
 * the time burst finishes the confetti reads as "filling the screen from
 * above".
 *
 * Then a second animation takes over with a slow gravity-style ease-in fall
 * (6–9.5s) plus gentle sway — natural, drifting descent rather than the
 * fast cannon arc the previous version had.
 *
 * Sparkle has been intentionally minimised — the muted palette is kept flat
 * so the focus stays on the falling motion itself.
 */
/**
 * scoped: 컨테이너의 부모 박스 안에서만 동작하도록 viewport 단위(`vw`/`vh`)
 * 대신 부모 상대 단위(`%`)와 absolute positioning 을 쓴다. 에디터 좌측
 * 미리보기 패널에서 "축하하기" 를 눌렀을 때, 컨페티가 전체 화면이 아닌
 * 미리보기 박스 안에만 떨어지도록 하기 위함.
 */
export function Confetti({
  trigger,
  scoped = false,
}: {
  trigger: number | null;
  scoped?: boolean;
}) {
  const [active, setActive] = useState(false);

  const pieces = useMemo<Piece[]>(() => {
    void trigger;
    return Array.from({ length: PIECE_COUNT }, (_, i) => {
      const shape = pickShape();
      const baseSize = 6 + Math.random() * 6;
      const side: Side = i % 2 === 0 ? 'left' : 'right';

      // 발사 시작점: 화면 양쪽 상단 모서리 (살짝 가장자리 안쪽)
      const originX = side === 'left' ? Math.random() * 4 : 100 - Math.random() * 4;
      const originY = 4 + Math.random() * 6; // 4~10vh

      // 흩뿌려질 목표: 같은 방향에서 출발한 조각이라도 화면 전반에 퍼지도록
      // 좌우 양쪽이 어느 정도 겹치게 분포 시킨다.
      // 좌측 폭발 → 0~80vw, 우측 폭발 → 20~100vw
      const scatterX =
        side === 'left' ? Math.random() * 80 : 20 + Math.random() * 80;
      // 상단 위주 — 0~55vh 사이 — 폭발 직후 윗부분을 뒤덮은 뒤 천천히 내려옴
      const scatterY = -5 + Math.random() * 60;

      return {
        id: i,
        side,
        delay: Math.random() * STAGGER_MAX_MS,
        fallDuration: FALL_MIN_MS + Math.random() * (FALL_MAX_MS - FALL_MIN_MS),
        originX,
        originY,
        scatterX,
        scatterY,
        swayPx: 12 + Math.random() * 28,
        swayDir: Math.random() > 0.5 ? 1 : -1,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotate: Math.random() * 360,
        flipDuration: 900 + Math.random() * 1800,
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

  // scoped 모드: 부모 박스 안에서만 컨페티가 동작하도록 viewport 단위
  // (vw/vh) 대신 container query 단위(cqw/cqh) 사용.
  //
  // 왜 % 가 아니라 cqw/cqh 인가:
  //   CSS `transform: translate(x%, y%)` 의 % 는 *그 요소 자신의 크기* 를
  //   기준이라 12px 짜리 컨페티 조각을 25% 이동시키면 단 3px 만 움직인다 →
  //   결과적으로 화면 상단에서 잠시 맴돌다 사라지는 듯 보임.
  //   cqh/cqw 는 closest container 의 크기를 기준 — 부모 박스를
  //   container-type:size 로 지정하면 우리가 원하던 % 동작이 나온다.
  const unitX = scoped ? 'cqw' : 'vw';
  const unitY = scoped ? 'cqh' : 'vh';
  const fallKeyframes = scoped ? 'confetti-fall-scoped' : 'confetti-fall';

  return (
    <div
      aria-hidden
      className={`pointer-events-none z-40 overflow-hidden ${
        scoped ? 'absolute inset-0' : 'fixed inset-0'
      }`}
      style={{
        perspective: '700px',
        // SlideContainer 의 슬라이드 div 가 이미 container-type: size 라
        // cqw/cqh 가 슬라이드 박스 크기 기준으로 계산된다 — 추가 설정 불필요.
      }}
    >
      {pieces.map((p) => {
        // streamer(길쭉한 모양) 의 가로/세로 길이를 줄여 너무 두드러지지 않게
        // — 이전 0.45w × 2.6h → 0.4w × 1.6h 로 약 60% 길이.
        const w =
          p.shape === 'streamer'
            ? p.size * 0.4
            : p.shape === 'circle'
              ? p.size
              : p.size;
        const h =
          p.shape === 'streamer'
            ? p.size * 1.6
            : p.shape === 'circle'
              ? p.size
              : p.size * 1.4;
        return (
          <span
            key={`${trigger}-${p.id}`}
            className="confetti-wrap"
            style={{
              left: `${p.originX}${unitX}`,
              top: `${p.originY}${unitY}`,
              ['--scatter-dx' as never]: `${p.scatterX - p.originX}${unitX}`,
              ['--scatter-dy' as never]: `${p.scatterY - p.originY}${unitY}`,
              ['--sway' as never]: `${p.swayPx * p.swayDir}px`,
              ['--rz-start' as never]: `${p.rotate}deg`,
              // 두 단계로 나눠 chained CSS animation — keyframe selector 에서
              // 변수를 percentage 로 쓸 수 없어서 어쩔 수 없이 분리.
              animation: `
                confetti-burst ${BURST_MS}ms cubic-bezier(0.18, 0.7, 0.3, 1) ${p.delay}ms forwards,
                ${fallKeyframes} ${p.fallDuration}ms cubic-bezier(0.4, 0, 0.6, 1) ${p.delay + BURST_MS}ms forwards
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
        }
        /* 1단계: 모서리에서 화면 전반의 흩뿌림 위치까지 짧게 폭발 */
        @keyframes confetti-burst {
          0% {
            transform: translate3d(0, 0, 0) rotate(var(--rz-start));
            opacity: 0;
          }
          12% {
            opacity: 1;
          }
          100% {
            transform: translate3d(var(--scatter-dx), var(--scatter-dy), 0)
              rotate(calc(var(--rz-start) + 120deg));
            opacity: 1;
          }
        }
        /* 2단계: 흩뿌림 위치에서 천천히 자연스럽게 낙하 — 약한 좌우 흔들림 */
        @keyframes confetti-fall {
          0% {
            transform: translate3d(var(--scatter-dx), var(--scatter-dy), 0)
              rotate(calc(var(--rz-start) + 120deg));
            opacity: 1;
          }
          25% {
            transform: translate3d(
                calc(var(--scatter-dx) + var(--sway) * 1),
                calc(var(--scatter-dy) + 25vh),
                0
              )
              rotate(calc(var(--rz-start) + 240deg));
          }
          55% {
            transform: translate3d(
                calc(var(--scatter-dx) + var(--sway) * -1),
                calc(var(--scatter-dy) + 55vh),
                0
              )
              rotate(calc(var(--rz-start) + 360deg));
          }
          82% {
            transform: translate3d(
                calc(var(--scatter-dx) + var(--sway) * 0.6),
                calc(var(--scatter-dy) + 88vh),
                0
              )
              rotate(calc(var(--rz-start) + 480deg));
            opacity: 1;
          }
          100% {
            transform: translate3d(
                calc(var(--scatter-dx) + var(--sway) * -0.3),
                calc(var(--scatter-dy) + 115vh),
                0
              )
              rotate(calc(var(--rz-start) + 560deg));
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
        /* scoped 모드 — 부모 박스(container query) 기준 cqh 로 낙하 */
        @keyframes confetti-fall-scoped {
          0% {
            transform: translate3d(var(--scatter-dx), var(--scatter-dy), 0)
              rotate(calc(var(--rz-start) + 120deg));
            opacity: 1;
          }
          25% {
            transform: translate3d(
                calc(var(--scatter-dx) + var(--sway) * 1),
                calc(var(--scatter-dy) + 25cqh),
                0
              )
              rotate(calc(var(--rz-start) + 240deg));
          }
          55% {
            transform: translate3d(
                calc(var(--scatter-dx) + var(--sway) * -1),
                calc(var(--scatter-dy) + 55cqh),
                0
              )
              rotate(calc(var(--rz-start) + 360deg));
          }
          82% {
            transform: translate3d(
                calc(var(--scatter-dx) + var(--sway) * 0.6),
                calc(var(--scatter-dy) + 88cqh),
                0
              )
              rotate(calc(var(--rz-start) + 480deg));
            opacity: 1;
          }
          100% {
            transform: translate3d(
                calc(var(--scatter-dx) + var(--sway) * -0.3),
                calc(var(--scatter-dy) + 115cqh),
                0
              )
              rotate(calc(var(--rz-start) + 560deg));
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
