import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { BrandMark } from '@/components/shared/BrandMark';
import { HeaderNav } from '@/components/marketing/HeaderNav';

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 네이버 SSO 시 user_metadata 에 name/preferred_username/nickname 중 하나가 들어옴.
  // 마이페이지/구매 페이지와 동일 fallback 체인 사용.
  const userName =
    (user?.user_metadata?.name as string | undefined) ??
    (user?.user_metadata?.preferred_username as string | undefined) ??
    (user?.user_metadata?.nickname as string | undefined) ??
    null;

  return (
    <div className="min-h-screen bg-[var(--wd-cream)] text-[var(--wd-ink)]">
      {/* sticky top-0 + frosted glass (cream/65 + backdrop-blur) — 스크롤해도
          상단에 고정. 히어로 보케 배경이 헤더 뒤로 끌어올려져 있어도 frosted
          처리로 자연스럽게 비치고, cream 섹션 위에서는 동일 톤으로 흡수돼
          한 덩어리로 보임.
          좌(브랜드) / 우(메뉴) 가 화면 양쪽 끝에 정렬되도록 max-w 제거 — 풀너비
          flex justify-between + px(반응형) 패딩만 사용. */}
      <header className="sticky top-0 z-50 bg-[var(--wd-cream)]/65 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
          <Link
            href="/"
            className="flex items-center gap-2 whitespace-nowrap text-[14px] font-medium tracking-tight text-[var(--wd-ink)]"
          >
            <BrandMark size={24} />
            <span>우리다운</span>
          </Link>
          <HeaderNav
            loggedIn={!!user}
            name={userName}
            email={user?.email ?? null}
          />
        </div>
      </header>
      {children}
    </div>
  );
}
