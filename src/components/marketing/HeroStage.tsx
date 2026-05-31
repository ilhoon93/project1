'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { AiSnapItem, SampleDesign } from '@/lib/marketing/sample-invitations';
import { InvitationPreview } from './InvitationPreview';

// 4개 폴라로이드의 고정 위치·회전·플로팅 애니메이션 (운영자가 고른 앞 4개에 순서대로 적용).
const POLAROID_POS = [
  'left-0 top-0 -rotate-[13deg] animate-[float-a_7s_ease-in-out_infinite]',
  'right-0 top-5 rotate-[9deg] animate-[float-b_8s_ease-in-out_infinite] [animation-delay:0.8s]',
  'bottom-1 left-[1%] rotate-[8deg] animate-[float-c_7.5s_ease-in-out_infinite] [animation-delay:1.5s] sm:left-[4%]',
  'bottom-3 right-0 -rotate-[10deg] animate-[float-d_6.8s_ease-in-out_infinite] [animation-delay:2.2s] sm:right-[2%]',
];

/**
 * Hero 영역의 중앙 폰 mockup + 양옆 4 폴라로이드 stage.
 *
 * - 폰 화면 안에서 실제 알림장 렌더러(InvitationSlides)로 만든 디자인 표지가
 *   4.5 초 간격으로 순환 — 발행된 알림장의 메인 슬라이드를 그대로 미리보기.
 * - 양옆 폴라로이드 4 장은 운영자가 고른 AI 스냅 사진(`aiSnaps` 앞 4개).
 *   클릭 시 AI 이미지 생성(/wedding-snap/create) 으로 이동.
 *
 * aiSnaps · designs 는 서버(getHomeSamples)에서 운영자 설정/기본값으로 해석돼 전달.
 */
export function HeroStage({
  aiSnaps,
  designs,
}: {
  aiSnaps: AiSnapItem[];
  designs: SampleDesign[];
}) {
  const heroDesigns = designs.slice(0, 6);
  const polaroids = aiSnaps.slice(0, 4);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (heroDesigns.length <= 1) return;
    const i = setInterval(() => setIdx((v) => (v + 1) % heroDesigns.length), 4500);
    return () => clearInterval(i);
  }, [heroDesigns.length]);

  const active = heroDesigns[idx % heroDesigns.length];

  return (
    <div className="relative mx-auto mt-10 h-[470px] max-w-[680px] sm:mt-14 sm:h-[600px]">
      {polaroids.map((snap, i) => (
        <PolaroidCta key={snap.id} snap={snap} className={`absolute ${POLAROID_POS[i]}`} />
      ))}

      {/* 중앙 폰 mockup — 실제 알림장 표지(메인 슬라이드)를 19.5:9 비율로 순환 미리보기. */}
      <div className="absolute left-1/2 top-1/2 z-[5] w-[206px] -translate-x-1/2 -translate-y-1/2 -rotate-2 rounded-[34px] bg-[#15110E] p-[8px] shadow-[0_34px_74px_rgba(31,27,23,0.36)] sm:w-[250px]">
        <div className="absolute left-1/2 top-[15px] z-20 h-[5px] w-[56px] -translate-x-1/2 rounded-full bg-black/80" />
        {/* 스크린 배경을 베젤(#15110E)과 동일하게 — 어두운 테마 슬라이드와 베젤
            사이 1px 흰색 seam(rounded-radius 안티에일리어싱)이 안 보이게.
            라이트 테마는 InvitationPreview 가 렌더 직후 자기 palette.bg 로 덮음. */}
        <div className="relative aspect-[6/13] w-full overflow-hidden rounded-[27px] bg-[#15110E]">
          {active && (
            <div
              key={active.id}
              className="absolute inset-0"
              style={{ animation: 'wd-fade 0.7s ease' }}
            >
              <InvitationPreview design={active} cover />
            </div>
          )}
        </div>
      </div>

      {active && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--wd-ink)]/8 px-3 py-1 font-italiana text-[9px] font-medium tracking-[0.26em] text-[var(--wd-coral)]">
          {active.name.toUpperCase()}
        </div>
      )}
    </div>
  );
}

function PolaroidCta({ snap, className }: { snap: AiSnapItem; className?: string }) {
  return (
    <Link
      href="/wedding-snap/create"
      aria-label={`${snap.label} 스타일로 AI 웨딩스냅 만들기`}
      className={`${className ?? ''} group block h-[152px] w-[112px] overflow-hidden rounded-[4px] border-[5px] border-[#FFFCF7] bg-[#EFE6DC] shadow-[0_12px_32px_rgba(31,27,23,0.2)] transition-transform hover:scale-[1.04] sm:h-[230px] sm:w-[170px] sm:border-[7px]`}
    >
      <div className="relative h-full w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={snap.src}
          alt={`${snap.label} AI 웨딩스냅 예시`}
          draggable={false}
          loading="eager"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/65" />
        <div className="absolute right-2 top-2 z-[2] rounded-full bg-white/95 px-2 py-[2px] text-[8px] font-medium tracking-wider text-[var(--wd-ink)]">
          AI
        </div>
        <div className="absolute inset-x-2 bottom-2 z-[2] text-[10px] font-medium text-white opacity-0 transition-all group-hover:opacity-95">
          우리 얼굴로 만들기 →
        </div>
      </div>
    </Link>
  );
}
