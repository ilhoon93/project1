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
  // starlight 는 자체 렌더 분기를 쓰지만 PetalType 모든 키를 채워야 하므로 더미 1.
  starlight: 1,
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
        // 전반적으로 약 30% 정도 작아진 사이즈 — 이전 14~30px → 10~22px.
        // 글리프(❀ ♥ ★) 와 텍스처(꽃잎/단풍잎) 모두 동일하게 적용된다.
        size: 10 + Math.random() * 12,
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
  if (type === 'starlight') {
    return <Starlight palette={palette} />;
  }
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
    // 한 잎짜리 흰 꽃잎. 벚꽃 한 장 같은 자연스러운 형태:
    //  - 아래쪽이 둥글고 넓은 본체 (꽃받침 쪽)
    //  - 위로 갈수록 좁아지면서 끝에 V자 노치 (벚꽃 특유의 갈라진 끝)
    //  - 흰색에서 미세한 핑크/베이지 그라디언트 → 입체감
    //  - 길쭉한 쌀알이 아닌, 폭 ≈ 길이의 0.7 정도 비율로 통통한 꽃잎 실루엣
    return (
      <svg viewBox="0 0 40 50" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id={gradId} cx="50%" cy="62%" r="65%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <stop offset="55%" stopColor="#FFF6F0" stopOpacity="0.98" />
            <stop offset="100%" stopColor="#F0D4CC" stopOpacity="0.9" />
          </radialGradient>
          <linearGradient id={`${gradId}-shade`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="100%" stopColor="#C9A8A0" stopOpacity="0.16" />
          </linearGradient>
        </defs>
        {/* 꽃잎 본체 — 위쪽 V자 노치, 아래로 갈수록 둥글게 부풀어 오른 형태 */}
        <path
          d="M17 7
             C 10 7, 4 13, 4 23
             C 4 36, 10 46, 20 48
             C 30 46, 36 36, 36 23
             C 36 13, 30 7, 23 7
             L 22 9
             L 20 11
             L 18 9
             Z"
          fill={`url(#${gradId})`}
          stroke="rgba(180,140,135,0.32)"
          strokeWidth="0.45"
        />
        {/* 입체감용 음영 오버레이 — 우상단에서 비추는 빛으로 가정 */}
        <path
          d="M17 7
             C 10 7, 4 13, 4 23
             C 4 36, 10 46, 20 48
             C 30 46, 36 36, 36 23
             C 36 13, 30 7, 23 7 Z"
          fill={`url(#${gradId}-shade)`}
        />
        {/* 가운데 잎맥 — 아래에서 위 노치 쪽으로 옅게 */}
        <path
          d="M20 46 Q20 30, 20 14"
          stroke="rgba(180,140,135,0.18)"
          strokeWidth="0.35"
          fill="none"
        />
      </svg>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// 별빛 — 트윙클하는 별 + 가끔 가로지르는 별똥별 + 바닥의 옅은 오로라 글로우.
// 다른 효과들과 달리 "떨어지는" 게 아니므로 별도 분기.
// ─────────────────────────────────────────────────────────────

interface Star {
  id: number;
  left: number;
  top: number;
  size: number;
  delay: number;
  duration: number;
  color: string;
}

interface Shoot {
  id: number;
  top: number;
  delay: number;
  duration: number;
}

function Starlight({ palette }: { palette: readonly string[] }) {
  const stars = useMemo<Star[]>(
    () =>
      // 화면 전체에 자잘하게 퍼진 트윙클 별. 색상은 팔레트에서 무작위 선택.
      Array.from({ length: 36 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 1.5 + Math.random() * 2.5,
        delay: Math.random() * 4,
        duration: 2.4 + Math.random() * 2.6,
        color: palette[Math.floor(Math.random() * palette.length)],
      })),
    [palette],
  );

  // 별똥별 — 4개 정도가 길게 어긋난 텀으로 가로지름.
  const shoots = useMemo<Shoot[]>(
    () =>
      Array.from({ length: 4 }, (_, i) => ({
        id: i,
        top: 8 + Math.random() * 40,
        delay: i * 3.5 + Math.random() * 2,
        duration: 1.6 + Math.random() * 0.8,
      })),
    [],
  );

  const auroraColor = palette[0] ?? '#B89BD9';

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
    >
      {/* 하단 오로라 글로우 — 옅은 라디얼 그라디언트로 별빛 분위기 깔기 */}
      <div
        className="absolute inset-x-0 bottom-0 h-2/3"
        style={{
          background: `radial-gradient(ellipse at 30% 100%, ${hexAlpha(auroraColor, 0.28)} 0%, transparent 55%), radial-gradient(ellipse at 75% 100%, ${hexAlpha(auroraColor, 0.22)} 0%, transparent 55%)`,
          mixBlendMode: 'screen',
        }}
      />

      {stars.map((s) => (
        <span
          key={s.id}
          className="star"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            backgroundColor: s.color,
            boxShadow: `0 0 ${s.size * 2}px ${hexAlpha(s.color, 0.7)}`,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        />
      ))}

      {shoots.map((sh) => (
        <span
          key={`shoot-${sh.id}`}
          className="shoot"
          style={{
            top: `${sh.top}%`,
            animationDelay: `${sh.delay}s`,
            animationDuration: `${sh.duration}s`,
          }}
        />
      ))}

      <style jsx>{`
        .star {
          position: absolute;
          border-radius: 9999px;
          opacity: 0;
          animation-name: twinkle;
          animation-iteration-count: infinite;
          animation-timing-function: ease-in-out;
          will-change: opacity, transform;
        }
        @keyframes twinkle {
          0%, 100% {
            opacity: 0.15;
            transform: scale(0.85);
          }
          50% {
            opacity: 1;
            transform: scale(1.25);
          }
        }
        .shoot {
          position: absolute;
          left: -10%;
          width: 14%;
          height: 1.5px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.85) 60%,
            #ffffff 100%
          );
          border-radius: 9999px;
          opacity: 0;
          transform: translate3d(0, 0, 0) rotate(18deg);
          animation-name: shoot;
          animation-iteration-count: infinite;
          animation-timing-function: ease-out;
          filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.6));
        }
        @keyframes shoot {
          0% {
            opacity: 0;
            transform: translate3d(0, 0, 0) rotate(18deg);
          }
          5% {
            opacity: 1;
          }
          70% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate3d(120vw, 35vh, 0) rotate(18deg);
          }
        }
      `}</style>
    </div>
  );
}

/** "#RRGGBB" → "rgba(...)" 헬퍼. 잘못된 입력이면 원본 그대로 돌려줘 무시되게 함. */
function hexAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
