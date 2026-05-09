import Link from 'next/link';
import type { Metadata } from 'next';
import { SNAP_CATALOG } from '@/lib/snap/catalog';

export const metadata: Metadata = {
  title: 'AI 웨딩스냅 — 우리다운',
  description:
    '신랑 신부 셀카 1장씩이면 50가지 베스트샷이 우리 얼굴로. 19,900원으로 시작하는 AI 웨딩 스튜디오.',
};

export default function WeddingSnapLandingPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 pb-20 pt-10 sm:px-6">
      <Hero />
      <CatalogPreview />
      <HowItWorks />
      <PrimaryCta />
    </main>
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

function CatalogPreview() {
  return (
    <section className="mt-12">
      <h2 className="mb-4 text-sm font-medium tracking-wider text-[#5C4633]">
        카탈로그 미리보기
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {SNAP_CATALOG.map((item) => (
          <div
            key={item.id}
            className="overflow-hidden rounded-md border border-[#E8DCC9] bg-white"
          >
            <div className="grid aspect-[3/4] w-full place-items-center bg-[#F5EDE0]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.image}
                alt={item.label}
                className="block h-full w-full object-contain"
                onError={(e) => {
                  // 카탈로그 이미지가 아직 업로드 안 됐으면 placeholder 안내.
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement | null;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div
                className="hidden h-full w-full flex-col items-center justify-center px-2 text-center text-[10px] text-[#8B7355]"
                style={{ display: 'none' }}
              >
                <span className="mb-1">📷</span>
                <span className="font-mono">{item.image}</span>
                <span className="mt-1 opacity-70">샘플 이미지 추가 필요</span>
              </div>
            </div>
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
