'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/new';
  const callbackError = searchParams.get('error');
  const [loading, setLoading] = useState<'kakao' | 'naver' | null>(null);
  const [error, setError] = useState<string | null>(
    callbackError ? '로그인에 실패했습니다. 다시 시도해주세요.' : null,
  );

  const handleKakaoLogin = async () => {
    setLoading('kakao');
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
      setLoading(null);
    }
  };

  const handleNaverLogin = () => {
    setLoading('naver');
    setError(null);
    window.location.href = `/api/auth/naver/start?next=${encodeURIComponent(next)}`;
  };

  return (
    <div className="flex w-full max-w-xs flex-col gap-3">
      <button
        type="button"
        onClick={handleKakaoLogin}
        disabled={loading !== null}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#FEE500] text-[15px] font-medium text-[#191600] transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        <KakaoIcon />
        {loading === 'kakao' ? '연결 중...' : '카카오로 시작하기'}
      </button>

      <button
        type="button"
        onClick={handleNaverLogin}
        disabled={loading !== null}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#03C75A] text-[15px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        <NaverIcon />
        {loading === 'naver' ? '연결 중...' : '네이버로 시작하기'}
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

function NaverIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden
      fill="currentColor"
    >
      <path d="M9.66 8.57 6.18 3.5H3v9h3.34V7.43l3.48 5.07H13v-9H9.66v5.07z" />
    </svg>
  );
}
