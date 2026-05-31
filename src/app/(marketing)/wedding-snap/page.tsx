import Link from 'next/link';
import type { Metadata } from 'next';
import { getAvailableCatalog } from '@/lib/snap/catalog-availability';
import type { SnapCatalogItem } from '@/lib/snap/catalog';
import { CatalogPreviewClient } from '@/components/snap/CatalogPreviewClient';
import {
  fetchCatalogStatsMap,
  type CatalogStatsMap,
} from '@/lib/snap/catalog-stats';
import { catalogCountLabel } from '@/lib/snap/catalog-display';
import { SNAP_STARTING_PRICE, formatKRW } from '@/lib/snap/packages';

export const metadata: Metadata = {
  title: 'AI 웨딩스냅 — 우리다운',
  description: `신랑·신부 셀카로 수십 가지 웨딩 베스트샷을 우리 얼굴로. ${formatKRW(
    SNAP_STARTING_PRICE,
  )}부터 시작하는 AI 웨딩 스튜디오.`,
};

// admin 태그 변경이 즉시 반영되도록 cache 없음 (양쪽 condition 모두 hidden 인
// 카탈로그는 landing 미리보기에서도 자동 제외됨).
export const dynamic = 'force-dynamic';

export default async function WeddingSnapLandingPage() {
  const [visibleCatalog, catalogStats] = await Promise.all([
    getAvailableCatalog(),
    fetchCatalogStatsMap(),
  ]);
  const catalogCount = visibleCatalog.length;
  // 섹션 순서 — Hero(소개+CTA) → AboutSnap → HowItWorks → CatalogPreview.
  // 패키지 라인업은 메인 페이지(/) Pricing 섹션으로 통합 — 가격을 한 화면에서
  // 비교할 수 있게.
  return (
    <main className="px-6 pb-20 pt-12 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <Hero catalogCount={catalogCount} />
        <AboutSnap />
        <HowItWorks catalogCount={catalogCount} />
        <CatalogPreview items={visibleCatalog} catalogStats={catalogStats} />
      </div>
    </main>
  );
}

/** 섹션 공통 제목 — /designs 와 동일한 위계(이브로우 + h2). */
function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-4">
      <p className="font-italiana text-[11px] font-medium tracking-[0.18em] text-[var(--wd-coral)]">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-[20px] font-medium leading-snug tracking-tight text-[var(--wd-ink)]">
        {title}
      </h2>
    </div>
  );
}

function Hero({ catalogCount }: { catalogCount: number }) {
  return (
    // 소개글 좌 + CTA 우(상단 정렬) — /designs 페이지와 동일한 레이아웃.
    // 페이지 열자마자 "지금 만들기" 가 viewport 안에 들어오게.
    <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:gap-6">
      <div className="min-w-0 flex-1">
        <div className="font-italiana text-[11px] font-medium tracking-[0.18em] text-[var(--wd-coral)]">
          AI WEDDING SNAP
        </div>
        <h1 className="mt-2 max-w-[20ch] text-balance break-keep text-[24px] font-medium leading-[1.4] tracking-tight text-[var(--wd-ink)] sm:text-[28px]">
          우리 둘 셀카 한 장이면, 웨딩 화보가 완성됩니다
        </h1>
        <p className="mt-2 max-w-[540px] break-keep text-[14px] leading-[1.75] text-[var(--wd-mute)]">
          스튜디오·한옥·도심 골든아워·바닷가·해외 풍경까지 —{' '}
          {catalogCountLabel(catalogCount)}의 베스트샷 중 마음에 드는 컷을 고르면
          우리 얼굴로 자연스럽게 합성해드려요.
        </p>
      </div>
      <Link
        href="/wedding-snap/create"
        className="inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--wd-ink)] px-5 py-3 text-[13px] font-medium text-[var(--wd-cream)] transition-transform active:scale-[0.97] sm:mt-1"
      >
        지금 만들기 →
      </Link>
    </div>
  );
}

function AboutSnap() {
  return (
    <section className="mt-14">
      <SectionHeading eyebrow="WHAT IS IT" title="AI 웨딩스냅이란?" />
      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--wd-line)] bg-[var(--wd-paper)] p-5 text-[14px] leading-[1.75] text-[var(--wd-mute)]">
        <p>
          <strong className="text-[var(--wd-ink)]">셀카</strong> 또는{' '}
          <strong className="text-[var(--wd-ink)]">커플사진 1장</strong>만 올리면,
          카탈로그 컷의 의상·배경·구도는 그대로 두고{' '}
          <strong className="text-[var(--wd-ink)]">얼굴·체형만 두 사람으로</strong>{' '}
          바꿔드려요. 키·몸무게를 입력하면 전신 비율까지 자연스럽게 맞춥니다.
        </p>
        <p>
          셀카 모드는 결제 후 첫 앵커(후보 4장 中 1장 선택)가{' '}
          <span className="text-emerald-700">무료</span>. 이후 카탈로그에서 원하는 컷을{' '}
          <strong className="text-[var(--wd-ink)]">1장당 크레딧 1개</strong>로
          만들고, 결과는 마이페이지에 자동 저장돼요. 재생성은 패키지별 무료 횟수 안에서 무료, 이후 1크레딧.
        </p>
        <p className="text-[12.5px] text-[var(--wd-mute)]">
          ※ 패키지 가격·크레딧 비교는{' '}
          <Link href="/#pricing" className="underline hover:text-[var(--wd-ink)]">
            메인 페이지 가격 안내
          </Link>{' '}
          에서 확인하실 수 있어요.
        </p>
      </div>
    </section>
  );
}

function HowItWorks({ catalogCount }: { catalogCount: number }) {
  const steps = [
    { n: 1, title: '신랑·신부 셀카 업로드', body: '정면 클로즈업 1장씩.(각자 1장 또는 정면·좌·우 3장) 30초면 끝.' },
    {
      n: 2,
      title: '카탈로그 컷 선택',
      body: `${catalogCountLabel(catalogCount)} 베스트샷 중 마음에 드는 만큼.`,
    },
    { n: 3, title: 'AI 가 합성', body: '컷당 평균 60~120초, 자연스러운 결과물 생성.' },
    {
      n: 4,
      title: '다운로드 + 청첩장 메인',
      body: '갤러리에서 모두 다운로드. 청첩장 메인 사진으로도 사용.',
    },
  ];
  return (
    <section className="mt-14">
      <SectionHeading eyebrow="HOW IT WORKS" title="진행 방법" />
      <ol className="grid gap-3 sm:grid-cols-2">
        {steps.map((s) => (
          <li
            key={s.n}
            className="flex gap-3 rounded-2xl border border-[var(--wd-line)] bg-[var(--wd-paper)] p-4"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--wd-ink)] text-xs font-semibold text-[var(--wd-cream)]">
              {s.n}
            </span>
            <div>
              <p className="text-sm font-medium text-[var(--wd-ink)]">{s.title}</p>
              <p className="mt-1 text-xs text-[var(--wd-mute)]">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function CatalogPreview({
  items,
  catalogStats,
}: {
  items: SnapCatalogItem[];
  catalogStats: CatalogStatsMap;
}) {
  return (
    <section className="mt-14">
      <SectionHeading eyebrow="GALLERY" title="카탈로그 미리보기" />
      <CatalogPreviewClient items={items} catalogStats={catalogStats} />
    </section>
  );
}
