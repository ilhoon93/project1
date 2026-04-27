import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FAF7F2] px-6 py-12 text-center text-[#3D2E1F]">
      <p className="text-xs tracking-[0.3em] text-[#8B7355]">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">
        페이지를 찾을 수 없어요
      </h1>
      <p className="max-w-sm text-sm leading-relaxed text-[#5C4633]">
        요청하신 주소가 존재하지 않거나 이동되었습니다. 알림장이 만료된 경우에도 같은
        페이지가 보일 수 있어요.
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex h-10 items-center justify-center rounded-md bg-[#8B7355] px-5 text-sm font-medium text-white"
      >
        홈으로
      </Link>
    </main>
  );
}
