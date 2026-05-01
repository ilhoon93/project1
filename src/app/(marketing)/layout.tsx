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
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4 text-sm">
        <Link href="/" className="font-medium tracking-tight">
          미니멈 웨딩 스튜디오
        </Link>
        <nav className="flex items-center gap-3">
          {user ? (
            <>
              <Link href="/mypage" className="text-[#5C4633] hover:text-[#3D2E1F]">
                마이페이지
              </Link>
              <Link
                href="/new"
                className="rounded-md bg-[#8B7355] px-3 py-1.5 text-xs font-medium text-white"
              >
                새 알림장
              </Link>
              <LogoutButton />
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-md border border-[#8B7355] px-3 py-1.5 text-xs font-medium text-[#5C4633]"
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
