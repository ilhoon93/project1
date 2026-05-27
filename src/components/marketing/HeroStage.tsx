'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SAMPLE_DESIGNS } from '@/lib/marketing/sample-invitations';
import { InvitationPreview } from './InvitationPreview';

// 히어로 폰에서 순환할 디자인 표지 (가벼움 위해 일부만).
const HERO_DESIGNS = SAMPLE_DESIGNS.slice(0, 5);

/**
 * Hero 영역의 중앙 폰 mockup + 양옆 4 폴라로이드 stage.
 *
 * - 폰 화면 안에서 실제 알림장 렌더러(InvitationSlides)로 만든 디자인 표지가
 *   4.5 초 간격으로 순환 — 발행된 알림장의 메인 슬라이드를 그대로 미리보기.
 * - 양옆 폴라로이드 4 장은 실제 AI 스냅 결과 사진. 클릭 시
 *   /wedding-snap?style=... 로 이동, 호버 시 마이크로 카피 노출.
 *
 * 페이지에 단 한 번만 마운트되며 모든 인터랙션이 이 컴포넌트로 캡슐화된다.
 */
export function HeroStage() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const i = setInterval(() => setIdx((v) => (v + 1) % HERO_DESIGNS.length), 4500);
    return () => clearInterval(i);
  }, []);

  const active = HERO_DESIGNS[idx];

  return (
    <div className="relative mx-auto mt-10 h-[440px] max-w-[660px] sm:mt-14 sm:h-[560px]">
      <PolaroidCta
        href="/wedding-snap?style=hanbok"
        label="한복"
        img="/wedding-snap/catalog/hanbok-couple-studio.jpg"
        className="absolute left-0 top-2 -rotate-[13deg] animate-[float-a_7s_ease-in-out_infinite]"
      />
      <PolaroidCta
        href="/wedding-snap?style=classic"
        label="클래식"
        img="/wedding-snap/catalog/studio-couple-blackwhite.jpg"
        className="absolute right-0 top-6 rotate-[9deg] animate-[float-b_8s_ease-in-out_infinite] [animation-delay:0.8s]"
      />
      <PolaroidCta
        href="/wedding-snap?style=outdoor"
        label="야외"
        img="/wedding-snap/catalog/garden-champagne-toast.jpg"
        className="absolute bottom-2 left-[2%] rotate-[8deg] animate-[float-c_7.5s_ease-in-out_infinite] [animation-delay:1.5s] sm:left-[5%]"
      />
      <PolaroidCta
        href="/wedding-snap?style=vintage"
        label="빈티지"
        img="/wedding-snap/catalog/countryside-bicycle-sunset.jpg"
        className="absolute bottom-4 right-[1%] -rotate-[10deg] animate-[float-d_6.8s_ease-in-out_infinite] [animation-delay:2.2s] sm:right-[3%]"
      />

      {/* 중앙 폰 mockup — 실제 알림장 표지(메인 슬라이드)를 순환 미리보기. */}
      <div className="absolute left-1/2 top-1/2 z-[5] h-[372px] w-[176px] -translate-x-1/2 -translate-y-1/2 -rotate-2 rounded-[32px] bg-[#15110E] p-[7px] shadow-[0_32px_72px_rgba(31,27,23,0.34)] sm:h-[452px] sm:w-[214px] sm:rounded-[36px]">
        <div className="absolute left-1/2 top-[15px] z-10 h-[5px] w-[54px] -translate-x-1/2 rounded-full bg-black" />
        <div className="relative h-full w-full overflow-hidden rounded-[26px] bg-white sm:rounded-[30px]">
          <div
            key={active.id}
            className="absolute inset-0"
            style={{ animation: 'wd-fade 0.7s ease' }}
          >
            <InvitationPreview design={active} cover />
          </div>
        </div>
      </div>

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--wd-ink)]/8 px-3 py-1 font-italiana text-[9px] font-medium tracking-[0.26em] text-[var(--wd-coral)]">
        {active.name.toUpperCase()}
      </div>
    </div>
  );
}

function PolaroidCta({
  href,
  label,
  img,
  className,
}: {
  href: string;
  label: string;
  img: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={`${label} 스타일 AI 스냅 만들기`}
      className={`${className ?? ''} group block h-[150px] w-[110px] overflow-hidden rounded-[4px] border-[5px] border-[#FFFCF7] bg-[#EFE6DC] shadow-[0_12px_32px_rgba(31,27,23,0.2)] transition-transform hover:scale-[1.04] sm:h-[212px] sm:w-[156px] sm:border-[7px]`}
    >
      <div className="relative h-full w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img}
          alt={`${label} AI 웨딩스냅 예시`}
          draggable={false}
          loading="eager"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/65" />
        <div className="absolute inset-x-2 bottom-2 z-[2] flex items-center justify-between text-[11px] font-medium text-white">
          <span>{label}</span>
          <span className="rounded-full bg-white/95 px-2 py-[2px] text-[8px] font-medium tracking-wider text-[var(--wd-ink)]">
            AI
          </span>
        </div>
        <div className="absolute inset-x-2 bottom-8 z-[2] translate-y-1 text-[10px] font-medium text-white opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-95">
          우리 얼굴로 만들기 →
        </div>
      </div>
    </Link>
  );
}
