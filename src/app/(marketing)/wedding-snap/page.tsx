import Link from 'next/link';
import type { Metadata } from 'next';
import { getAvailableCatalog } from '@/lib/snap/catalog-availability';
import type { SnapCatalogItem } from '@/lib/snap/catalog';
import { CatalogThumbnail } from '@/components/snap/CatalogThumbnail';

export const metadata: Metadata = {
  title: 'AI 웨딩스냅 — 우리다운',
  description:
    '신랑 신부 셀카 1장씩이면 50가지 베스트샷이 우리 얼굴로. 19,900원으로 시작하는 AI 웨딩 스튜디오.',
};

export default function WeddingSnapLandingPage() {
  // hidden / 마스터 파일 없는 항목 제외 — picker 와 동일 기준으로 노출.
  const visibleCatalog = getAvailableCatalog();
  return (
    <main className="mx-auto max-w-4xl px-4 pb-20 pt-10 sm:px-6">
      <Hero />
      <CatalogPreview items={visibleCatalog} />
      <HowItWorks />
      <AboutSnap />
      <PackageLineup />
      <PrimaryCta />
    </main>
  );
}

interface SnapPackageTier {
  code: 'snap_5' | 'snap_20' | 'snap_40';
  name: string;
  credits: number;
  price: number;
  perImage: number;
  highlight?: string;
  bonus?: string;
}

const SNAP_PACKAGES: SnapPackageTier[] = [
  {
    code: 'snap_5',
    name: '체험팩',
    credits: 5,
    price: 3900,
    perImage: 780,
    highlight: '부담 없이 한 번 만들어 보고 싶을 때',
  },
  {
    code: 'snap_20',
    name: '표준 (가장 인기)',
    credits: 20,
    price: 13900,
    perImage: 695,
    highlight: '청첩장 메인 + 베스트샷 다양하게',
  },
  {
    code: 'snap_40',
    name: '헤비',
    credits: 40,
    price: 24900,
    perImage: 622,
    highlight: '카탈로그 풀 활용 · 가성비 최고',
  },
];

function AboutSnap() {
  return (
    <section className="mt-16">
      <h2 className="mb-4 text-sm font-medium tracking-wider text-[#5C4633]">
        AI 웨딩스냅이란?
      </h2>
      <div className="rounded-lg border border-[#E8DCC9] bg-white p-5 text-sm leading-relaxed text-[#5C4633]">
        신랑·신부 사진을 한 번만 잘 잡아두는{' '}
        <strong>앵커 단계 (4장 후보 中 1장 선택)</strong> 가 첫 batch{' '}
        <span className="text-emerald-700">무료</span>로 제공되고, 이후 카탈로그
        50컷 풀에서 원하는 컷을 1장씩 차감해 만듭니다. 키·몸무게를 같이 입력하면
        전신 비율이 자연스럽게 반영돼요.
      </div>
    </section>
  );
}

function PackageLineup() {
  return (
    <section className="mt-12">
      <h2 className="mb-4 text-sm font-medium tracking-wider text-[#5C4633]">
        패키지 라인업
      </h2>
      <p className="mb-3 text-xs text-[#8B7355]">
        실제 웨딩스튜디오 대비 1–3% 가격으로 50가지 컷을 우리 얼굴로 만들 수
        있어요. 결제는 PortOne · 네이버 스마트스토어 양쪽 지원, 마이페이지 &ldquo;결혼알림장&rdquo;
        탭 또는 스마트스토어 주문번호 등록을 통해 진행됩니다.
      </p>
      <ul className="flex flex-col gap-2">
        {SNAP_PACKAGES.map((p) => (
          <li
            key={p.code}
            className={`flex flex-col gap-1 rounded-md border p-3 text-xs ${
              p.code === 'snap_20'
                ? 'border-[#3D2E1F] bg-[#FAF7F2]'
                : 'border-[#E8DCC9] bg-white'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[#3D2E1F]">{p.name}</span>
                {p.code === 'snap_20' && (
                  <span className="rounded-full bg-[#3D2E1F] px-2 py-0.5 text-[10px] font-medium text-white">
                    추천
                  </span>
                )}
              </div>
              <span className="text-sm font-semibold text-[#3D2E1F]">
                {p.price.toLocaleString()}원
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[#5C4633]">
              <span>스냅 크레딧 {p.credits}개</span>
              <span className="text-[10px] text-[#8B7355]">컷당 {p.perImage}원</span>
            </div>
            {p.highlight && <p className="text-[11px] text-[#8B7355]">{p.highlight}</p>}
            {p.bonus && <p className="text-[11px] text-emerald-700">+ {p.bonus}</p>}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-[#8B7355]">
        ⓘ 결제 후 크레딧은 자동 적립됩니다. 만료 없음. 환불은 결제 채널 정책을
        따릅니다. 첫 앵커 batch (스튜디오 4종 framing) 는 무료, 재생성은 4
        크레딧 차감.
      </p>
    </section>
  );
}

function Hero() {
  return (
    <section className="text-center">
      <p className="text-xs tracking-[0.4em] text-[#8B7355]">AI WEDDING SNAP</p>
      <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
        우리 둘 셀카 한 장이면
        <br />
        50가지 웨딩 컷이 완성됩니다
      </h1>
      <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-[#5C4633] md:text-base">
        스튜디오·한옥·도심 골든아워·바닷가까지 — 50가지 베스트샷 중 마음에 드는 컷을
        고르면 우리 얼굴로 자연스럽게 합성해드려요.
      </p>
      <p className="mt-4 text-sm font-medium text-[#3D2E1F]">
        <span className="text-2xl font-semibold">19,900원</span>
        <span className="ml-2 text-xs text-[#8B7355]">/ 20장 패키지</span>
      </p>
    </section>
  );
}

function CatalogPreview({ items }: { items: SnapCatalogItem[] }) {
  return (
    <section className="mt-12">
      <h2 className="mb-4 text-sm font-medium tracking-wider text-[#5C4633]">
        카탈로그 미리보기
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="overflow-hidden rounded-md border border-[#E8DCC9] bg-white"
          >
            <CatalogThumbnail src={item.image} alt={item.label} />
            <div className="p-2.5">
              <p className="text-xs font-medium text-[#3D2E1F]">{item.label}</p>
              <p className="mt-0.5 text-[10px] text-[#8B7355]">{item.hint}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: 1, title: '신랑·신부 셀카 업로드', body: '정면 클로즈업 1장씩. 30초면 끝.' },
    { n: 2, title: '카탈로그 컷 선택', body: '50가지 베스트샷 중 마음에 드는 20장.' },
    { n: 3, title: 'AI 가 합성', body: '컷당 30초~1분, 자연스러운 결과물 생성.' },
    { n: 4, title: '다운로드 + 청첩장 메인', body: '갤러리에서 모두 다운로드. 청첩장 메인 사진으로도 사용.' },
  ];
  return (
    <section className="mt-16">
      <h2 className="mb-4 text-sm font-medium tracking-wider text-[#5C4633]">
        진행 방법
      </h2>
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
        className="inline-block rounded-md bg-[#3D2E1F] px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-[#5C4633]"
      >
        샘플 테스트 시작하기
      </Link>
      <p className="mt-3 text-[11px] text-[#8B7355]">
        MVP 테스트 모드 — 결제 없이 1컷씩 시험 생성됩니다.
      </p>
    </section>
  );
}
