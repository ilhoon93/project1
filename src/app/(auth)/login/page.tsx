import { Suspense } from 'react';
import { LoginForm } from './login-form';

export const metadata = {
  title: '로그인 — 미니멈 웨딩 스튜디오',
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">미니멈 웨딩 스튜디오</h1>
        <p className="text-sm text-muted-foreground">
          카카오 또는 네이버로 로그인하고 우리만의 알림장을 만들어보세요
        </p>
      </div>

      <Suspense fallback={<div className="h-12 w-72 animate-pulse rounded-md bg-muted" />}>
        <LoginForm />
      </Suspense>

      <p className="text-xs text-muted-foreground">
        로그인 시 <a className="underline" href="/terms">이용약관</a> 및{' '}
        <a className="underline" href="/privacy">개인정보처리방침</a>에 동의합니다.
      </p>
    </main>
  );
}
