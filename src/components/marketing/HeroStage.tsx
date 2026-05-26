'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * Hero 영역의 중앙 폰 mockup + 양옆 4 폴라로이드 stage.
 *
 * - 폰 화면 안에서 4 개의 알림장 디자인 템플릿(t1~t4) 이 4.5 초 간격으로 순환
 * - 양옆 폴라로이드 4 장은 AI 스냅 스타일별 진입 CTA — 클릭 시
 *   /wedding-snap?style=hanbok 같은 쿼리로 이동. 호버 시 마이크로 카피 노출.
 *
 * 페이지에 단 한 번만 마운트되며 모든 인터랙션이 이 컴포넌트로 캡슐화된다.
 */
export function HeroStage() {
  const [tpl, setTpl] = useState(1);

  useEffect(() => {
    const i = setInterval(() => setTpl((v) => (v % 4) + 1), 4500);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="relative mx-auto mt-10 h-[380px] max-w-[600px] sm:mt-12 sm:h-[460px]">
      <PolaroidCta
        href="/wedding-snap?style=hanbok"
        label="한복"
        gradient="ph-hanbok"
        className="absolute left-0 top-2 -rotate-[13deg] animate-[float-a_7s_ease-in-out_infinite]"
      />
      <PolaroidCta
        href="/wedding-snap?style=classic"
        label="클래식"
        gradient="ph-classic"
        className="absolute right-0 top-6 rotate-[9deg] animate-[float-b_8s_ease-in-out_infinite] [animation-delay:0.8s]"
      />
      <PolaroidCta
        href="/wedding-snap?style=outdoor"
        label="야외"
        gradient="ph-outdoor"
        className="absolute bottom-2 left-[3%] rotate-[8deg] animate-[float-c_7.5s_ease-in-out_infinite] [animation-delay:1.5s] sm:left-[6%]"
      />
      <PolaroidCta
        href="/wedding-snap?style=vintage"
        label="빈티지"
        gradient="ph-vintage"
        className="absolute bottom-4 right-[2%] -rotate-[10deg] animate-[float-d_6.8s_ease-in-out_infinite] [animation-delay:2.2s] sm:right-[3%]"
      />

      {/* 중앙 폰 mockup — 좁은 화면에선 약간 축소해 양옆 폴라로이드와 겹치지 않게. */}
      <div
        className="absolute left-1/2 top-1/2 z-[5] h-[312px] w-[148px] -translate-x-1/2 -translate-y-1/2 -rotate-2 rounded-[28px] bg-[#15110E] p-[6px] shadow-[0_28px_64px_rgba(31,27,23,0.32)] sm:h-[362px] sm:w-[172px] sm:rounded-[30px]"
      >
        <div className="absolute left-1/2 top-[14px] z-10 h-[5px] w-[50px] -translate-x-1/2 rounded-full bg-black" />
        <div className="relative h-full w-full overflow-hidden rounded-[24px] bg-white">
          <PhoneTpl1 visible={tpl === 1} />
          <PhoneTpl2 visible={tpl === 2} />
          <PhoneTpl3 visible={tpl === 3} />
          <PhoneTpl4 visible={tpl === 4} />
        </div>
      </div>

      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 font-italiana text-[9px] font-medium tracking-[0.32em] text-[var(--wd-coral)] opacity-55">
        EDITION 01 · 2026 · SEOUL
      </div>
    </div>
  );
}

function PolaroidCta({
  href,
  label,
  gradient,
  className,
}: {
  href: string;
  label: string;
  gradient: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={`${label} 스타일 AI 스냅 만들기`}
      className={`${className ?? ''} group block h-[132px] w-[96px] overflow-hidden rounded-[4px] border-[5px] border-[#FFFCF7] shadow-[0_10px_28px_rgba(31,27,23,0.18)] transition-transform hover:scale-[1.04] sm:h-[180px] sm:w-[132px] sm:border-[6px]`}
    >
      <div className={`relative h-full w-full ${gradient}`}>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" />
        <div className="absolute inset-x-2 bottom-2 z-[2] flex items-center justify-between text-[10px] font-medium text-white">
          <span>{label}</span>
          <span className="rounded-full bg-white/95 px-2 py-[2px] text-[8px] font-medium tracking-wider text-[var(--wd-ink)]">
            AI
          </span>
        </div>
        <div className="absolute inset-x-1.5 bottom-7 z-[2] translate-y-1 text-[9.5px] font-medium text-white opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-95">
          우리 얼굴로 만들기 →
        </div>
      </div>
    </Link>
  );
}

/* ─────────────── 폰 안 미니 디자인 템플릿 4 종 ─────────────── */

function PhoneTpl1({ visible }: { visible: boolean }) {
  return (
    <div
      className={`absolute inset-0 overflow-hidden bg-[#FCF1EA] px-3.5 pb-4 pt-9 text-center transition-opacity duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      {visible &&
        [0, 1.8, 3.5, 5].map((delay, i) => (
          <span
            key={i}
            style={{
              left: ['15%', '42%', '72%', '88%'][i],
              animationDelay: `${delay}s`,
              background: i % 2 === 0 ? '#D4837E' : '#E8A095',
            }}
            className="pointer-events-none absolute -top-2 h-[9px] w-[6px] animate-[petal-fall_7s_linear_infinite] rounded-[80%_0_80%_0] opacity-75"
          />
        ))}
      <div className="mt-5 text-[17px] leading-[1.5] text-[#5C2820]" style={{ fontFamily: 'var(--font-noto-serif-kr), serif' }}>
        민준<span className="block text-[24px] italic text-[var(--wd-coral)]">&amp;</span>서연
      </div>
      <div className="absolute inset-x-0 bottom-5 text-[9px] tracking-[0.22em] text-[#8B5448]">
        2025.06.15
      </div>
    </div>
  );
}

function PhoneTpl2({ visible }: { visible: boolean }) {
  return (
    <div
      className={`absolute inset-0 bg-[#15110E] px-4 pb-4 pt-9 text-[#F5F0E8] transition-opacity duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      <div className="text-[8px] tracking-[0.32em] opacity-55">WEDDING</div>
      <div className="my-3 h-px w-full bg-white/30" />
      <div className="my-4 text-[16px] font-medium leading-tight tracking-wider">
        MINJUN
        <br />
        SEOYEON
      </div>
      <div className="my-3 h-px w-full bg-white/30" />
      <div className="mt-3 text-[9px] leading-[1.8] tracking-wider opacity-70">
        2025.06.15
        <br />
        —<br />
        가족식사로
        <br />
        대신합니다
      </div>
    </div>
  );
}

function PhoneTpl3({ visible }: { visible: boolean }) {
  return (
    <div
      className={`absolute inset-0 overflow-hidden bg-[#2C2520] transition-opacity duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      <div
        className="absolute inset-0 animate-[ken-burns_8s_ease-in-out_infinite_alternate]"
        style={{
          background:
            'radial-gradient(circle at 30% 40%, #E8A095 0%, #8B5448 60%, #3D2017 100%)',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/75" />
      <div className="absolute inset-x-0 bottom-5 text-center text-white">
        <div className="text-[16px]" style={{ fontFamily: 'var(--font-noto-serif-kr), serif' }}>
          민준 &amp; 서연
        </div>
        <div className="mt-1 text-[9px] tracking-[0.22em] opacity-90">15 · JUN · 25</div>
      </div>
    </div>
  );
}

function PhoneTpl4({ visible }: { visible: boolean }) {
  return (
    <div
      className={`absolute inset-0 flex flex-col justify-center bg-[#FAFAF8] px-4 text-center transition-opacity duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      <div className="mx-auto h-px w-6 bg-[#1A1A1A]" />
      <div className="mb-1 mt-4 text-[16px] font-medium tracking-wide">민준 · 서연</div>
      <div className="text-[9px] tracking-[0.22em] text-[#888]">결혼합니다</div>
      <div className="mt-5 text-[9px] tracking-[0.26em] text-[#555]">2025.06.15</div>
    </div>
  );
}
