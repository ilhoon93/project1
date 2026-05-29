'use client';

import { useReducedMotion } from 'framer-motion';

const DEFAULT_BOKEH = '/wedding-snap/hero/bokeh.jpg';

/**
 * 히어로 영역의 추상 보케 배경 + ken-burns + 미세 꽃잎 오버레이.
 *
 * `imageUrl` 미지정 시 운영자가 업로드한 보케 사진(/wedding-snap/hero/bokeh.jpg)
 * 을 디폴트로 사용. 사진 없는 환경/테스트용으로 `imageUrl={null}` 를 명시하면
 * CSS 멀티 그라데이션 보케로 폴백.
 *
 * 가독성 보강:
 *  - 사진에 saturate(.85) + brightness(1.04) 필터 → 핑크 채도 살짝 누그러뜨림.
 *  - 상단 중앙에 cream 라디얼 베일 → 헤드라인 뒤에 "halo" 효과로 텍스트 가독성.
 *  - 하단 cream 페이드 → 다음 섹션과 연결 + 부제·CTA 영역 보정.
 *
 * `prefers-reduced-motion` 사용자에겐 모션 정지.
 */
export function HeroBackdrop({
  imageUrl = DEFAULT_BOKEH,
}: {
  imageUrl?: string | null;
}) {
  const reduce = useReducedMotion();

  const photoStyle = imageUrl
    ? {
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center 30%',
        // 핑크 채도 살짝 다운 + 미세 밝기 보정 → 코랄/잉크 텍스트 가독성 확보.
        filter: 'saturate(0.85) brightness(1.04)',
        animation: reduce ? undefined : 'kb-hero 14s ease-in-out infinite alternate',
      }
    : {
        // CSS 보케 폴백 — 따뜻한 파스텔 멀티 라디얼.
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
      };

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {/* 1) 보케 레이어 — 실제 사진 또는 CSS 폴백. */}
      <div className="absolute inset-0" style={photoStyle} />

      {/* 2) 상단 중앙 cream 라디얼 베일 — 헤드라인 뒤 "halo".
            사진 무드를 충분히 살리도록 강도 절제(0.42/0.15). */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 52% 40% at 50% 24%, rgba(252,241,234,0.42) 0%, rgba(252,241,234,0.15) 55%, rgba(252,241,234,0) 78%)',
        }}
      />

      {/* 3) 하단 cream 페이드 — 부제·CTA 가독성 + 다음 섹션과 매끄러운 연결.
            높이를 38% 로 줄여 사진이 더 많이 보이도록. */}
      <div className="absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-b from-transparent via-[var(--wd-cream)]/30 to-[var(--wd-cream)]" />

      {/* 4) 미세 꽃잎 오버레이 — reduce 시 생략. */}
      {!reduce && <Petals dim={!!imageUrl} />}
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

function Petals({ dim }: { dim?: boolean }) {
  // 사진 위에 얹을 땐 이미 보케·반짝이가 있으니 꽃잎 농도를 살짝 낮춰 중복 노이즈 방지.
  const opacity = dim ? 0.4 : 0.55;
  return (
    <>
      {PETALS.map((p, i) => (
        <span
          key={i}
          className="absolute -top-3 block h-[11px] w-[7px] rounded-[80%_0_80%_0]"
          style={{
            left: p.left,
            backgroundColor: p.tint,
            opacity,
            animation: `petal-drift ${p.dur} linear ${p.delay} infinite`,
          }}
        />
      ))}
    </>
  );
}
