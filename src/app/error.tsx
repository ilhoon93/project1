'use client';

import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app/error]', error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FAF7F2] px-6 py-12 text-center text-[#3D2E1F]">
      <p className="text-xs tracking-[0.3em] text-[#8B7355]">SOMETHING WENT WRONG</p>
      <h1 className="text-2xl font-semibold tracking-tight">잠시 후 다시 시도해주세요</h1>
      <p className="max-w-sm text-sm leading-relaxed text-[#5C4633]">
        예상치 못한 오류가 발생했습니다. 문제가 계속되면 hello@example.com 으로 알려주세요.
      </p>
      {error.digest && (
        <p className="text-[10px] text-[#8B7355]/70">에러 코드: {error.digest}</p>
      )}
      <button
        type="button"
        onClick={() => reset()}
        className="mt-2 inline-flex h-10 items-center justify-center rounded-md bg-[#8B7355] px-5 text-sm font-medium text-white"
      >
        다시 시도
      </button>
    </main>
  );
}
