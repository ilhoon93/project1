'use client';

import { useReducedMotion } from 'framer-motion';

/**
 * 히어로 영역의 추상 보케 배경 + ken-burns + 미세 꽃잎 오버레이.
 *
 * 디자인 근거: 우리다운 브랜드 톤 (크림/코랄/블러쉬 파스텔, italiana 캡션, 에디토리얼)
 * 에 맞춰 인물·디테일이 없는 **추상 정물** 백드롭을 둔다. 다른 영역에 이미 실사진
 * 콘텐츠(폴라로이드·폰·카탈로그 스트립)가 풍부해서, 히어로는 무드/분위기 레이어로
 * 빠지고 헤드라인이 돋보이도록 한다.
 *
 * `imageUrl` 을 넘기면 실제 보케 사진을 그대로 사용. 없으면 CSS 멀티 그라데이션으로
 * 보케를 흉내낸다 (운영 즉시 visible — 실제 사진이 준비되면 한 줄로 교체).
 *
 * `prefers-reduced-motion` 사용자에겐 모션 정지 — globals.css 가드 + framer-motion
 * useReducedMotion 둘 다 활용.
 */
export function HeroBackdrop({ imageUrl }: { imageUrl?: string | null }) {
  const reduce = useReducedMotion();

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {/* 보케 레이어 — 실제 사진 또는 CSS 멀티 그라데이션. */}
      <div
        className="absolute inset-0"
        style={
          imageUrl
            ? {
                backgroundImage: `url(${imageUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center 30%',
                animation: reduce ? undefined : 'kb-hero 14s ease-in-out infinite alternate',
              }
            : {
                // CSS 보케 — 따뜻한 파스텔(피치·블러쉬·크림) 멀티 레이어 라디얼 + 베이스.
                // 인물·디테일 없음. 큰 부드러운 블롭이 아닌 자연스러운 보케 분포.
                backgroundImage: `
                  radial-gradient(36% 30% at 18% 20%, rgba(245, 213, 196, 0.92) 0%, rgba(245, 213, 196, 0) 70%),
                  radial-gradient(42% 36% at 76% 22%, rgba(232, 180, 170, 0.82) 0%, rgba(232, 180, 170, 0) 65%),
                  radial-gradient(32% 26% at 58% 56%, rgba(248, 226, 215, 0.78) 0%, rgba(248, 226, 215, 0) 65%),
                  radial-gradient(26% 22% at 22% 70%, rgba(214, 188, 172, 0.6) 0%, rgba(214, 188, 172, 0) 70%),
                  radial-gradient(22% 18% at 88% 78%, rgba(244, 196, 178, 0.6) 0%, rgba(244, 196, 178, 0) 70%),
                  radial-gradient(14% 12% at 38% 32%, rgba(255, 235, 220, 0.6) 0%, rgba(255, 235, 220, 0) 70%),
                  radial-gradient(10% 10% at 70% 70%, rgba(255, 235, 220, 0.55) 0%, rgba(255, 235, 220, 0) 70%),
                  linear-gradient(180deg, #fbe5d8 0%, #fcf1ea 70%, #fcf1ea 100%)
                `,
                animation: reduce ? undefined : 'kb-hero 14s ease-in-out infinite alternate',
              }
        }
      />

      {/* 하단 cream 페이드 — 다음 섹션과 매끄럽게 연결 + 텍스트 가독성 보강. */}
      <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-b from-transparent via-[var(--wd-cream)]/40 to-[var(--wd-cream)]" />

      {/* 미세 꽃잎 오버레이 — 6장, 다른 위치/지연/속도. reduce 시 생략. */}
      {!reduce && <Petals />}
    </div>
  );
}

const PETALS = [
  { left: '8%',  delay: '0s',   dur: '14s', tint: '#D49585' },
  { left: '22%', delay: '4s',   dur: '16s', tint: '#E8B6A8' },
  { left: '40%', delay: '7s',   dur: '13s', tint: '#D49585' },
  { left: '58%', delay: '2s',   dur: '15s', tint: '#EFC9B8' },
  { left: '74%', delay: '9s',   dur: '17s', tint: '#E8B6A8' },
  { left: '88%', delay: '5.5s', dur: '14s', tint: '#D49585' },
];

function Petals() {
  return (
    <>
      {PETALS.map((p, i) => (
        <span
          key={i}
          className="absolute -top-3 block h-[11px] w-[7px] rounded-[80%_0_80%_0]"
          style={{
            left: p.left,
            backgroundColor: p.tint,
            opacity: 0.55,
            animation: `petal-drift ${p.dur} linear ${p.delay} infinite`,
          }}
        />
      ))}
    </>
  );
}
