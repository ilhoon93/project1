import Link from 'next/link';
import type { Metadata } from 'next';
import { BrandMark } from '@/components/shared/BrandMark';
import { HeroStage } from '@/components/marketing/HeroStage';
import { ShowcaseTabs } from '@/components/marketing/ShowcaseTabs';
import { BeforeAfterSlider } from '@/components/marketing/BeforeAfterSlider';
import { CatalogStrip } from '@/components/marketing/CatalogStrip';
import { FadeUp } from '@/components/marketing/Motion';
import { HeroBackdrop } from '@/components/marketing/HeroBackdrop';
import { OwnerUrlButton } from '@/components/marketing/OwnerUrlButton';
import { SideCaption } from '@/components/marketing/SideMarginalia';
import { getAvailableCatalog } from '@/lib/snap/catalog-availability';
import { catalogCountStat } from '@/lib/snap/catalog-display';
import { SNAP_STARTING_PRICE, formatKRW } from '@/lib/snap/packages';
import { getHomeSamples } from '@/lib/marketing/home-samples';
import type {
  AiSnapItem,
  BeforeAfterConfig,
  SampleDesign,
} from '@/lib/marketing/sample-invitations';

export const metadata: Metadata = {
  title: '우리다운 — 우리 다운 결혼 알림장',
  description:
    '예식 없이도 우리의 소식을 전해요. 노웨딩·스몰웨딩 커플을 위한 감성 모바일 알림장 + AI 웨딩스냅.',
};

// 카탈로그가 admin 토글로 즉시 반영되도록 dynamic — wedding-snap 페이지와 동일 정책.
export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  const [catalog, home] = await Promise.all([getAvailableCatalog(), getHomeSamples()]);
  const catalogCount = catalog.length;

  return (
    <>
      <Hero aiSnaps={home.aiSnaps} designs={home.designs} />
      <DesignAndValues designs={home.designs} />
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
        <h1 className="mx-auto mt-6 max-w-[15ch] text-balance break-keep text-[32px] font-medium leading-[1.36] tracking-tight sm:text-[36px]">
          예식 없이도,{' '}
          <em className="not-italic text-[var(--wd-coral)]">우리의 소식을 전해요.</em>
        </h1>
      </FadeUp>

      <FadeUp delay={0.32} className="relative">
        <p className="mx-auto mt-5 max-w-[430px] break-keep text-[14.5px] leading-[1.75] text-[var(--wd-mute)]">
          노웨딩·스몰웨딩 커플을 위한 감성 모바일 알림장과 AI 웨딩스냅. 3분 만에
          만들어 카카오톡으로 소식을 전하세요.
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

function DesignAndValues({ designs }: { designs: SampleDesign[] }) {
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
          <h2 className="mt-2 max-w-[20ch] text-balance break-keep text-[22px] font-medium leading-[1.45] tracking-tight">
            정지된 청첩장이 아닌, 함께 노는 한 편의 알림장
          </h2>
        </FadeUp>
        <FadeUp scroll delay={0.16}>
          <p className="mb-7 mt-2 max-w-[540px] break-keep text-[14px] leading-[1.75] text-[var(--wd-mute)]">
            14가지 컬러 테마와 살아 움직이는 배경, 하객이 함께하는 퀴즈와 A/B 투표,
            손글씨 서명을 남기는 방명록, 발행 후 PDF로 간직하는 혼인서약서까지. 메인부터
            엔딩까지 10개 섹션을 우리답게 구성하세요. 발행 후엔 신랑·신부 전용 소장용
            URL이 발급돼 하객 메시지·서명·퀴즈/투표 결과·축하 카운트를 한곳에 모아
            평생 간직할 수 있어요.
          </p>
        </FadeUp>

        <ShowcaseTabs designs={designs} />

        <div className="mt-7 flex flex-wrap items-center gap-2">
          <Link
            href="/designs"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--wd-ink)]/25 px-5 py-2.5 text-[13px] font-medium text-[var(--wd-ink)] transition-colors hover:border-[var(--wd-ink)]/50"
          >
            디자인 샘플 모아보기 →
          </Link>
          {/* 혼인서약서 PDF 와 같은 결의 "소장용 URL" 안내 버튼 — 클릭 시 예시
              URL 팝업. 알림장 소개 맥락 안에서 어떤 게 평생 남는지 보여줌. */}
          <OwnerUrlButton />
        </div>
      </div>
    </section>
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

        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--wd-coral)]/12 px-3.5 py-1.5 text-[11.5px] font-medium text-[var(--wd-coral)]">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--wd-coral)]" />
          신규 가입 후 첫 결제 시 5장 무료 체험
        </div>

        <BeforeAfterSlider config={beforeAfter} />

        <div className="mt-5 grid grid-cols-2 divide-x divide-[var(--wd-line)] rounded-2xl border border-[var(--wd-line)] bg-white py-4 text-center">
          <Stat number={catalogCountStat(catalogCount)} label="스타일 라인업" />
          <Stat number="≈90s" label="컷 당 평균 생성" />
        </div>

        <CatalogStrip catalogCount={catalogCount} aiSnaps={aiSnaps} />

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
    <section className="relative border-t border-[var(--wd-line)] px-6 py-14 sm:py-16">
      <SideCaption text="PRICE · ONE-TIME" side="left" />

      <div className="mx-auto max-w-md">
        <FadeUp scroll>
          <div className="rounded-2xl bg-[var(--wd-paper)] p-8 text-center shadow-sm ring-1 ring-[var(--wd-line)]">
            <p className="font-italiana text-xs tracking-[0.3em] text-[var(--wd-coral)]">PRICE</p>
            <p className="mt-3 text-4xl font-semibold tracking-tight">9,900원</p>
            <p className="mt-1 text-sm text-[var(--wd-mute)]">알림장 1건 · 일시불</p>

            <ul className="mt-6 flex flex-col gap-1.5 text-left text-sm text-[var(--wd-mute)] [&>li]:break-keep">
              <li>· 메인·스토리·갤러리 등 10개 섹션 구성</li>
              <li>· AI 메인 사진 1장 포함</li>
              <li>· 하객 서명·퀴즈·투표·방명록 수집</li>
              <li>· 발행 후 30일간 공개</li>
              <li>· 혼인서약서·방명록·사진 PDF·이미지 영구 소장</li>
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
        </FadeUp>
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
