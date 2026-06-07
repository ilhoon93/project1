import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BrandMark } from '@/components/shared/BrandMark';
import { HeaderNav } from '@/components/marketing/HeaderNav';

export default async function EditorLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Editor 진입 시 로그인 후 홈으로 — 자동으로 다른 알림장 편집을 시작하지
    // 않게 한다.
    redirect('/login?next=/');
  }

  return (
    <div className="min-h-screen bg-[var(--wd-cream)] text-[var(--wd-ink)]">
      {/* 마케팅 상단바와 동일한 sticky frosted glass — 에디터에서도 동일한
          브랜드 헤더가 보이도록. EditorToolbar 의 ←/저장/미리보기 는 탭 strip
          쪽으로 이전(편집 전용 액션은 컨텍스트 안에 두는 편이 자연스러움). */}
      <header className="sticky top-0 z-50 bg-[var(--wd-cream)]/65 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
          <Link
            href="/"
            className="flex items-center gap-2 whitespace-nowrap text-[14px] font-medium tracking-tight text-[var(--wd-ink)]"
          >
            <BrandMark size={24} />
            <span>우리다운</span>
          </Link>
          <HeaderNav loggedIn email={user.email ?? null} />
        </div>
      </header>
      {children}
    </div>
  );
}
