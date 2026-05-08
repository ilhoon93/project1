/**
 * 혼인서약서 4 모서리에 배치되는 금색 웨딩 장식 코너 SVG.
 *
 * 회전 transform 으로 4 방향을 만들면 SVG transform-origin 이 브라우저별로
 * 다르게 동작해 위치가 어긋난다 (Safari/Chrome 차이). 따라서 4 모서리 각각
 * 명시적인 좌표로 그린다 — 위치가 픽셀 단위로 정확하게 맞아 떨어짐.
 *
 * viewBox 0..100 안에서 좌상단(0,0) 코너 기준으로 그린 뒤, position prop 으로
 * SVG 자체의 transform 을 외부 div 에 CSS scaleX/scaleY 로 적용해 4 방향 변형.
 */

const GRADIENT_ID_PREFIX = 'cert-gold-';

interface CornerProps {
  position: 'tl' | 'tr' | 'bl' | 'br';
  size?: number;
}

export function OrnamentCorner({ position, size = 56 }: CornerProps) {
  // CSS transform 으로 회전/반전 — SVG transform-origin 브라우저별 차이 회피.
  const cssTransform =
    position === 'tr'
      ? 'scaleX(-1)'
      : position === 'bl'
        ? 'scaleY(-1)'
        : position === 'br'
          ? 'scale(-1, -1)'
          : undefined;

  const gradientId = `${GRADIENT_ID_PREFIX}${position}`;

  return (
    <div
      style={{
        width: size,
        height: size,
        transform: cssTransform,
        transformOrigin: 'center',
        // CSS transform 으로 처리하므로 SVG 는 항상 동일한 좌상단 코너 디자인.
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        width={size}
        height={size}
        style={{ display: 'block' }}
        aria-hidden
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A6841C" />
            <stop offset="40%" stopColor="#D4AF37" />
            <stop offset="65%" stopColor="#F4E4A6" />
            <stop offset="100%" stopColor="#A6841C" />
          </linearGradient>
        </defs>
        <g
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="1.4"
          strokeLinecap="round"
        >
          {/* 메인 곡선 — L자 형태로 코너를 따라 흐름 */}
          <path d="M 6 50 Q 6 6 50 6" />
          {/* 안쪽 보조 곡선 */}
          <path d="M 14 50 Q 14 14 50 14" strokeWidth="0.8" opacity="0.7" />
          {/* 잎사귀 — 위쪽 & 왼쪽 */}
          <path
            d="M 30 8 Q 38 4 46 10 Q 38 14 30 8 Z"
            fill={`url(#${gradientId})`}
            stroke="none"
          />
          <path
            d="M 8 30 Q 4 38 10 46 Q 14 38 8 30 Z"
            fill={`url(#${gradientId})`}
            stroke="none"
          />
          {/* 작은 꽃 — 코너 안쪽 */}
          <circle cx="22" cy="22" r="2.4" fill={`url(#${gradientId})`} stroke="none" />
          <circle cx="22" cy="22" r="0.9" fill="#fff" stroke="none" />
          {/* 끝부분 작은 잎 */}
          <path d="M 48 6 Q 56 8 60 14" strokeWidth="0.8" opacity="0.85" />
          <path d="M 6 48 Q 8 56 14 60" strokeWidth="0.8" opacity="0.85" />
          {/* 작은 점 장식 */}
          <circle cx="50" cy="11" r="0.9" fill={`url(#${gradientId})`} stroke="none" />
          <circle cx="11" cy="50" r="0.9" fill={`url(#${gradientId})`} stroke="none" />
        </g>
      </svg>
    </div>
  );
}
