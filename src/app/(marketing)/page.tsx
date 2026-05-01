import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '우리다운 — 우리 다운 결혼 알림장',
  description:
    '8개의 슬라이드, AI 메인 사진, 하객 데이터까지. 9,900원으로 만드는 우리 다운 결혼 알림장.',
};

export default function LandingPage() {
  return (
    <>
      <Hero />
      <Features />
      <Pricing />
      <Footer />
    </>
  );
}

function Hero() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center px-6 pb-16 pt-24 text-center">
      <p className="text-xs tracking-[0.4em] text-[#8B7355]">WOORIDAUN · 우리 다운 결혼 알림장</p>
      <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight md:text-5xl">
        9,900원으로 만드는
        <br />
        우리 다운 결혼 알림장
      </h1>
      <p className="mt-6 max-w-xl text-sm leading-relaxed text-[#5C4633] md:text-base">
        8개의 슬라이드와 AI 메인 사진, 하객 서명·퀴즈·방명록까지.
        <br />
        스마트폰에 어울리는 가로 스와이프 청첩장.
      </p>
      <Link
        href="/new"
        className="mt-8 inline-flex h-12 items-center justify-center rounded-md bg-[#8B7355] px-8 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
      >
        무료로 시작하기 →
      </Link>
      <p className="mt-3 text-xs text-[#8B7355]">결제는 발행 직전, 미리보기 무료</p>
    </section>
  );
}

const FEATURES = [
  {
    title: '8개의 슬라이드',
    body: '메인, 우리 이야기, 갤러리, 영상, 퀴즈, 투표, 방명록, 계좌, 마무리. 켜고 끄는 것은 자유.',
  },
  {
    title: 'AI 메인 사진 (무료 1회)',
    body: '인물 사진을 올리면 배경과 의상이 5가지 웨딩 스타일로 변환됩니다. 클래식 채플부터 한옥 정원까지.',
  },
  {
    title: '하객과 함께 쓰는 알림장',
    body: '서명, 퀴즈 정답, A/B 투표, 방명록 메시지. 하객 모두의 흔적이 하나의 알림장에 쌓입니다.',
  },
  {
    title: '결혼식 후 30일 공개',
    body: '발행 후 결혼식 + 30일까지 공개. 그 후엔 자동으로 비공개 처리되어 사진과 메시지를 안전하게 보관.',
  },
];

function Features() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <h2 className="text-center text-xl font-semibold tracking-tight">
        담긴 것들
      </h2>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {FEATURES.map((f) => (
          <article key={f.title} className="rounded-lg bg-white/70 p-5 ring-1 ring-[#D4C5B0]">
            <h3 className="text-base font-medium text-[#3D2E1F]">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#5C4633]">{f.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section className="mx-auto max-w-md px-6 py-16">
      <div className="rounded-lg bg-white p-8 text-center shadow-sm ring-1 ring-[#D4C5B0]">
        <p className="text-xs tracking-[0.3em] text-[#8B7355]">PRICE</p>
        <p className="mt-3 text-4xl font-semibold tracking-tight">9,900원</p>
        <p className="mt-1 text-sm text-[#8B7355]">알림장 1건 · 일시불</p>

        <ul className="mt-6 flex flex-col gap-1.5 text-left text-sm text-[#5C4633]">
          <li>· 8개 슬라이드 알림장 발행</li>
          <li>· AI 메인 사진 1장 포함</li>
          <li>· 하객 서명·퀴즈·투표·방명록 수집</li>
          <li>· 결혼식 후 30일 공개</li>
        </ul>

        <Link
          href="/new"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-md bg-[#8B7355] text-sm font-medium text-white"
        >
          시작하기
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mx-auto max-w-3xl px-6 pb-12 pt-8 text-center">
      <p className="text-xs text-[#8B7355]">
        © {new Date().getFullYear()} 우리다운 · 문의: hello@example.com
      </p>
    </footer>
  );
}
