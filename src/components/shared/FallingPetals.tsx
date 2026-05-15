'use client';

import { useMemo } from 'react';
import { PETAL_GLYPHS, PETAL_IS_TEXTURE, type PetalType } from '@/lib/theme';

const PETAL_COUNT = 14;
const DEFAULT_COLORS = ['#F4D9D0', '#E8C2B8', '#F1E0D6', '#D4B5A0'];

// 세로로 길쭉한 꽃잎(흰 꽃잎)은 텍스처 박스가 정사각형이지만 SVG 자체가 세로
// 비율이 커서 화면에서 더 커 보인다. 타입별로 크기 보정 계수를 둬 화면에서
// 일관되게 작은 비율로 보이도록 한다.
const PETAL_SIZE_SCALE: Record<PetalType, number> = {
  flower: 1,
  heart: 1,
  star: 1,
  snow: 1,
  sakura: 1,
  leaf: 0.85,
  whitePetal: 0.7,
  // bokeh/starlight 은 자체 렌더 분기를 쓰지만 PetalType 모든 키를 채워야
  // 하므로 더미 1.
  bokeh: 1,
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
        // 글리프(❀ ♥ ★) 와 텍스처(꽃잎/단풍잎) 공통 사이즈 범위.
        // 별빛(starlight)·보케(bokeh) 는 별도 렌더 분기라 영향 없음.
        // 최소 크기는 그대로(10px), 최대만 22→17px 로 축소해 떨어지는
        // 개체가 화면에서 너무 커 보이지 않도록 함.
        size: 10 + Math.random() * 7,
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
  if (type === 'bokeh') {
    return <Bokeh palette={palette} />;
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
    // 🍁 (캐나다 단풍잎) 실루엣을 단순화한 11점 path. 각 piece 의 color 가
    // gradient 어디나 적용되도록 두 stop 모두 같은 색의 진하기 차이로 구성.
    // 이모지 글리프와 달리 SVG 라 currentColor / 팔레트 색을 그대로 받는다.
    const stem = darken(color, 0.35);
    return (
      <svg viewBox="0 0 40 44" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id={gradId} cx="50%" cy="42%" r="55%">
            <stop offset="0%" stopColor={lighten(color, 0.18)} stopOpacity="1" />
            <stop offset="100%" stopColor={color} stopOpacity="0.92" />
          </radialGradient>
        </defs>
        {/* 잎 본체 — 5엽 형태의 🍁 실루엣 (11 점). */}
        <path
          fill={`url(#${gradId})`}
          stroke={darken(color, 0.25)}
          strokeWidth="0.4"
          strokeLinejoin="round"
          d="M20 3 L23 11 L31 8 L28 16 L36 17 L29 22 L33 30 L24 27 L22 35 L20 33 L18 35 L16 27 L7 30 L11 22 L4 17 L12 16 L9 8 L17 11 Z"
        />
        {/* 잎맥 — color 보다 살짝 어두운 톤으로 가운데/대각선 잎맥 4 줄. */}
        <g
          stroke={darken(color, 0.3)}
          strokeWidth="0.45"
          fill="none"
          strokeLinecap="round"
          opacity="0.55"
        >
          <path d="M20 33 L20 7" />
          <path d="M20 17 L28 14" />
          <path d="M20 17 L12 14" />
          <path d="M20 24 L29 24" />
          <path d="M20 24 L11 24" />
        </g>
        {/* 줄기 — 잎 본체 아래 짧게. */}
        <line x1="20" y1="33" x2="20" y2="42" stroke={stem} strokeWidth="1.1" strokeLinecap="round" />
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
// 별빛 — ✨ 느낌의 4갈래 스파클 별 + 배경에 천천히 나타났다 사라지는 오로라 글로우.
// 다른 효과들과 달리 "떨어지는" 게 아니므로 별도 분기.
// ─────────────────────────────────────────────────────────────

interface Star {
  id: number;
  left: number;
  top: number;
  size: number;
  delay: number;
  duration: number;
  rotate: number;
  color: string;
}

interface AuroraBlob {
  id: number;
  left: number;
  top: number;
  scale: number;
  delay: number;
  duration: number;
  color: string;
}

function Starlight({ palette }: { palette: readonly string[] }) {
  const stars = useMemo<Star[]>(
    () =>
      // 화면 전체에 자잘하게 퍼진 트윙클 별. 색상은 팔레트에서 무작위 선택.
      Array.from({ length: 22 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        // 6 ~ 12px — ✨ 모양이 알아볼 수 있을 정도로는 잡음.
        size: 6 + Math.random() * 6,
        delay: Math.random() * 4,
        duration: 2.6 + Math.random() * 2.4,
        // 살짝 회전 변형으로 단조로움 제거.
        rotate: Math.random() * 45 - 22,
        color: palette[Math.floor(Math.random() * palette.length)],
      })),
    [palette],
  );

  // 오로라 — 화면 곳곳에 5개 부드러운 글로우가 서로 다른 타이밍으로 나타났다 사라짐.
  // 위치/크기/색을 분산시켜서 매번 다른 느낌이 되도록.
  const auroras = useMemo<AuroraBlob[]>(
    () =>
      Array.from({ length: 5 }, (_, i) => ({
        id: i,
        left: 10 + Math.random() * 80,
        top: 15 + Math.random() * 70,
        scale: 0.8 + Math.random() * 0.7,
        delay: Math.random() * 8,
        duration: 9 + Math.random() * 6,
        color: palette[i % palette.length],
      })),
    [palette],
  );

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
    >
      {/* 배경에 랜덤 위치로 천천히 페이드 인/아웃 하는 오로라 글로우. */}
      {auroras.map((a) => (
        <span
          key={`aurora-${a.id}`}
          className="aurora"
          style={{
            left: `${a.left}%`,
            top: `${a.top}%`,
            width: `${42 * a.scale}cqw`,
            height: `${30 * a.scale}cqh`,
            background: `radial-gradient(ellipse, ${hexAlpha(a.color, 0.3)} 0%, ${hexAlpha(a.color, 0.1)} 45%, transparent 75%)`,
            animationDelay: `${a.delay}s`,
            animationDuration: `${a.duration}s`,
          }}
        />
      ))}

      {stars.map((s) => (
        <span
          key={s.id}
          className="star"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            color: s.color,
            // 회전은 keyframes 의 scale 와 합쳐 적용 — CSS 변수로 baseline rotate 전달.
            ['--rot' as never]: `${s.rotate}deg`,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        >
          <SparkleStar />
        </span>
      ))}

      <style jsx>{`
        .aurora {
          position: absolute;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          opacity: 0;
          mix-blend-mode: screen;
          filter: blur(28px);
          animation-name: aurora-pulse;
          animation-iteration-count: infinite;
          animation-timing-function: ease-in-out;
          will-change: opacity, transform;
        }
        @keyframes aurora-pulse {
          0%, 100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.8);
          }
          50% {
            opacity: 0.55;
            transform: translate(-50%, -50%) scale(1.05);
          }
        }
        .star {
          position: absolute;
          display: inline-block;
          opacity: 0;
          transform: translate(-50%, -50%) rotate(var(--rot, 0deg)) scale(0.85);
          animation-name: twinkle;
          animation-iteration-count: infinite;
          animation-timing-function: ease-in-out;
          will-change: opacity, transform;
          filter: drop-shadow(0 0 3px currentColor);
        }
        @keyframes twinkle {
          0%, 100% {
            opacity: 0.15;
            transform: translate(-50%, -50%) rotate(var(--rot, 0deg)) scale(0.7);
          }
          50% {
            opacity: 1;
            transform: translate(-50%, -50%) rotate(var(--rot, 0deg)) scale(1.15);
          }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 보케 — 큰 블러 원이 화면 곳곳에 페이드 인/아웃. starlight 의 오로라와 비슷
// 하지만 별/빛살 없이 *순수 부드러운 빛방울* 만 — 더 조용하고 드림라이트
// 사진 보케 효과에 가깝게.
// ─────────────────────────────────────────────────────────────

interface BokehBlob {
  id: number;
  left: number;
  top: number;
  /** % 단위 — 슬라이드 컨테이너 기준 (cqw/cqh). 너무 크면 단색 얼룩이 됨. */
  size: number;
  delay: number;
  duration: number;
  color: string;
  /** 일부는 더 진하게, 일부는 옅게. 기본 0.3 ~ 0.55 사이. */
  peakOpacity: number;
}

function Bokeh({ palette }: { palette: readonly string[] }) {
  const blobs = useMemo<BokehBlob[]>(
    () =>
      // 8 개 정도 — 더 많으면 전체적으로 뿌예져서 콘텐츠가 흐려진다.
      Array.from({ length: 8 }, (_, i) => ({
        id: i,
        left: 5 + Math.random() * 90,
        top: 5 + Math.random() * 90,
        size: 18 + Math.random() * 20,
        delay: Math.random() * 6,
        duration: 7 + Math.random() * 5,
        color: palette[i % palette.length],
        peakOpacity: 0.3 + Math.random() * 0.25,
      })),
    [palette],
  );

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
    >
      {blobs.map((b) => (
        <span
          key={b.id}
          className="bokeh"
          style={{
            left: `${b.left}%`,
            top: `${b.top}%`,
            width: `${b.size}cqw`,
            height: `${b.size}cqw`,
            background: `radial-gradient(circle, ${hexAlpha(b.color, b.peakOpacity)} 0%, ${hexAlpha(b.color, b.peakOpacity * 0.4)} 45%, transparent 75%)`,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.duration}s`,
          }}
        />
      ))}

      <style jsx>{`
        .bokeh {
          position: absolute;
          border-radius: 50%;
          transform: translate(-50%, -50%) scale(0.85);
          opacity: 0;
          mix-blend-mode: screen;
          filter: blur(22px);
          animation-name: bokeh-pulse;
          animation-iteration-count: infinite;
          animation-timing-function: ease-in-out;
          will-change: opacity, transform;
        }
        @keyframes bokeh-pulse {
          0%, 100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.85);
          }
          50% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.1);
          }
        }
      `}</style>
    </div>
  );
}

/** ✨ 느낌의 4갈래 스파클 별. 가운데 작은 글로우 + 길쭉한 4축 빛살. */
function SparkleStar() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      fill="currentColor"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* 4축 빛살 — 가운데에서 위/아래/좌/우로 길쭉하게 뻗는 형태.
          각 방향이 살짝 부풀고 끝이 뾰족한 sparkle 실루엣. */}
      <path d="M12 1
               C 12 7, 13 11, 23 12
               C 13 13, 12 17, 12 23
               C 12 17, 11 13, 1 12
               C 11 11, 12 7, 12 1 Z" />
      {/* 가운데 작은 코어 — drop-shadow 와 합쳐서 살짝 빛나는 점. */}
      <circle cx="12" cy="12" r="0.9" />
    </svg>
  );
}

/** "#RRGGBB" 를 비율만큼 흰색 쪽으로 보간 (factor 0=원본, 1=흰색). */
function lighten(hex: string, factor: number): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const lr = Math.round(r + (255 - r) * factor);
  const lg = Math.round(g + (255 - g) * factor);
  const lb = Math.round(b + (255 - b) * factor);
  return `#${((lr << 16) | (lg << 8) | lb).toString(16).padStart(6, '0')}`;
}

/** "#RRGGBB" 를 비율만큼 검정 쪽으로 보간 (factor 0=원본, 1=검정). */
function darken(hex: string, factor: number): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const dr = Math.round(r * (1 - factor));
  const dg = Math.round(g * (1 - factor));
  const db = Math.round(b * (1 - factor));
  return `#${((dr << 16) | (dg << 8) | db).toString(16).padStart(6, '0')}`;
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
