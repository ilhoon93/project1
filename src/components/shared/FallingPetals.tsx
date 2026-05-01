'use client';

import { useMemo } from 'react';
import { PETAL_GLYPHS, PETAL_IS_TEXTURE, type PetalType } from '@/lib/theme';

const PETAL_COUNT = 14;
const DEFAULT_COLORS = ['#F4D9D0', '#E8C2B8', '#F1E0D6', '#D4B5A0'];

// 세로로 길쭉한 꽃잎(흰 꽃잎, 단풍잎)은 텍스처 박스가 정사각형이지만 SVG
// 자체가 세로 비율이 커서 화면에서 더 커 보인다. 타입별로 크기 보정 계수를
// 둬 화면에서 일관되게 작은 비율로 보이도록 한다.
const PETAL_SIZE_SCALE: Record<PetalType, number> = {
  flower: 1,
  heart: 1,
  star: 1,
  sakura: 1,
  leaf: 0.75,
  whitePetal: 0.7,
  none: 1,
};

interface Petal {
  id: number;
  left: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  color: string;
  rotate: number;
  /** sparkle 펄스 시점 — 조각마다 미세하게 다른 시작점을 줘서 한꺼번에 반짝거리지 않게 */
  sparkleDelay: number;
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
        sparkleDelay: Math.random() * 2.4,
      })),
    [count, palette],
  );

  if (type === 'none') return null;
  const isTexture = PETAL_IS_TEXTURE[type];
  const glyph = PETAL_GLYPHS[type];
  const sizeScale = PETAL_SIZE_SCALE[type];

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
    >
      {petals.map((p) => {
        const scaledSize = p.size * sizeScale;
        return (
          <span
            key={p.id}
            className="petal"
            style={{
              left: `${p.left}%`,
              // Texture mode uses width/height, glyph mode uses fontSize.
              // sizeScale 로 세로로 긴 타입(whitePetal/leaf)을 더 작게.
              ...(isTexture
                ? {
                    width: `${scaledSize * 1.4}px`,
                    height: `${scaledSize * 1.4}px`,
                  }
                : { fontSize: `${scaledSize}px` }),
              color: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              ['--drift' as never]: `${p.drift}px`,
              ['--rotate-start' as never]: `${p.rotate}deg`,
            }}
          >
            <span
              className="petal-sparkle"
              style={{
                animationDelay: `${p.sparkleDelay}s`,
                // 글리프 모드(이모지 문자)는 fontSize 가 부모에 있어 inner span
                // 이 inline 으로 그대로 받아 렌더된다. 텍스처 모드에서도 SVG 가
                // width/height 100% 로 채워진다.
                display: 'inline-block',
                width: '100%',
                height: '100%',
                lineHeight: 1,
              }}
            >
              {isTexture ? <PetalShape type={type} color={p.color} /> : glyph}
            </span>
          </span>
        );
      })}

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
        /* 반짝임: 밝기 + 부드러운 글로우 펄스. 낙하 애니메이션과 별도로
           돌아가서 떨어지면서 한번씩 깜빡이는 느낌. */
        .petal-sparkle {
          animation-name: petal-sparkle;
          animation-duration: 2.4s;
          animation-iteration-count: infinite;
          animation-timing-function: ease-in-out;
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
        @keyframes petal-sparkle {
          0%,
          100% {
            filter: brightness(1) drop-shadow(0 0 0 rgba(255, 255, 255, 0));
          }
          50% {
            filter: brightness(1.25)
              drop-shadow(0 0 5px rgba(255, 245, 220, 0.7));
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

  if (type === 'whitePetal') {
    // 한 잎짜리 흰 꽃잎. 실사 사진 느낌이 나도록:
    //  - 길쭉한 타원형의 꽃잎 형태 (한쪽 끝이 살짝 패임)
    //  - 흰색에서 미세한 핑크/베이지 그라디언트 → 입체감
    //  - 가운데 잎맥 라인 + 가장자리 살짝 그림자
    return (
      <svg viewBox="0 0 40 50" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id={gradId} cx="50%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <stop offset="55%" stopColor="#FFF8F4" stopOpacity="0.98" />
            <stop offset="100%" stopColor="#F2DCD4" stopOpacity="0.92" />
          </radialGradient>
          <linearGradient id={`${gradId}-shade`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="100%" stopColor="#C9A8A0" stopOpacity="0.18" />
          </linearGradient>
        </defs>
        {/* 꽃잎 본체 — 위쪽에 살짝 패임(노치)으로 한쪽이 갈라진 모양 */}
        <path
          d="M20 4
             C 12 6, 6 16, 8 28
             C 9 36, 14 44, 20 47
             C 26 44, 31 36, 32 28
             C 34 16, 28 6, 21 4
             C 21 6, 20 7, 20 8
             C 20 7, 19 6, 19 4 Z"
          fill={`url(#${gradId})`}
          stroke="rgba(180,140,135,0.35)"
          strokeWidth="0.4"
        />
        {/* 입체감용 음영 오버레이 */}
        <path
          d="M20 4
             C 12 6, 6 16, 8 28
             C 9 36, 14 44, 20 47
             C 26 44, 31 36, 32 28
             C 34 16, 28 6, 21 4 Z"
          fill={`url(#${gradId}-shade)`}
        />
      </svg>
    );
  }

  return null;
}
