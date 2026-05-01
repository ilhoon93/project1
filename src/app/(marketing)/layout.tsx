import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { LogoutButton } from '@/components/auth/LogoutButton';

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#3D2E1F]">
      {/* 모바일에서 nav 버튼이 줄바꿈되지 않도록 whitespace-nowrap + flex-shrink-0
          + 좁은 padding/gap. 360px 기준으로도 한 줄 안에 모든 항목이 들어간다. */}
      <header className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-4 text-sm sm:px-6">
        <Link href="/" className="whitespace-nowrap font-medium tracking-tight">
          우리다운
        </Link>
        <nav className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <Link
                href="/mypage"
                className="whitespace-nowrap text-[#5C4633] hover:text-[#3D2E1F]"
              >
                마이페이지
              </Link>
              <Link
                href="/new"
                className="whitespace-nowrap rounded-md bg-[#8B7355] px-3 py-1.5 text-xs font-medium text-white"
              >
                새 알림장
              </Link>
              <LogoutButton />
            </>
          ) : (
            <Link
              href="/login?next=/"
              className="whitespace-nowrap rounded-md border border-[#8B7355] px-3 py-1.5 text-xs font-medium text-[#5C4633]"
            >
              로그인
            </Link>
          )}
        </nav>
      </header>
      {children}
    </div>
  );
}
