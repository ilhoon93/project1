'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * Hero 영역의 중앙 폰 mockup + 양옆 4 폴라로이드 stage.
 *
 * - 폰 화면 안에서 실제 알림장 "메인 슬라이드" 느낌의 디자인 4 종(t1~t4)이
 *   4.5 초 간격으로 순환. 각 컷은 실제 카탈로그 사진 위에 이름·날짜를 얹어
 *   발행된 알림장 첫 화면을 그대로 보여준다.
 * - 양옆 폴라로이드 4 장은 실제 AI 스냅 결과 사진. 클릭 시
 *   /wedding-snap?style=... 로 이동, 호버 시 마이크로 카피 노출.
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

      {/* 중앙 폰 mockup — 실제 알림장 메인 슬라이드 4 종을 순환. */}
      <div className="absolute left-1/2 top-1/2 z-[5] h-[372px] w-[176px] -translate-x-1/2 -translate-y-1/2 -rotate-2 rounded-[32px] bg-[#15110E] p-[7px] shadow-[0_32px_72px_rgba(31,27,23,0.34)] sm:h-[452px] sm:w-[214px] sm:rounded-[36px]">
        <div className="absolute left-1/2 top-[15px] z-10 h-[5px] w-[54px] -translate-x-1/2 rounded-full bg-black" />
        <div className="relative h-full w-full overflow-hidden rounded-[26px] bg-white sm:rounded-[30px]">
          <PhoneTpl1 visible={tpl === 1} />
          <PhoneTpl2 visible={tpl === 2} />
          <PhoneTpl3 visible={tpl === 3} />
          <PhoneTpl4 visible={tpl === 4} />
        </div>
      </div>

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 font-italiana text-[9px] font-medium tracking-[0.32em] text-[var(--wd-coral)] opacity-55">
        EDITION 01 · 2026 · SEOUL
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

/* ─────────────── 폰 안 알림장 메인 슬라이드 4 종 ─────────────── */

function PhoneTpl1({ visible }: { visible: boolean }) {
  // 블러쉬/크림 톤 — 사진 + 세리프 이름.
  return (
    <TplShell visible={visible}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/wedding-snap/catalog/studio-floral-pastel.jpg"
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/60" />
      <div className="absolute inset-x-0 top-6 text-center font-italiana text-[9px] tracking-[0.34em] text-white/85">
        SAVE THE DATE
      </div>
      <div className="absolute inset-x-0 bottom-7 text-center text-white">
        <div
          className="text-[22px] leading-[1.4]"
          style={{ fontFamily: 'var(--font-noto-serif-kr), serif' }}
        >
          민준
          <span className="mx-1 italic text-[var(--wd-coral)]">&amp;</span>
          서연
        </div>
        <div className="mt-1.5 text-[9.5px] tracking-[0.24em] text-white/85">
          2026 · 05 · 23
        </div>
      </div>
    </TplShell>
  );
}

function PhoneTpl2({ visible }: { visible: boolean }) {
  // 미드나잇 톤 — 야경 사진 + 라틴 대문자 미니멀.
  return (
    <TplShell visible={visible}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/wedding-snap/catalog/seoul-nightview.jpg"
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/25 to-black/75" />
      <div className="absolute inset-x-5 top-8 text-[8px] tracking-[0.34em] text-white/70">
        WEDDING
      </div>
      <div className="absolute inset-x-5 top-1/2 -translate-y-1/2">
        <div className="h-px w-full bg-white/35" />
        <div className="my-4 text-[19px] font-medium leading-tight tracking-[0.12em] text-white">
          MINJUN
          <br />
          SEOYEON
        </div>
        <div className="h-px w-full bg-white/35" />
      </div>
      <div className="absolute inset-x-0 bottom-7 text-center text-[9px] tracking-[0.24em] text-white/80">
        2026 · 05 · 23 · SEOUL
      </div>
    </TplShell>
  );
}

function PhoneTpl3({ visible }: { visible: boolean }) {
  // 시네마틱 풀블리드 — ken-burns 로 살아있는 한 장.
  return (
    <TplShell visible={visible}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/wedding-snap/catalog/canola-field-walk.jpg"
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full origin-center animate-[ken-burns_9s_ease-in-out_infinite_alternate] object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/70" />
      <div className="absolute inset-x-0 bottom-8 text-center text-white">
        <div className="text-[20px]" style={{ fontFamily: 'var(--font-noto-serif-kr), serif' }}>
          민준 &amp; 서연
        </div>
        <div className="mt-1.5 text-[9.5px] tracking-[0.24em] opacity-90">
          결혼합니다
        </div>
      </div>
    </TplShell>
  );
}

function PhoneTpl4({ visible }: { visible: boolean }) {
  // 편지지 미니멀 — 사진 위쪽 + 아래 화이트 밴드 에디토리얼.
  return (
    <TplShell visible={visible}>
      <div className="absolute inset-x-0 top-0 h-[62%] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/wedding-snap/catalog/studio-arch-window-couple.jpg"
          alt=""
          draggable={false}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="absolute inset-x-0 bottom-0 flex h-[40%] flex-col items-center justify-center bg-[#FAFAF8] text-center">
        <div className="h-px w-7 bg-[#1A1A1A]" />
        <div className="mt-3 text-[18px] font-medium tracking-wide text-[#1A1A1A]">
          민준 · 서연
        </div>
        <div className="mt-1 text-[9.5px] tracking-[0.2em] text-[#8A857E]">결혼합니다</div>
        <div className="mt-3 text-[9px] tracking-[0.24em] text-[#5A554F]">2026 . 05 . 23</div>
      </div>
    </TplShell>
  );
}

function TplShell({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`absolute inset-0 overflow-hidden transition-opacity duration-700 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {children}
    </div>
  );
}
