import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { BrandMark } from '@/components/shared/BrandMark';

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-[var(--wd-cream)] text-[var(--wd-ink)]">
      {/* 모바일에서 nav 버튼이 줄바꿈되지 않도록 whitespace-nowrap + flex-shrink-0
          + 좁은 padding/gap. 360px 기준으로도 한 줄 안에 모든 항목이 들어간다.
          "AI 스냅" 메뉴는 비로그인/로그인 양쪽에서 동일 위치에 항상 노출 — 메인
          진입자가 헤더에서 바로 /wedding-snap 으로 갈 수 있도록. */}
      {/* sticky top-0 + frosted glass (cream/65 + backdrop-blur) — 스크롤해도
          상단에 고정. 히어로의 보케 배경이 헤더 뒤로 끌어올려져 있어도 frosted
          처리로 자연스럽게 비치고, cream 섹션 위에서는 동일 톤으로 흡수돼
          분리감 없이 한 덩어리로 보임. 다른 마케팅 페이지(끌어올림 없음)에서도
          cream 위 cream-tinted glass 가 어색하지 않음. */}
      <header className="sticky top-0 z-50 bg-[var(--wd-cream)]/65 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-4 text-sm sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 whitespace-nowrap font-medium tracking-tight"
        >
          <BrandMark size={22} />
          <span>우리다운</span>
        </Link>
        <nav className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
          <Link
            href="/wedding-snap"
            className="whitespace-nowrap text-[var(--wd-mute)] hover:text-[var(--wd-ink)]"
          >
            AI 스냅
          </Link>
          {user ? (
            <>
              <Link
                href="/mypage"
                className="whitespace-nowrap text-[var(--wd-mute)] hover:text-[var(--wd-ink)]"
              >
                마이페이지
              </Link>
              <Link
                href="/new"
                className="whitespace-nowrap rounded-full bg-[var(--wd-ink)] px-3 py-1.5 text-xs font-medium text-[var(--wd-cream)]"
              >
                새 알림장
              </Link>
              <LogoutButton />
            </>
          ) : (
            <Link
              href="/login?next=/"
              className="whitespace-nowrap rounded-full border border-[var(--wd-ink)]/25 px-3 py-1.5 text-xs font-medium text-[var(--wd-ink)]"
            >
              로그인
            </Link>
          )}
        </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
