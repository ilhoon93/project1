'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const ERROR_MESSAGES: Record<string, string> = {
  naver_not_configured:
    '네이버 로그인 설정이 완료되지 않았습니다. 잠시 후 다시 시도해주세요.',
  supabase_not_configured: '서버 설정 오류로 로그인할 수 없습니다.',
  state_mismatch: '보안 검증에 실패했습니다. 처음부터 다시 시도해주세요.',
  missing_code_or_state: '로그인 응답이 올바르지 않습니다. 다시 시도해주세요.',
  missing_naver_id: '네이버에서 사용자 정보를 받지 못했습니다.',
  user_create_failed: '계정 생성에 실패했습니다. 잠시 후 다시 시도해주세요.',
  no_email_for_session: '세션을 만들 이메일 정보를 찾을 수 없습니다.',
  generate_link_failed: '세션 생성에 실패했습니다. 잠시 후 다시 시도해주세요.',
  verify_otp_failed: '세션 인증에 실패했습니다. 잠시 후 다시 시도해주세요.',
  naver_unexpected: '네이버 로그인 중 알 수 없는 오류가 발생했습니다.',
  naver_start_failed: '네이버 로그인 시작에 실패했습니다.',
  no_user: '사용자 정보를 확인할 수 없습니다.',
};

const errorMessageFor = (code: string | null) => {
  if (!code) return null;
  if (ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  if (code.startsWith('naver_')) return ERROR_MESSAGES.naver_unexpected;
  return '로그인에 실패했습니다. 다시 시도해주세요.';
};

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/new';
  const callbackError = searchParams.get('error');
  const reason = searchParams.get('reason');
  const [loading, setLoading] = useState<'kakao' | 'naver' | null>(null);
  const reasonMessage =
    reason === 'browser_closed'
      ? '브라우저를 닫으면 자동으로 로그아웃됩니다. 다시 로그인해주세요.'
      : reason === 'idle_timeout'
        ? '오랫동안 활동이 없어 자동으로 로그아웃되었습니다. 다시 로그인해주세요.'
        : null;
  const [error, setError] = useState<string | null>(errorMessageFor(callbackError));

  // bfcache 가드: 외부 OAuth 페이지로 이동했다 뒤로가기로 돌아오면
  // 브라우저가 페이지를 메모리에서 그대로 복원해 loading 상태가
  // '연결 중...'으로 멈춘 채 남는다. pageshow.persisted=true 때 리셋.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setLoading(null);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

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

      {reasonMessage && (
        <p className="text-center text-xs text-muted-foreground">
          {reasonMessage}
        </p>
      )}

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
