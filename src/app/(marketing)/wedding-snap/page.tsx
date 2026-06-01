import Link from 'next/link';
import { Fragment } from 'react';
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
  description: `신랑·신부 셀카 또는 커플사진 한 장으로 수십 가지 웨딩 베스트샷. 가입 즉시 1크레딧 무료. ${formatKRW(
    SNAP_STARTING_PRICE,
  )}부터.`,
};

// admin 태그 변경이 즉시 반영되도록 cache 없음.
export const dynamic = 'force-dynamic';

// 가입 시 무료로 적립되는 스냅 크레딧 수. 결제·기능 로직(grant_welcome_snap_credit)
// 과 일치해야 한다.
const WELCOME_CREDIT = 1;

/**
 * 커플 모드 흐름 데모에 쓰는 카탈로그 id — couple-input-1.jpg 를
 * `garden-champagne-toast` 스타일로 변환한 결과(couple-result-1.jpg) 와 짝.
 * (해당 결과 이미지는 ExampleFlowModal 도 사용 — 동일 자산 재활용으로 일관성.)
 */
const COUPLE_FLOW = {
  input: '/wedding-snap/mode-examples/couple-input-1.jpg',
  catalog: '/wedding-snap/catalog/garden-champagne-toast.jpg',
  result: '/wedding-snap/mode-examples/couple-result-1.jpg',
};

const SELFIES_FLOW = {
  groomSelfies: [
    '/wedding-snap/mode-examples/selfies-groom-front.jpg',
    '/wedding-snap/mode-examples/selfies-groom-left.jpg',
    '/wedding-snap/mode-examples/selfies-groom-right.jpg',
  ],
  brideSelfies: [
    '/wedding-snap/mode-examples/selfies-bride-front.jpg',
    '/wedding-snap/mode-examples/selfies-bride-left.jpg',
    '/wedding-snap/mode-examples/selfies-bride-right.jpg',
  ],
  groomAnchor: '/wedding-snap/mode-examples/selfies-groom-anchor.jpg',
  brideAnchor: '/wedding-snap/mode-examples/selfies-bride-anchor.jpg',
  togetherResult: '/wedding-snap/mode-examples/selfies-together-result.jpg',
};

export default async function WeddingSnapLandingPage() {
  const [visibleCatalog, catalogStats] = await Promise.all([
    getAvailableCatalog(),
    fetchCatalogStatsMap(),
  ]);
  const catalogCount = visibleCatalog.length;
  // 섹션 — Hero(+오픈이벤트) → Stat → 두 가지 시작 → HowItWorks(시각) → 카탈로그 → CTA.
  return (
    <main className="px-6 pb-20 pt-12 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <Hero catalogCount={catalogCount} />
        <StatStrip catalogCount={catalogCount} />
        <TwoWaysToStart />
        <HowItWorks catalogCount={catalogCount} />
        <CatalogPreview items={visibleCatalog} catalogStats={catalogStats} />
        <FinalCta />
      </div>
    </main>
  );
}

/** 섹션 공통 제목 — /designs 와 동일한 위계(이브로우 + h2). */
function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-4">
      <p className="font-italiana text-[11px] font-medium tracking-[0.18em] text-[var(--wd-coral)]">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-[20px] font-medium leading-snug tracking-tight text-[var(--wd-ink)]">
        {title}
      </h2>
      {description && (
        <p className="mt-1.5 max-w-[600px] break-keep text-[13px] leading-[1.7] text-[var(--wd-mute)]">
          {description}
        </p>
      )}
    </div>
  );
}

function Hero({ catalogCount }: { catalogCount: number }) {
  return (
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

        {/* 오픈 이벤트 배지 — 가입 즉시 1크레딧 무료. 첫 화면 즉시 후크. */}
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--wd-coral)]/12 px-3.5 py-1.5 text-[12px] font-medium text-[var(--wd-coral)] ring-1 ring-[var(--wd-coral)]/25">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--wd-coral)]" />
          오픈 이벤트 · 가입 즉시 {WELCOME_CREDIT}크레딧 무료 (커플사진 1장 즉시 체험)
        </div>
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

/** 신뢰 지표 stat — Hero 바로 아래. 평균 시간 · 카탈로그 규모 · 컷당 단가. */
function StatStrip({ catalogCount }: { catalogCount: number }) {
  return (
    <ul className="mt-7 grid grid-cols-3 divide-x divide-[var(--wd-line)] rounded-2xl border border-[var(--wd-line)] bg-[var(--wd-paper)] py-4 text-center">
      <Stat number="≈ 90s" label="컷 당 평균 생성" />
      <Stat number={`${catalogCount}+`} label="베스트샷 카탈로그" />
      <Stat number="₩780~" label="컷 당 단가" />
    </ul>
  );
}

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <li className="px-2">
      <div className="font-italiana text-[20px] tracking-wider text-[var(--wd-ink)]">
        {number}
      </div>
      <div className="mt-0.5 text-[10.5px] tracking-[0.12em] text-[var(--wd-mute)]">
        {label}
      </div>
    </li>
  );
}

/** "두 가지 시작 방법" — 커플사진 모드(즉시 무료 체험 가능) + 셀카 모드(결제 후 앵커). */
function TwoWaysToStart() {
  return (
    <section className="mt-14">
      <SectionHeading
        eyebrow="HOW TO INPUT"
        title="두 가지로 시작할 수 있어요"
        description="가진 사진에 맞춰 두 가지 입력 방식 중 하나를 고르세요. 가입 즉시 받는 1크레딧으로는 커플사진 모드의 첫 1장을 무료로 만들어볼 수 있어요."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {/* 1) 커플사진 모드 — 즉시 1장 무료 체험 가능 (강조). */}
        <article className="relative flex flex-col gap-3 overflow-hidden rounded-2xl border-[1.5px] border-[var(--wd-coral)] bg-[var(--wd-cream)] p-4">
          <div className="absolute right-3 top-3 rounded-full bg-[var(--wd-coral)] px-2 py-0.5 text-[10px] font-medium text-white">
            가입 1크레딧 즉시 체험
          </div>
          <header>
            <p className="font-italiana text-[10px] tracking-[0.24em] text-[var(--wd-coral)]">
              MODE A
            </p>
            <h3 className="mt-1 text-[15px] font-medium text-[var(--wd-ink)]">
              커플사진 한 장으로
            </h3>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--wd-mute)]">
              이미 함께 찍은 사진이 있다면 가장 간단한 방법. 앵커 생성 단계 없이
              그 사진 한 장을 바로 카탈로그 컷에 적용해 컷당 1크레딧으로 만들어요.
            </p>
          </header>
          <FlowRow
            steps={[
              { src: COUPLE_FLOW.input, label: '커플사진 1장' },
              { src: COUPLE_FLOW.catalog, label: '카탈로그 컷 선택' },
              { src: COUPLE_FLOW.result, label: '결과 (1크레딧)', highlight: true },
            ]}
          />
        </article>

        {/* 2) 셀카 모드 — 결제 후 앵커 무료 batch. */}
        <article className="flex flex-col gap-3 rounded-2xl border border-[var(--wd-line)] bg-[var(--wd-paper)] p-4">
          <header>
            <p className="font-italiana text-[10px] tracking-[0.24em] text-[var(--wd-coral)]">
              MODE B
            </p>
            <h3 className="mt-1 text-[15px] font-medium text-[var(--wd-ink)]">
              각자 셀카로 (앵커 만들기)
            </h3>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--wd-mute)]">
              함께 찍은 사진이 없어도 OK. 신랑·신부 각자 셀카 1~3장(정면·좌·우)을
              올리면 AI 가 4장 앵커 후보를 만들어 1장 선택. 이후 카탈로그에 적용.
              <span className="block mt-1 text-[11px] text-[var(--wd-ink)]/70">
                ※ 앵커 batch 무료(첫 2회)는 <strong>결제 사용자 전용</strong>.
                가입 1크레딧으로는 진행 불가.
              </span>
            </p>
          </header>
          <FlowRow
            steps={[
              { src: SELFIES_FLOW.groomSelfies[0], label: '셀카 3장' },
              { src: SELFIES_FLOW.groomAnchor, label: '앵커 선택' },
              { src: SELFIES_FLOW.togetherResult, label: '함께 결과' },
            ]}
          />
        </article>
      </div>
    </section>
  );
}

/** 한 행 안에 N 단계 썸네일(폴라로이드 스타일) + 화살표. */
function FlowRow({
  steps,
}: {
  steps: { src: string; label: string; highlight?: boolean }[];
}) {
  return (
    <div className="flex items-center gap-1.5">
      {steps.map((s, i) => (
        <Fragment key={i}>
          <FlowThumb src={s.src} label={s.label} highlight={s.highlight} />
          {i < steps.length - 1 && (
            <span
              className="flex-shrink-0 select-none text-[14px] text-[var(--wd-mute)]"
              aria-hidden
            >
              →
            </span>
          )}
        </Fragment>
      ))}
    </div>
  );
}

function FlowThumb({
  src,
  label,
  highlight,
}: {
  src: string;
  label: string;
  highlight?: boolean;
}) {
  return (
    <figure
      className={`min-w-0 flex-1 overflow-hidden rounded-md border ${
        highlight ? 'border-[var(--wd-coral)]/60 bg-white' : 'border-[var(--wd-line)] bg-white'
      }`}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-[var(--wd-cream)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={label}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
      <figcaption
        className={`px-1.5 py-1 text-center text-[10px] ${
          highlight ? 'font-medium text-[var(--wd-coral)]' : 'text-[var(--wd-mute)]'
        }`}
      >
        {label}
      </figcaption>
    </figure>
  );
}

/** HowItWorks — 4단계, 각 카드에 실제 mode-examples 사진 박아 시각화. */
function HowItWorks({ catalogCount }: { catalogCount: number }) {
  const steps = [
    {
      n: 1,
      title: '사진 업로드',
      body: '커플사진 1장 또는 각자 셀카 1~3장. 30초면 끝.',
      img: COUPLE_FLOW.input,
    },
    {
      n: 2,
      title: '카탈로그 컷 선택',
      body: `${catalogCountLabel(catalogCount)} 베스트샷 중 마음에 드는 만큼.`,
      img: COUPLE_FLOW.catalog,
    },
    {
      n: 3,
      title: 'AI 가 합성',
      body: '컷당 평균 60~120초. 의상·배경·구도는 그대로, 얼굴·체형만 두 사람으로.',
      img: COUPLE_FLOW.result,
    },
    {
      n: 4,
      title: '다운로드 + 청첩장 메인',
      body: '갤러리에서 모두 다운로드. 청첩장 메인 사진으로도 사용.',
      // 결과 그리드 느낌 — 또 다른 함께 결과 컷.
      img: SELFIES_FLOW.togetherResult,
    },
  ];
  return (
    <section className="mt-14">
      <SectionHeading
        eyebrow="HOW IT WORKS"
        title="진행 방법"
        description="실제 흐름을 그대로 보여드려요. 어떤 사진을 넣으면 어떤 결과가 나오는지 한눈에 확인하세요."
      />
      <ol className="grid gap-3 sm:grid-cols-2">
        {steps.map((s) => (
          <li
            key={s.n}
            className="flex gap-3 overflow-hidden rounded-2xl border border-[var(--wd-line)] bg-[var(--wd-paper)] p-3"
          >
            {/* 좌측 사진 */}
            <div className="relative h-[88px] w-[64px] flex-shrink-0 overflow-hidden rounded-md bg-[var(--wd-cream)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.img}
                alt={s.title}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
            <div className="flex min-w-0 flex-1 items-start gap-2.5">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--wd-ink)] text-xs font-semibold text-[var(--wd-cream)]">
                {s.n}
              </span>
              <div className="min-w-0">
                <p className="text-[13.5px] font-medium text-[var(--wd-ink)]">
                  {s.title}
                </p>
                <p className="mt-1 break-keep text-[12px] leading-relaxed text-[var(--wd-mute)]">
                  {s.body}
                </p>
              </div>
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
      <SectionHeading
        eyebrow="GALLERY"
        title="카탈로그 미리보기"
        description="실제로 만들 수 있는 컷의 일부예요. 만들기 페이지에서 더 자세히 둘러보고 필터링할 수 있어요."
      />
      <CatalogPreviewClient items={items} catalogStats={catalogStats} />
    </section>
  );
}

/** 최종 CTA — 오픈 이벤트 한 번 더 강조 + 큰 버튼. */
function FinalCta() {
  return (
    <section className="mt-16">
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-[var(--wd-coral)]/30 bg-[var(--wd-cream)] px-6 py-8 text-center">
        <p className="font-italiana text-[11px] tracking-[0.32em] text-[var(--wd-coral)]">
          OPEN EVENT
        </p>
        <h3 className="text-[20px] font-medium leading-snug tracking-tight text-[var(--wd-ink)]">
          가입 즉시 1크레딧 무료
          <br className="sm:hidden" /> — 커플사진 1장 무료 체험
        </h3>
        <p className="max-w-md break-keep text-[13px] leading-relaxed text-[var(--wd-mute)]">
          만들고 마음에 드는 컷이 있으면 그때 패키지를 결제해도 늦지 않아요.
          만든 결과물은 마이페이지에 영구 보관됩니다.
        </p>
        <Link
          href="/wedding-snap/create"
          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--wd-ink)] px-6 py-3 text-[13.5px] font-medium text-[var(--wd-cream)] transition-transform active:scale-[0.97]"
        >
          지금 만들기 →
        </Link>
        <p className="text-[11px] text-[var(--wd-mute)]">
          ※ 셀카 모드 앵커 batch 무료(첫 2회) 혜택은 결제 사용자 전용입니다.
        </p>
      </div>
    </section>
  );
}
