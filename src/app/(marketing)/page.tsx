import Link from 'next/link';
import type { Metadata } from 'next';
import { BrandMark } from '@/components/shared/BrandMark';
import { HeroStage } from '@/components/marketing/HeroStage';
import { ShowcaseTabs } from '@/components/marketing/ShowcaseTabs';
import { BeforeAfterSlider } from '@/components/marketing/BeforeAfterSlider';
import { getAvailableCatalog } from '@/lib/snap/catalog-availability';
import { catalogCountStat } from '@/lib/snap/catalog-display';
import { SNAP_STARTING_PRICE, formatKRW } from '@/lib/snap/packages';

export const metadata: Metadata = {
  title: '우리다운 — 우리 다운 결혼 알림장',
  description:
    '예식 없이도 우리의 소식을 전해요. 노웨딩·스몰웨딩 커플을 위한 감성 모바일 알림장 + AI 웨딩스냅.',
};

// 카탈로그가 admin 토글로 즉시 반영되도록 dynamic — wedding-snap 페이지와 동일 정책.
export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  // AI 스냅 섹션의 카운터에 실제 카탈로그 개수를 넣기 위한 server-side fetch.
  // wedding-snap/page.tsx 와 동일한 helper 라 캐시·인증 정책이 자동 일치.
  const catalog = await getAvailableCatalog();
  const catalogCount = catalog.length;

  return (
    <>
      <Hero />
      <DesignAndValues />
      <AiSnapPreview catalogCount={catalogCount} />
      <Pricing />
      <Footer />
    </>
  );
}

/* ─────────────────────── 1. Hero ─────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pb-12 pt-10 text-center sm:pb-16 sm:pt-14">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[55%] bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,253,248,0.55)_0%,transparent_70%)]"
      />

      <div className="relative mx-auto flex max-w-xl items-center justify-center gap-3">
        <span className="h-px w-6 bg-[var(--wd-coral)]/55" />
        <BrandMark size={20} />
        <span className="font-italiana text-[11px] font-medium tracking-[0.32em] text-[var(--wd-coral)]">
          우리다운 · WOORIDAUN
        </span>
        <span className="h-px w-6 bg-[var(--wd-coral)]/55" />
      </div>

      <h1 className="relative mx-auto mt-6 max-w-[14ch] text-[32px] font-medium leading-[1.36] tracking-tight sm:text-[36px]">
        예식 없이도,
        <br />
        <em className="not-italic text-[var(--wd-coral)]">우리의 소식을 전해요.</em>
      </h1>
      <p className="relative mx-auto mt-5 max-w-[460px] text-[14.5px] leading-[1.75] text-[var(--wd-mute)]">
        노웨딩·스몰웨딩 커플을 위한 감성 모바일 알림장 + AI 웨딩스냅.
        <br />
        3 분만에 만들어 카카오톡으로 전하세요.
      </p>

      <div className="relative mt-7 flex flex-wrap items-center justify-center gap-2">
        <Link
          href="/new"
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wd-ink)] px-6 py-3 text-[13px] font-medium text-[var(--wd-cream)] transition-transform active:scale-[0.97]"
        >
          3 분만에 만들기 →
        </Link>
        <Link
          href="/wedding-snap"
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wd-coral)] px-6 py-3 text-[13px] font-medium text-white transition-transform active:scale-[0.97]"
        >
          AI 화보 둘러보기
        </Link>
        <Link
          href="#design-values"
          className="inline-flex items-center rounded-full border border-[var(--wd-ink)]/25 bg-transparent px-6 py-3 text-[13px] font-medium text-[var(--wd-ink)]"
        >
          디자인 둘러보기
        </Link>
      </div>

      <HeroStage />
    </section>
  );
}

/* ─────────────────────── 2. 디자인 + 차별화 가치 ─────────────────────── */

function DesignAndValues() {
  return (
    <section
      id="design-values"
      className="border-t border-[var(--wd-line)] px-6 py-14 sm:py-16"
    >
      <div className="mx-auto max-w-3xl">
        <div className="font-italiana text-[11px] font-medium tracking-[0.18em] text-[var(--wd-coral)]">
          ONE NOTICE · MANY MOMENTS
        </div>
        <h2 className="mt-2 max-w-[18ch] text-[22px] font-medium leading-[1.45] tracking-tight">
          정지된 청첩장이 아닌, 짧은 영상 한 편 + 다섯 가지 약속
        </h2>
        <p className="mb-7 mt-2 max-w-[520px] text-[14px] leading-[1.75] text-[var(--wd-mute)]">
          움직이는 디자인 4 종 · 하객 참여 퀴즈 · A/B 투표 · 음성 방명록 · 발행 후
          PDF 로 소장하는 혼인서약서까지 — 한 알림장에 다 담겼어요.
        </p>

        <ShowcaseTabs />
      </div>
    </section>
  );
}

/* ─────────────────────── 3. AI 웨딩스냅 미리보기 ─────────────────────── */

function AiSnapPreview({ catalogCount }: { catalogCount: number }) {
  return (
    <section className="border-t border-[var(--wd-line)] px-6 py-14 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <div className="font-italiana text-[11px] font-medium tracking-[0.18em] text-[var(--wd-coral)]">
          AI WEDDING SNAP · BEFORE &amp; AFTER
        </div>
        <h2 className="mt-2 max-w-[20ch] text-[22px] font-medium leading-[1.45] tracking-tight">
          평소 사진 한 장이, 90 초 만에 화보로
        </h2>
        <p className="mb-5 mt-2 max-w-[520px] text-[14px] leading-[1.75] text-[var(--wd-mute)]">
          스튜디오·메이크업·드레스 대여 없이. 셀카 한 장이면 우리만의 웨딩 사진이
          완성됩니다. 핸들을 좌우로 드래그해보세요.
        </p>

        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--wd-coral)]/12 px-3.5 py-1.5 text-[11.5px] font-medium text-[var(--wd-coral)]">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--wd-coral)]" />
          신규 가입 후 첫 결제 시 5 장 무료 체험
        </div>

        <BeforeAfterSlider />

        <div className="mt-5 grid grid-cols-3 divide-x divide-[var(--wd-line)] rounded-2xl border border-[var(--wd-line)] bg-[var(--wd-paper)] py-4 text-center">
          <Stat number={catalogCountStat(catalogCount)} label="베스트샷 컷" />
          <Stat number="5" label="스타일 라인업" />
          <Stat number="≈90s" label="컷 당 평균 생성" />
        </div>

        <div className="mt-6">
          <Link
            href="/wedding-snap"
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wd-ink)] px-5 py-2.5 text-[13px] font-medium text-[var(--wd-cream)]"
          >
            AI 화보 둘러보기 · {formatKRW(SNAP_STARTING_PRICE)}부터 →
          </Link>
        </div>
      </div>
    </section>
  );
}

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div className="px-2">
      <div className="font-italiana text-[20px] tracking-wider text-[var(--wd-ink)]">
        {number}
      </div>
      <div className="mt-0.5 text-[10.5px] tracking-[0.12em] text-[var(--wd-mute)]">{label}</div>
    </div>
  );
}

/* ─────────────────────── 4. Pricing ─────────────────────── */

function Pricing() {
  return (
    <section className="border-t border-[var(--wd-line)] px-6 py-14 sm:py-16">
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl bg-[var(--wd-paper)] p-8 text-center shadow-sm ring-1 ring-[var(--wd-line)]">
          <p className="font-italiana text-xs tracking-[0.3em] text-[var(--wd-coral)]">PRICE</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight">9,900원</p>
          <p className="mt-1 text-sm text-[var(--wd-mute)]">알림장 1 건 · 일시불</p>

          <ul className="mt-6 flex flex-col gap-1.5 text-left text-sm text-[var(--wd-mute)]">
            <li>· 8 개 슬라이드 알림장 발행</li>
            <li>· AI 메인 사진 1 장 포함</li>
            <li>· 하객 서명·퀴즈·투표·방명록 수집</li>
            <li>· 혼인서약서 PDF · 이미지 다운로드</li>
            <li>· 결혼식 후 30 일 공개</li>
          </ul>

          <Link
            href="/new"
            className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-[var(--wd-ink)] text-sm font-medium text-[var(--wd-cream)]"
          >
            시작하기
          </Link>
          <p className="mt-3 text-[11px] text-[var(--wd-mute)]">
            AI 웨딩스냅 패키지는{' '}
            <Link href="/wedding-snap" className="underline hover:text-[var(--wd-ink)]">
              별도 안내
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── 5. Footer ─────────────────────── */

function Footer() {
  return (
    <footer className="mx-auto max-w-3xl px-6 pb-12 pt-8 text-center">
      <p className="text-xs text-[var(--wd-mute)]">
        © {new Date().getFullYear()} 우리다운 · 문의: hello@example.com
      </p>
    </footer>
  );
}
