import Link from 'next/link';
import type { Metadata } from 'next';
import { BrandMark } from '@/components/shared/BrandMark';
import { HeroStage } from '@/components/marketing/HeroStage';
import { ShowcaseTabs } from '@/components/marketing/ShowcaseTabs';
import { BeforeAfterSlider } from '@/components/marketing/BeforeAfterSlider';
import { CatalogStrip } from '@/components/marketing/CatalogStrip';
import { FadeUp } from '@/components/marketing/Motion';
import { HeroBackdrop } from '@/components/marketing/HeroBackdrop';
import { SideCaption } from '@/components/marketing/SideMarginalia';
import { getAvailableCatalog } from '@/lib/snap/catalog-availability';
import { catalogCountStat } from '@/lib/snap/catalog-display';
import {
  INVITATION_PRICE,
  INVITATION_OPTIONS,
  SNAP_PACKAGES,
  SNAP_STARTING_PRICE,
  formatKRW,
  freeRegenSummary,
} from '@/lib/snap/packages';
import { getHomeSamples } from '@/lib/marketing/home-samples';
import { getSocialProof, getPublishedCoupleCount } from '@/lib/marketing/social-proof';
import { SocialProof } from '@/components/marketing/SocialProof';
import type {
  AiSnapItem,
  BeforeAfterConfig,
  SampleDesign,
} from '@/lib/marketing/sample-invitations';

export const metadata: Metadata = {
  title: '우리다운 — 노웨딩·스몰웨딩 커플을 위한 결혼 알림장',
  description:
    '예식 없이도 우리의 소식을 전해요. 노웨딩·스몰웨딩 커플을 위한 감성 모바일 알림장 + AI 웨딩스냅.',
};

// 카탈로그가 admin 토글로 즉시 반영되도록 dynamic — wedding-snap 페이지와 동일 정책.
export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  const [catalog, home, socialProof, coupleCount] = await Promise.all([
    getAvailableCatalog(),
    getHomeSamples(),
    getSocialProof(),
    getPublishedCoupleCount(),
  ]);
  const catalogCount = catalog.length;

  return (
    <>
      <Hero aiSnaps={home.aiSnaps} designs={home.designs} />
      <SocialProof config={socialProof} coupleCount={coupleCount} />
      <DesignAndValues designs={home.designs} ownerUrlExample={home.ownerUrlExample} />
      <AiSnapPreview
        catalogCount={catalogCount}
        aiSnaps={home.aiSnaps}
        beforeAfter={home.beforeAfter}
      />
      <Pricing />
      <Footer />
    </>
  );
}

/* ─────────────────────── 1. Hero ─────────────────────── */

function Hero({ aiSnaps, designs }: { aiSnaps: AiSnapItem[]; designs: SampleDesign[] }) {
  // 데스크톱 양옆 빈 공간을 콘텐츠로 채우는 peek 폴라로이드 4장
  // (HeroStage 메인 0..3 다음, aiSnaps 4..7).
  // 화면 가장자리에 잘리지 않도록 안쪽(lg:left/right 2~5%) 으로 모음.
  const peeks = aiSnaps.slice(4, 8);

  return (
    <section className="relative isolate -mt-[72px] overflow-hidden px-6 pb-12 pt-[104px] text-center sm:pb-16 sm:pt-[120px]">
      {/* 추상 보케 백드롭 + ken-burns + 미세 꽃잎. 실제 보케 사진이 준비되면
          imageUrl prop 에 경로(예: '/wedding-snap/hero/bokeh.jpg') 전달.
          섹션의 `isolate` 가 stacking context 를 형성해 backdrop 의 -z-10 이
          섹션 안에 안전히 갇히도록 한다 (없으면 layout 배경 뒤로 escape).
          -mt-[72px] + pt-[104px] 로 헤더 높이만큼 위로 끌어올려 backdrop 이
          상단바 뒤까지 이어지게 — 헤더(투명) 와 메인 배경이 한 덩어리로 보임. */}
      <HeroBackdrop />

      {/* 데스크톱 사이드 peek 폴라로이드 — 좌 2장 + 우 2장. lg 이상 only,
          잘림 방지 위해 안쪽으로 모음. */}
      {peeks[0] && (
        <PeekPolaroid
          img={peeks[0].src}
          label={peeks[0].label}
          className="left-[2%] top-[18%] -rotate-[12deg] xl:left-[5%]"
        />
      )}
      {peeks[1] && (
        <PeekPolaroid
          img={peeks[1].src}
          label={peeks[1].label}
          className="left-[3%] top-[58%] -rotate-[6deg] xl:left-[6%]"
        />
      )}
      {peeks[2] && (
        <PeekPolaroid
          img={peeks[2].src}
          label={peeks[2].label}
          className="right-[2%] top-[18%] rotate-[10deg] xl:right-[5%]"
        />
      )}
      {peeks[3] && (
        <PeekPolaroid
          img={peeks[3].src}
          label={peeks[3].label}
          className="right-[3%] top-[58%] rotate-[6deg] xl:right-[6%]"
        />
      )}

      <FadeUp className="relative">
        <div className="mx-auto flex max-w-xl items-center justify-center gap-3">
          <span className="h-px w-6 bg-[var(--wd-coral)]/55" />
          <BrandMark size={20} />
          <span className="font-italiana text-[11px] font-medium tracking-[0.32em] text-[var(--wd-coral)]">
            우리다운 · WOORIDAUN
          </span>
          <span className="h-px w-6 bg-[var(--wd-coral)]/55" />
        </div>
      </FadeUp>

      <FadeUp delay={0.15} className="relative">
        <h1 className="mx-auto mt-6 text-balance break-keep text-[32px] font-medium leading-[1.36] tracking-tight sm:text-[36px]">
          <span className="whitespace-nowrap">예식 없이도,</span>
          <br />
          <em className="whitespace-nowrap not-italic text-[var(--wd-coral)]">
            우리의 소식을 전해요.
          </em>
        </h1>
      </FadeUp>

      <FadeUp delay={0.32} className="relative">
        <p className="mx-auto mt-5 max-w-[480px] break-keep text-[14.5px] leading-[1.75] text-[var(--wd-mute)]">
          노웨딩·스몰웨딩 커플을 위한 감성 모바일 알림장과 AI 웨딩스냅.
          <br />
          3분 만에 만들어 카카오톡으로 소식을 전하세요.
        </p>
      </FadeUp>

      <FadeUp delay={0.5} className="relative">
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/new"
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wd-ink)] px-6 py-3 text-[13px] font-medium text-[var(--wd-cream)] transition-transform active:scale-[0.97]"
          >
            무료로 알림장 만들기 →
          </Link>
          <Link
            href="/wedding-snap"
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wd-coral)] px-6 py-3 text-[13px] font-medium text-white transition-transform active:scale-[0.97]"
          >
            AI 화보 둘러보기
          </Link>
          <Link
            href="/designs"
            className="inline-flex items-center rounded-full border border-[var(--wd-coral)] bg-[var(--wd-paper)] px-6 py-3 text-[13px] font-medium text-[var(--wd-coral)] backdrop-blur transition-transform active:scale-[0.97] hover:bg-[var(--wd-coral)]/8"
          >
            디자인 둘러보기
          </Link>
        </div>
      </FadeUp>

      <HeroStage aiSnaps={aiSnaps} designs={designs} />
    </section>
  );
}

/** 데스크톱 양옆 가장자리에 살짝 걸쳐 보이는 폴라로이드 (lg 이상 only). */
function PeekPolaroid({
  img,
  label,
  className,
}: {
  img: string;
  label: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute hidden h-[180px] w-[130px] overflow-hidden rounded-[4px] border-[6px] border-[#FFFCF7] bg-[#EFE6DC] opacity-90 shadow-[0_18px_36px_rgba(31,27,23,0.22)] lg:block ${className ?? ''}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={img}
        alt={label}
        draggable={false}
        loading="lazy"
        className="h-full w-full object-cover"
      />
    </div>
  );
}

/* ─────────────────────── 2. 디자인 + 차별화 가치 ─────────────────────── */

function DesignAndValues({
  designs,
  ownerUrlExample,
}: {
  designs: SampleDesign[];
  ownerUrlExample: string;
}) {
  return (
    <section
      id="design-values"
      className="relative border-t border-[var(--wd-line)] px-6 py-14 sm:py-16"
    >
      <SideCaption text="DESIGN · MANY MOMENTS" side="left" topPct={42} />

      <div className="mx-auto max-w-3xl">
        <FadeUp scroll>
          <div className="font-italiana text-[11px] font-medium tracking-[0.18em] text-[var(--wd-coral)]">
            ONE NOTICE · MANY MOMENTS
          </div>
        </FadeUp>
        <FadeUp scroll delay={0.08}>
          {/* 2줄 고정 — 각 줄 whitespace-nowrap 로 의도치 않은 줄바꿈 방지.
              가장 긴 둘째 줄(13 한글자)이 320px 화면에서도 넘치지 않도록
              모바일은 20px, sm 이상은 22px. */}
          <h2 className="mt-2 break-keep text-[20px] font-medium leading-[1.45] tracking-tight sm:text-[22px]">
            <span className="whitespace-nowrap">정지된 청첩장이 아닌,</span>
            <br />
            <span className="whitespace-nowrap">함께 노는 가로 스와이프 알림장</span>
          </h2>
        </FadeUp>
        <FadeUp scroll delay={0.16}>
          <p className="mb-5 mt-2 max-w-[540px] break-keep text-[14px] leading-[1.75] text-[var(--wd-mute)]">
            손 끝으로 넘기며 보는 10개 섹션 — 디자인 테마, 폰트, 슬라이드 순서까지
            우리답게. <br/>발행 전까지{' '}
            <strong className="font-medium text-[var(--wd-ink)]">무료로 자유롭게</strong>{' '}
            만들어 보세요.
          </p>
        </FadeUp>

        {/* 핵심 가치 칩 — 긴 설명 대신 한눈에 스캔되도록. flex-wrap 으로 모바일에선
            자연스럽게 여러 줄. n 항목은 실제 코드 정의 개수로 표기. */}
        <FadeUp scroll delay={0.22}>
          <ul className="mb-7 flex flex-wrap gap-1.5">
            <KeyChip>⇄ 가로 스와이프</KeyChip>
            <KeyChip>움직이는 디자인</KeyChip>
            <KeyChip>200가지의 테마와 레이아웃 조합</KeyChip>
            <KeyChip>투표와 퀴즈 등 참여형 컨텐츠</KeyChip>
            <KeyChip>좋아요 가능한 갤러리</KeyChip>
            <KeyChip>손글씨를 담은 방명록</KeyChip>
            <KeyChip>신랑 신부를 위한 소장용 페이지</KeyChip>
          </ul>
        </FadeUp>

        <ShowcaseTabs designs={designs} ownerUrlExample={ownerUrlExample} />

        <div className="mt-7">
          <Link
            href="/designs"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--wd-ink)]/25 px-5 py-2.5 text-[13px] font-medium text-[var(--wd-ink)] transition-colors hover:border-[var(--wd-ink)]/50"
          >
            디자인 샘플 모아보기 →
          </Link>
        </div>
      </div>
    </section>
  );
}

/** 핵심 가치 칩 — 디자인 소개 섹션의 스캔용 pill. */
function KeyChip({ children }: { children: React.ReactNode }) {
  return (
    <li className="inline-flex items-center whitespace-nowrap rounded-full border border-[var(--wd-line)] bg-[var(--wd-paper)] px-3 py-1.5 text-[12px] font-medium text-[var(--wd-ink)]">
      {children}
    </li>
  );
}

/* ─────────────────────── 3. AI 웨딩스냅 미리보기 ─────────────────────── */

function AiSnapPreview({
  catalogCount,
  aiSnaps,
  beforeAfter,
}: {
  catalogCount: number;
  aiSnaps: AiSnapItem[];
  beforeAfter: BeforeAfterConfig;
}) {
  return (
    <section className="relative border-t border-[var(--wd-line)] bg-[var(--wd-paper)] px-6 py-14 sm:py-16">
      <SideCaption text="AI WEDDING SNAP" side="right" topPct={52} />

      <div className="mx-auto max-w-3xl">
        <FadeUp scroll>
          <div className="font-italiana text-[11px] font-medium tracking-[0.18em] text-[var(--wd-coral)]">
            AI WEDDING SNAP · BEFORE &amp; AFTER
          </div>
        </FadeUp>
        <FadeUp scroll delay={0.08}>
          <h2 className="mt-2 max-w-[20ch] text-balance break-keep text-[22px] font-medium leading-[1.45] tracking-tight">
            평소 사진 한 장이, 90초 만에 화보로
          </h2>
        </FadeUp>
        <FadeUp scroll delay={0.16}>
          <p className="mb-5 mt-2 max-w-[520px] break-keep text-[14px] leading-[1.75] text-[var(--wd-mute)]">
            스튜디오·메이크업·드레스 대여 없이, 셀카 한 장이면 우리만의 웨딩 사진이
            완성돼요. 핸들을 좌우로 드래그해 보세요.
          </p>
        </FadeUp>

        {/* 색 반전 강조 — 글자색(코랄)을 배경으로, 배경색(크림)을 글자색으로. */}
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--wd-coral)] px-3.5 py-1.5 text-[11.5px] font-semibold text-[var(--wd-cream)] shadow-sm">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--wd-cream)]" />
          신규 가입 후 1크레딧 무료, 첫 결제시 앵커 생성 무료
        </div>

        <BeforeAfterSlider config={beforeAfter} />

        <div className="mt-5 grid grid-cols-2 divide-x divide-[var(--wd-line)] rounded-2xl border border-[var(--wd-line)] bg-white py-4 text-center">
          <Stat number={catalogCountStat(catalogCount)} label="스타일 라인업" />
          <Stat number="약 2분" label="컷 당 평균 생성" />
        </div>

        <CatalogStrip catalogCount={catalogCount} aiSnaps={aiSnaps} />

        <div className="mt-6">
          <Link
            href="/wedding-snap"
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wd-ink)] px-5 py-2.5 text-[13px] font-medium text-[var(--wd-cream)]"
          >
            AI 화보 둘러보기 →
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
    <section id="pricing" className="relative border-t border-[var(--wd-line)] px-6 py-14 sm:py-16">
      <SideCaption text="PRICE · ONE-TIME" side="left" />

      {/* 좌: 알림장 가격 카드 / 우: AI 웨딩스냅 패키지 3종 — lg 이상에서 2열,
          이하에선 위·아래로 자연스럽게 스택. 두 상품 가격을 한 화면에서 비교하게. */}
      <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-2">
        <FadeUp scroll>
          <InvitationPricingCard />
        </FadeUp>
        <FadeUp scroll delay={0.08}>
          <SnapPricingCard />
        </FadeUp>
      </div>
    </section>
  );
}

function InvitationPricingCard() {
  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-2xl bg-[var(--wd-paper)] p-7 shadow-sm ring-1 ring-[var(--wd-line)]">
      {/* 이벤트 띠 — AI 스냅 카드와 동일 형식. 포토리뷰 작성 시 영구소장 무료 지급. */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-center gap-2 bg-[var(--wd-cream)] py-1.5 text-[11px] font-medium text-[var(--wd-ink)]">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--wd-coral)]" />
        <span className="font-italiana text-[10px] tracking-[0.26em] text-[var(--wd-coral)]">
          OPEN EVENT
        </span>
        <span>포토리뷰 작성 시 영구소장 무료</span>
      </div>
      <div className="mt-7 text-center">
        <p className="font-italiana text-xs tracking-[0.3em] text-[var(--wd-coral)]">
          INVITATION
        </p>
        <p className="mt-3 text-4xl font-semibold tracking-tight">
          {formatKRW(INVITATION_PRICE)}
        </p>
        <p className="mt-1 text-sm text-[var(--wd-mute)]">알림장 1건 · 일시불</p>
      </div>

      <ul className="mt-5 flex flex-col gap-1.5 text-left text-sm text-[var(--wd-mute)] [&>li]:break-keep">
        <li>· 메인·스토리·갤러리 등 10개 섹션 구성</li>
        <li>· 하객용, 소장용 URL 각각 제공</li>
        <li>· 하객 서명·퀴즈·투표·방명록 수집</li>
        <li>· 발행 후 30일간 공개</li>
        <li>· 혼인서약서 PDF·이미지 영구 소장</li>
      </ul>

      {/* 알림장 옵션 조합 — 총액 표기. AI 스냅 번들 옵션(snapBundle)은 알림장 카드에서 제외. */}
      <div className="mt-4 flex flex-col gap-1.5 rounded-xl border border-[var(--wd-line)] bg-[var(--wd-cream)] p-3 text-[12px] text-[var(--wd-mute)]">
        <p className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-[var(--wd-coral)]">
          옵션별 가격
        </p>
        {INVITATION_OPTIONS.filter((o) => !o.snapBundle).map((opt, i) => (
          <div
            key={opt.optionCode}
            className={i > 0 ? 'mt-1 border-t border-[var(--wd-line)] pt-2' : ''}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="break-keep text-[var(--wd-ink)]">{opt.label}</span>
              <span className="whitespace-nowrap font-semibold text-[var(--wd-ink)]">
                {formatKRW(INVITATION_PRICE + opt.addonPrice)}
              </span>
            </div>
            <p className="text-[10.5px] leading-relaxed">{opt.note}</p>
          </div>
        ))}
      </div>

      <Link
        href="/new"
        className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-[var(--wd-ink)] text-sm font-medium text-[var(--wd-cream)]"
      >
        알림장 시작하기
      </Link>
    </div>
  );
}

function SnapPricingCard() {
  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-2xl bg-[var(--wd-paper)] p-7 shadow-sm ring-1 ring-[var(--wd-line)]">
      {/* 오픈 이벤트 띠 — 카드 상단에 가로 띠로 항상 노출. wd 톤(cream + ink) 으로
          파란빛 없이 따뜻하게. */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-center gap-2 bg-[var(--wd-cream)] py-1.5 text-[11px] font-medium text-[var(--wd-ink)]">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--wd-coral)]" />
        <span className="font-italiana text-[10px] tracking-[0.26em] text-[var(--wd-coral)]">
          OPEN EVENT
        </span>
        <span>가입 즉시 1크레딧 무료</span>
      </div>
      <div className="mt-7 text-center">
        <p className="font-italiana text-xs tracking-[0.3em] text-[var(--wd-coral)]">
          AI WEDDING SNAP
        </p>
        <p className="mt-3 text-4xl font-semibold tracking-tight">
          {formatKRW(SNAP_STARTING_PRICE)}
          <span className="ml-1 text-base font-medium text-[var(--wd-mute)]">부터</span>
        </p>
        <p className="mt-1 text-sm text-[var(--wd-mute)]">
          패키지 {SNAP_PACKAGES.length}종 · 크레딧 충전
        </p>
      </div>

      <ul className="mt-5 flex flex-col gap-2">
        {SNAP_PACKAGES.map((p) => (
          <li
            key={p.code}
            className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 ${
              p.isPopular
                ? 'border-[var(--wd-coral)] bg-[var(--wd-cream)]'
                : 'border-[var(--wd-line)] bg-[var(--wd-paper)]'
            }`}
          >
            <div className="flex min-w-0 flex-col text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-medium text-[var(--wd-ink)]">
                  {p.name}
                </span>
                {p.isPopular && (
                  <span className="rounded-full bg-[var(--wd-coral)] px-1.5 py-0.5 text-[9.5px] font-medium text-white">
                    추천
                  </span>
                )}
              </div>
              <span className="text-[11px] text-[var(--wd-mute)]">
                크레딧 {p.credits}개
              </span>
            </div>
            <span className="flex-shrink-0 text-[13px] font-semibold text-[var(--wd-ink)]">
              {formatKRW(p.price)}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-[10.5px] leading-relaxed text-[var(--wd-mute)]">
        패키지 결제 시 카탈로그 결과 <strong className="text-[var(--wd-ink)]">재생성
        무료 크레딧</strong> 함께 적립 — {freeRegenSummary()}.
      </p>

      <Link
        href="/wedding-snap/create"
        className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-[var(--wd-coral)] text-sm font-medium text-white"
      >
        AI 스냅 만들기
      </Link>
      <p className="mt-2 text-center text-[11px] text-[var(--wd-mute)]">
        <Link href="/wedding-snap" className="underline hover:text-[var(--wd-ink)]">
          웨딩스냅 상세 보기 →
        </Link>
      </p>
    </div>
  );
}

/* ─────────────────────── 5. Footer ─────────────────────── */

function Footer() {
  return (
    <footer className="mx-auto max-w-3xl px-6 pb-12 pt-8 text-center">
      <p className="text-xs leading-relaxed text-[var(--wd-mute)]">
        © {new Date().getFullYear()} 우리다운 · 대표 강일훈 · 사업자등록번호 431-07-03350
      </p>
      <p className="mt-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-[var(--wd-mute)]">
        <a href="/faq" className="underline hover:text-[var(--wd-ink)]">
          자주 묻는 질문
        </a>
        <span aria-hidden>·</span>
        <a href="/legal/terms" className="underline hover:text-[var(--wd-ink)]">
          이용약관
        </a>
        <span aria-hidden>·</span>
        <a href="/legal/privacy" className="underline hover:text-[var(--wd-ink)]">
          개인정보처리방침
        </a>
        <span aria-hidden>·</span>
        <span>
          문의:{' '}
          <a
            href="https://talk.naver.com/ct/wiq8nf0"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[var(--wd-ink)]"
          >
            네이버 톡톡
          </a>
        </span>
      </p>
    </footer>
  );
}
