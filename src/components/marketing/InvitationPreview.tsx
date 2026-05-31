'use client';

import { useEffect, useRef, useState } from 'react';
import { InvitationSlides } from '@/components/invitation/InvitationSlides';
import { coverContent, type SampleDesign } from '@/lib/marketing/sample-invitations';

/**
 * 마케팅 화면에서 실제 알림장 렌더러(InvitationSlides)를 왜곡 없이 띄우는 래퍼.
 *
 * 슬라이드 내부는 cqw/cqh(컨테이너 쿼리) 단위로 그려지지만, 화살표·인디케이터
 * 같은 일부 요소는 고정 px 라 작은 박스에 그냥 넣으면 비율이 깨진다. 그래서
 * 고정 기준 디바이스(390×780, 9:18)에 렌더한 뒤 박스 전체를 균일 transform:
 * scale 로 줄여 프레임에 맞춘다 → 폰트·간격·효과·비율이 실제 디바이스와
 * 동일하게(왜곡 없이) 보인다.
 *
 * 부모(프레임)는 반드시 9:18 비율이어야 가로/세로가 정확히 채워진다.
 * cover=true 면 메인 슬라이드(표지) 한 장만, false 면 전체 슬라이드(스크롤).
 */
const BASE_W = 390;
// 18:9 (= 9:18 세로 비율). 390 × 18/9 = 780.
const BASE_H = 780;

export function InvitationPreview({
  design,
  cover = false,
}: {
  design: SampleDesign;
  cover?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / BASE_W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const content = cover ? coverContent(design.content) : design.content;

  return (
    <div ref={ref} className="relative h-full w-full overflow-hidden">
      <div
        className="absolute left-0 top-0 origin-top-left transition-opacity duration-300"
        style={{
          width: BASE_W,
          height: BASE_H,
          transform: `scale(${scale})`,
          opacity: scale ? 1 : 0,
        }}
      >
        <InvitationSlides
          invitationId={`sample-${design.id}`}
          groomName={design.groomName}
          brideName={design.brideName}
          weddingDate={design.weddingDate}
          content={content}
          isPreview
          scoped
        />
      </div>
    </div>
  );
}
