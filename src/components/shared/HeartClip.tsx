'use client';

import { useId } from 'react';

/**
 * 하트 모양으로 자식(image 등)을 클리핑하는 공용 컴포넌트.
 *
 * 핵심: SVG <clipPath clipPathUnits="objectBoundingBox"> + path 좌표를 0–1 범위로
 * 정규화 → CSS `clip-path: url(#id)` 를 적용한 컨테이너의 실제 크기에 맞춰
 * 하트가 자동으로 스케일된다.
 *
 * (이전엔 CSS `clip-path: path('M50 85 ...')` 를 썼는데 path() 는 절대 픽셀
 *  단위라 컨테이너가 크면 하트가 좌상단 구석에 작게만 남는 버그가 있었다.
 *  에디터 미리보기에서는 컨테이너가 작아 우연히 잘 보였던 것.)
 *
 * 보일 영역 위치는 자식 요소(보통 <img object-position>) 측에서 control 한다.
 */
export function HeartClip({
  children,
  className = '',
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  // useId 는 서버/클라 모두 안정적인 unique id 를 생성. SVG url() 참조에 안전하게 사용.
  const id = useId().replace(/:/g, '');
  const clipId = `mw-heart-clip-${id}`;

  return (
    <div className={`relative ${className}`} style={style}>
      {/* 0×0 SVG — clipPath 정의만 제공. 화면엔 안 보임. */}
      <svg
        aria-hidden
        width="0"
        height="0"
        style={{ position: 'absolute', overflow: 'hidden' }}
      >
        <defs>
          <clipPath id={clipId} clipPathUnits="objectBoundingBox">
            {/* 원본 viewBox 100×90 좌표를 0–1 범위로 정규화한 하트 경로.
                상하 약간 여유를 두어 너무 끝까지 가지 않게 했다 (윗부분 0.07~,
                아랫점 0.95~). objectBoundingBox 라 컨테이너 비율이 1:1 이든
                4:5 든 컨테이너에 맞춰 하트가 자연스럽게 늘어난다. */}
            <path d="M0.5,0.95 C0.4,0.84 0.07,0.6 0.07,0.34 C0.07,0.18 0.21,0.07 0.32,0.07 C0.4,0.07 0.46,0.12 0.5,0.2 C0.54,0.12 0.6,0.07 0.68,0.07 C0.79,0.07 0.93,0.18 0.93,0.34 C0.93,0.6 0.6,0.84 0.5,0.95 Z" />
          </clipPath>
        </defs>
      </svg>
      <div
        className="h-full w-full"
        style={{
          clipPath: `url(#${clipId})`,
          WebkitClipPath: `url(#${clipId})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
