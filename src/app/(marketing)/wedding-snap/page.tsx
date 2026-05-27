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
import {
  SNAP_PACKAGES,
  SNAP_STARTING_PRICE,
  SNAP_STANDARD_PACKAGE,
  formatKRW,
  freeRegenSummary,
} from '@/lib/snap/packages';

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
  // hidden / 마스터 파일 없음 / admin 양쪽 hidden 인 항목 제외 + stats 병렬 fetch.
  // stats 는 정렬용 — view 가 비어 있어도 빈 map 으로 안전 fallback.
  const [visibleCatalog, catalogStats] = await Promise.all([
    getAvailableCatalog(),
    fetchCatalogStatsMap(),
  ]);
  const catalogCount = visibleCatalog.length;
  // 섹션 순서 — 설명/진행방법/가격을 앞으로, 카탈로그 미리보기는 뒤로:
  //   Hero → AboutSnap → HowItWorks → PackageLineup → CatalogPreview → PrimaryCta
  // 이유: 처음 들어온 사용자가 "이게 뭐고, 어떻게 진행되고, 얼마인가" 를 먼저 보고,
  // 그 다음 결과물 갤러리(카탈로그) 를 둘러보다 [지금 만들기] 로 자연스럽게 이어짐.
  return (
    <main className="mx-auto max-w-4xl px-4 pb-20 pt-10 sm:px-6">
      <Hero catalogCount={catalogCount} />
      <AboutSnap catalogCount={catalogCount} />
      <HowItWorks catalogCount={catalogCount} />
      <PackageLineup />
      <CatalogPreview items={visibleCatalog} catalogStats={catalogStats} />
      <PrimaryCta />
    </main>
  );
}

/** 섹션 공통 제목 — 메인 랜딩과 같은 위계(이브로우 + h2). */
function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-4">
      <p className="font-italiana text-[11px] font-medium tracking-[0.18em] text-[var(--wd-coral)]">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-[20px] font-medium leading-snug tracking-tight text-[#3D2E1F]">
        {title}
      </h2>
    </div>
  );
}

function AboutSnap({ catalogCount }: { catalogCount: number }) {
  return (
    <section className="mt-16">
      <SectionHeading eyebrow="WHAT IS IT" title="AI 웨딩스냅이란?" />
      <div className="flex flex-col gap-3 rounded-lg border border-[#E8DCC9] bg-white p-5 text-sm leading-relaxed text-[#5C4633]">
        <p>
          두 가지 입력 방식 — <strong>셀카로 만들기</strong> (신랑·신부 각자 셀카
          1장 또는 정면/좌/우 3장으로 앵커 생성) 또는{' '}
          <strong>커플사진으로 만들기</strong> (두 사람이 함께 찍힌 사진 1장) —
          중 편한 쪽을 고르면, 카탈로그 컷의 의상·배경·구도를 그대로 두고{' '}
          <strong>얼굴/체형만 본인 얼굴로 교체</strong>해드립니다.
        </p>
        <p>
          셀카 모드는{' '}
          <strong>앵커 단계 (4장 후보 中 1장 선택)</strong> 가 결제 후 첫 batch{' '}
          <span className="text-emerald-700">무료</span>로 제공되고, 이후{' '}
          <strong>{catalogCountLabel(catalogCount)}의 카탈로그 풀</strong>에서
          원하는 컷을 1장당 스냅 크레딧 1개씩 차감해 만듭니다. 키·몸무게를 같이
          입력하면 전신 비율도 자연스럽게 반영돼요.
        </p>
        <p>
          만든 결과는 마이페이지에 자동 저장되고,{' '}
          <strong>좋아요·재생성 피드백</strong> 도 가능합니다. 재생성은 패키지
          결제 시 적립된 <strong>무료 quota</strong>({freeRegenSummary()}) 안에서
          무료, 이후엔 1 크레딧씩 차감.
        </p>
      </div>
    </section>
  );
}

function PackageLineup() {
  return (
    <section className="mt-12">
      <SectionHeading eyebrow="PRICING" title="패키지 라인업" />
      <p className="mb-3 text-xs text-[#8B7355]">
        실제 웨딩스튜디오 대비 1–3% 가격으로 우리 얼굴의 베스트샷을 만들 수 있어요.
        결제는 PortOne · 네이버 스마트스토어 양쪽 지원, 마이페이지의
        &ldquo;주문&rdquo; 탭에서 스마트스토어 주문번호 등록 또는 네이버 로그인
        연동으로 진행됩니다.
      </p>
      <ul className="flex flex-col gap-2">
        {SNAP_PACKAGES.map((p) => (
          <li
            key={p.code}
            className={`flex flex-col gap-1 rounded-md border p-3 text-xs ${
              p.isPopular
                ? 'border-[#3D2E1F] bg-[#FAF7F2]'
                : 'border-[#E8DCC9] bg-white'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[#3D2E1F]">{p.name}</span>
                {p.isPopular && (
                  <span className="rounded-full bg-[#3D2E1F] px-2 py-0.5 text-[10px] font-medium text-white">
                    추천
                  </span>
                )}
              </div>
              <span className="text-sm font-semibold text-[#3D2E1F]">
                {formatKRW(p.price)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[#5C4633]">
              <span>스냅 크레딧 {p.credits}개</span>
              <span className="text-[10px] text-[#8B7355]">컷당 {formatKRW(p.perImage)}</span>
            </div>
            {p.highlight && <p className="text-[11px] text-[#8B7355]">{p.highlight}</p>}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] leading-relaxed text-[#8B7355]">
        ⓘ 결제 후 크레딧은 자동 적립됩니다. 만료 없음. 환불은 결제 채널 정책을
        따릅니다. 결제 사용자에 한해 첫 앵커 batch (4종 후보) 는 무료, 추가
        앵커 재생성은 4 크레딧 차감.
        <br />
        패키지 결제 시 카탈로그 결과 <strong>재생성 무료 quota</strong> 도 함께
        적립 — {freeRegenSummary()}. 그 이후 재생성은 1 크레딧 차감.
      </p>
    </section>
  );
}

function Hero({ catalogCount }: { catalogCount: number }) {
  return (
    <section className="text-center">
      <p className="font-italiana text-xs tracking-[0.4em] text-[var(--wd-coral)]">
        AI WEDDING SNAP
      </p>
      <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-[#3D2E1F] md:text-4xl">
        우리 둘 셀카 한 장이면
        <br />
        {catalogCountLabel(catalogCount)} 웨딩 컷이 완성됩니다
      </h1>
      <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-[#5C4633] md:text-base">
        스튜디오·한옥·도심 골든아워·바닷가·해외 풍경까지 —{' '}
        {catalogCountLabel(catalogCount)}의 베스트샷 중 마음에 드는 컷을 고르면
        우리 얼굴로 자연스럽게 합성해드려요.
      </p>
      <p className="mt-4 text-sm font-medium text-[#3D2E1F]">
        <span className="text-2xl font-semibold">{formatKRW(SNAP_STARTING_PRICE)}</span>
        <span className="ml-2 text-xs text-[#8B7355]">
          부터 · {SNAP_STANDARD_PACKAGE.name} {SNAP_STANDARD_PACKAGE.credits}장{' '}
          {formatKRW(SNAP_STANDARD_PACKAGE.price)}
        </span>
      </p>
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
    <section className="mt-12">
      <SectionHeading eyebrow="GALLERY" title="카탈로그 미리보기" />
      <CatalogPreviewClient items={items} catalogStats={catalogStats} />
    </section>
  );
}

function HowItWorks({ catalogCount }: { catalogCount: number }) {
  const steps = [
    { n: 1, title: '신랑·신부 셀카 업로드', body: '정면 클로즈업 1장씩. 30초면 끝.' },
    {
      n: 2,
      title: '카탈로그 컷 선택',
      body: `${catalogCountLabel(catalogCount)} 베스트샷 중 마음에 드는 만큼.`,
    },
    { n: 3, title: 'AI 가 합성', body: '컷당 평균 60~120초, 자연스러운 결과물 생성.' },
    { n: 4, title: '다운로드 + 청첩장 메인', body: '갤러리에서 모두 다운로드. 청첩장 메인 사진으로도 사용.' },
  ];
  return (
    <section className="mt-16">
      <SectionHeading eyebrow="HOW IT WORKS" title="진행 방법" />
      <ol className="grid gap-3 sm:grid-cols-2">
        {steps.map((s) => (
          <li
            key={s.n}
            className="flex gap-3 rounded-md border border-[#E8DCC9] bg-white p-4"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#8B7355] text-xs font-semibold text-white">
              {s.n}
            </span>
            <div>
              <p className="text-sm font-medium text-[#3D2E1F]">{s.title}</p>
              <p className="mt-1 text-xs text-[#5C4633]">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function PrimaryCta() {
  return (
    <section className="mt-16 text-center">
      <Link
        href="/wedding-snap/create"
        className="inline-flex items-center rounded-full bg-[#3D2E1F] px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-[#5C4633] active:scale-[0.97]"
      >
        지금 만들기 →
      </Link>
      <p className="mt-3 text-[11px] text-[#8B7355]">
        평균 생성 시간 60~120초 · 결과는 마이페이지에서 확인할 수 있어요.
      </p>
    </section>
  );
}
