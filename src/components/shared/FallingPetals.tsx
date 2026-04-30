'use client';

import { useMemo } from 'react';
import { PETAL_GLYPHS, PETAL_IS_TEXTURE, type PetalType } from '@/lib/theme';

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
 * interaction.
 *
 * Two render modes:
 *  - Glyph (flower/heart/star): unicode character, lightweight 2D look.
 *  - Texture (sakura/leaf/ring): inline SVG with shading + gradients,
 *    so it feels like a real petal/leaf/ring rather than a flat icon.
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
  const isTexture = PETAL_IS_TEXTURE[type];
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
            // Texture mode uses width/height, glyph mode uses fontSize.
            ...(isTexture
              ? { width: `${p.size * 1.4}px`, height: `${p.size * 1.4}px` }
              : { fontSize: `${p.size}px` }),
            color: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ['--drift' as never]: `${p.drift}px`,
            ['--rotate-start' as never]: `${p.rotate}deg`,
          }}
        >
          {isTexture ? <PetalShape type={type} color={p.color} /> : glyph}
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

/**
 * SVG textures. Each shape uses a radial gradient based on the petal's color
 * so it picks up the active palette while still looking like a real object.
 *
 * Exported so the theme editor can reuse the exact same shape as a preview
 * swatch — no second source of truth for what each texture looks like.
 */
export function PetalShape({ type, color }: { type: PetalType; color: string }) {
  // Stable but unique gradient id per render — color string is enough since
  // multiple petals with the same color can share a gradient.
  const gradId = `pg-${type}-${color.replace('#', '')}`;

  if (type === 'sakura') {
    return (
      <svg viewBox="0 0 40 40" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id={gradId} cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="55%" stopColor={color} stopOpacity="0.95" />
            <stop offset="100%" stopColor={color} stopOpacity="0.7" />
          </radialGradient>
        </defs>
        {/* 5장 꽃잎 — 각 잎은 살짝 안쪽으로 패인 노치 */}
        <g fill={`url(#${gradId})`} stroke="rgba(120,60,80,0.18)" strokeWidth="0.4">
          {[0, 72, 144, 216, 288].map((deg) => (
            <path
              key={deg}
              transform={`rotate(${deg} 20 20)`}
              d="M20 20 C 14 18, 12 10, 18 4 C 19 6, 21 6, 22 4 C 28 10, 26 18, 20 20 Z"
            />
          ))}
          <circle cx="20" cy="20" r="2.2" fill="#E8B33A" stroke="none" opacity="0.9" />
          <circle cx="20" cy="20" r="0.8" fill="#A56D14" stroke="none" />
        </g>
      </svg>
    );
  }

  if (type === 'leaf') {
    return (
      <svg viewBox="0 0 40 40" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id={gradId} cx="35%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#FFE0AA" stopOpacity="0.95" />
            <stop offset="55%" stopColor={color} stopOpacity="0.95" />
            <stop offset="100%" stopColor="#7A3015" stopOpacity="0.85" />
          </radialGradient>
        </defs>
        {/* 단풍잎 5엽 + 잎맥 */}
        <g fill={`url(#${gradId})`} stroke="rgba(80,30,10,0.35)" strokeWidth="0.4">
          <path d="M20 4 L24 14 L34 12 L27 21 L34 30 L23 28 L20 38 L17 28 L6 30 L13 21 L6 12 L16 14 Z" />
        </g>
        <g
          stroke="rgba(80,30,10,0.5)"
          strokeWidth="0.5"
          fill="none"
          strokeLinecap="round"
        >
          <path d="M20 6 L20 36" />
          <path d="M20 14 L28 12" />
          <path d="M20 14 L12 12" />
          <path d="M20 22 L30 24" />
          <path d="M20 22 L10 24" />
        </g>
      </svg>
    );
  }

  if (type === 'ring') {
    return (
      <svg viewBox="0 0 40 40" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id={gradId} cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#FFF6D8" stopOpacity="1" />
            <stop offset="60%" stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor="#7A5A12" stopOpacity="1" />
          </radialGradient>
          <radialGradient id={`${gradId}-d`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <stop offset="60%" stopColor="#E8F2FF" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#9DB6D9" stopOpacity="0.9" />
          </radialGradient>
        </defs>
        {/* 반지 밴드 */}
        <circle
          cx="20"
          cy="24"
          r="11"
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="3"
        />
        {/* 다이아몬드 (윗 부분) */}
        <g transform="translate(20 11)">
          <polygon
            points="0,-5 4,-1 2,4 -2,4 -4,-1"
            fill={`url(#${gradId}-d)`}
            stroke="rgba(80,100,140,0.5)"
            strokeWidth="0.4"
          />
          <polygon
            points="0,-5 4,-1 -4,-1"
            fill="rgba(255,255,255,0.6)"
            stroke="none"
          />
        </g>
      </svg>
    );
  }

  return null;
}
