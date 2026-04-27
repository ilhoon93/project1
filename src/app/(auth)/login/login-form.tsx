'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/new';
  const callbackError = searchParams.get('error');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    callbackError ? '로그인에 실패했습니다. 다시 시도해주세요.' : null,
  );

  const handleKakaoLogin = async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setError('카카오 로그인 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.');
      setLoading(false);
    }
  };

  return (
    <div className="flex w-full max-w-xs flex-col gap-3">
      <button
        type="button"
        onClick={handleKakaoLogin}
        disabled={loading}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#FEE500] text-[15px] font-medium text-[#191600] transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        <KakaoIcon />
        {loading ? '연결 중...' : '카카오로 시작하기'}
      </button>

      {error && (
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function KakaoIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      aria-hidden
      fill="currentColor"
    >
      <path d="M9 1.5C4.86 1.5 1.5 4.16 1.5 7.45c0 2.13 1.39 3.99 3.49 5.05l-.88 3.22c-.08.29.24.52.49.36L8.46 14c.18.02.36.03.54.03 4.14 0 7.5-2.66 7.5-5.95S13.14 1.5 9 1.5z" />
    </svg>
  );
}
