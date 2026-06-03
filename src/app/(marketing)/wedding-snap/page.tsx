import Link from 'next/link';
import type { Metadata } from 'next';
import { getAvailableCatalog } from '@/lib/snap/catalog-availability';
import type { SnapCatalogItem } from '@/lib/snap/catalog';
import { CatalogPreviewClient } from '@/components/snap/CatalogPreviewClient';
import { SnapModeCards } from '@/components/marketing/SnapModeCards';
import {
  fetchCatalogStatsMap,
  type CatalogStatsMap,
} from '@/lib/snap/catalog-stats';
import { catalogCountLabel } from '@/lib/snap/catalog-display';
import { SNAP_STARTING_PRICE, formatKRW } from '@/lib/snap/packages';
import { getExampleFlow } from '@/lib/marketing/home-samples';
import type { ExampleFlowConfig } from '@/lib/marketing/sample-invitations';

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
 * 모드별 흐름 데모 — ExampleFlowModal 의 EXAMPLE_CATALOG_IDS 와 동일 매핑.
 * 카탈로그 마스터 ↔ 결과 사진이 같은 짝이어야 사용자에게 일관되게 보임.
 */
const COUPLE_FLOW = {
  input: '/wedding-snap/mode-examples/couple-input-1.jpg',
  // 'studio-couple-puppy' = couple-result-1.jpg 의 짝 (ExampleFlowModal 와 일치).
  catalog: '/wedding-snap/catalog/studio-couple-puppy.jpg',
  result: '/wedding-snap/mode-examples/couple-result-1.jpg',
};

/** 셀카 → 앵커 → 카탈로그 → 결과 4 step 흐름. solo / together 3 가지. */
const SELFIES_FLOWS = {
  groomSolo: {
    selfie: '/wedding-snap/mode-examples/selfies-groom-front.jpg',
    anchor: '/wedding-snap/mode-examples/selfies-groom-anchor.jpg',
    catalog: '/wedding-snap/catalog/groom-hotel-stairs.jpg',
    result: '/wedding-snap/mode-examples/selfies-groom-result.jpg',
  },
  brideSolo: {
    selfie: '/wedding-snap/mode-examples/selfies-bride-front.jpg',
    anchor: '/wedding-snap/mode-examples/selfies-bride-anchor.jpg',
    catalog: '/wedding-snap/catalog/bride-paris-eiffel.jpg',
    result: '/wedding-snap/mode-examples/selfies-bride-result.jpg',
  },
  together: {
    selfie: '/wedding-snap/mode-examples/selfies-groom-front.jpg',
    anchor: '/wedding-snap/mode-examples/selfies-groom-anchor.jpg',
    catalog: '/wedding-snap/catalog/garden-finger-heart.jpg',
    result: '/wedding-snap/mode-examples/selfies-together-result.jpg',
  },
};

export default async function WeddingSnapLandingPage() {
  const [visibleCatalog, catalogStats, exampleFlow] = await Promise.all([
    getAvailableCatalog(),
    fetchCatalogStatsMap(),
    getExampleFlow(),
  ]);
  const catalogCount = visibleCatalog.length;
  // 섹션 — Hero(+오픈이벤트) → Stat → 두 가지 시작 → HowItWorks(시각) → 카탈로그 → CTA.
  return (
    <main className="px-6 pb-20 pt-12 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <Hero catalogCount={catalogCount} />
        <StatStrip catalogCount={catalogCount} />
        <HowToInput exampleFlow={exampleFlow} />
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
    <div>
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

      {/* 오픈 이벤트 배지 + 지금 만들기 CTA 가 한 줄에 — 배지 좌측, 버튼 우측 정렬.
          모바일에서 배지가 길어지면 줄바꿈, 버튼은 항상 우측 끝 유지. */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-2 rounded-full bg-[var(--wd-coral)] px-2.5 py-1.5 text-[12px] font-medium text-white shadow-sm ring-1 ring-[var(--wd-coral)]/40">
          <span className="font-italiana inline-flex items-center rounded-full bg-[var(--wd-ink)]/85 px-2 py-0.5 text-[9.5px] tracking-[0.28em] text-[var(--wd-cream)]">
            OPEN EVENT
          </span>
          <span className="pl-0.5">가입 즉시 {WELCOME_CREDIT}크레딧 무료</span>
          <span className="rounded-full bg-white/22 px-2 py-0.5 text-[11px] text-white/95">
            커플사진 1장 즉시 체험
          </span>
        </div>
        <Link
          href="/wedding-snap/create"
          className="ml-auto inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--wd-ink)] px-5 py-3 text-[13px] font-medium text-[var(--wd-cream)] transition-transform active:scale-[0.97]"
        >
          지금 만들기 →
        </Link>
      </div>
    </div>
  );
}

/** 신뢰 지표 stat — Hero 바로 아래. 평균 시간 · 카탈로그 규모 · 패키지 시작가. */
function StatStrip({ catalogCount }: { catalogCount: number }) {
  return (
    <ul className="mt-7 grid grid-cols-3 divide-x divide-[var(--wd-line)] rounded-2xl border border-[var(--wd-line)] bg-[var(--wd-paper)] py-4 text-center">
      <Stat number="약 2분" label="컷 당 평균 생성" />
      <Stat number={`${catalogCount}+`} label="베스트샷 카탈로그" />
      <Stat number={formatKRW(SNAP_STARTING_PRICE)} label="패키지 시작가" />
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

/** "HOW TO INPUT" 섹션 wrapper — SectionHeading + client 카드(SnapModeCards).
 * 사진 시퀀스는 모두 SnapModeCards 안의 "예시 보기" 버튼 → ExampleFlowModal 로 위임. */
function HowToInput({ exampleFlow }: { exampleFlow: ExampleFlowConfig }) {
  return (
    <section className="mt-14">
      <SectionHeading
        eyebrow="HOW TO INPUT"
        title="두 가지로 시작할 수 있어요"
        description="가진 사진에 맞춰 두 가지 입력 방식 중 하나를 고르세요."
      />
      <SnapModeCards exampleFlow={exampleFlow} />
    </section>
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
      body: '컷당 평균 약 2분. 의상·배경·구도는 그대로, 얼굴·체형만 두 사람으로.',
      img: COUPLE_FLOW.result,
    },
    {
      n: 4,
      title: '다운로드 & 활용',
      body: '갤러리에서 모두 다운로드. 청첩장 메인 사진으로도 사용.',
      // 결과 그리드 느낌 — 셀카 함께 모드 결과 컷.
      img: SELFIES_FLOWS.together.result,
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
        description=" "
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
          만든 결과물은 마이페이지에 영구 보관되고 다운로드해 언제든 활용할 수 있어요.
        </p>
        <Link
          href="/wedding-snap/create"
          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--wd-ink)] px-6 py-3 text-[13.5px] font-medium text-[var(--wd-cream)] transition-transform active:scale-[0.97]"
        >
          지금 만들기 →
        </Link>

      </div>
    </section>
  );
}
