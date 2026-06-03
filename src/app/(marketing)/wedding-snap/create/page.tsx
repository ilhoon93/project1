import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SnapGenerator } from '@/components/snap/SnapGenerator';
import { getAvailableCatalogWith } from '@/lib/snap/catalog-availability';
import { fetchAllCatalogTags } from '@/lib/snap/catalog-admin-tags';
import { fetchCatalogStatsMap } from '@/lib/snap/catalog-stats';
import { getExampleFlow } from '@/lib/marketing/home-samples';

export const metadata: Metadata = {
  title: 'AI 웨딩스냅 — 사진 업로드 / 카탈로그 선택',
};

// admin 태그 변경 + 사용자 잔액이 즉시 반영되도록 cache 없음.
export const dynamic = 'force-dynamic';

export default async function WeddingSnapCreatePage() {
  // 인증 게이트 — 비로그인 시 로그인 페이지로 보낸 뒤 다시 이 페이지로 복귀.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/wedding-snap/create');

  // tagMap + stats + 잔액·재생성quota 병렬 fetch. 실패 시 0 으로 안전 fallback.
  const admin = createAdminClient();
  const [adminTags, catalogStats, snapBalanceRes, quotaRes, exampleFlow] = await Promise.all([
    fetchAllCatalogTags(),
    fetchCatalogStatsMap(),
    supabase.rpc('snap_credits_balance', { uid: user.id }),
    admin
      .from('snap_user_quota')
      .select('free_regen_remaining')
      .eq('user_id', user.id)
      .maybeSingle(),
    getExampleFlow(),
  ]);
  const snapBalance =
    typeof snapBalanceRes.data === 'number' ? snapBalanceRes.data : 0;
  const freeRegen = quotaRes.data?.free_regen_remaining ?? 0;
  const availableCatalog = getAvailableCatalogWith(adminTags);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6">
      {/* 헤더 — 제목 + 잔액(스냅/재생성) + 마이페이지 바로가기를 한 카드로 통합.
          이전엔 헤더 한 줄 + 잔액 박스 한 줄 + StepIndicator 한 줄(=3줄)이라 진행
          단계가 viewport 아래로 밀렸음 → 두 줄로 압축.
          모바일에서 메타("평균 약 2분") 는 hidden — 첫 진입엔 우선순위 낮음. */}
      <div className="flex flex-col gap-1.5 rounded-2xl border border-[var(--wd-line)] bg-[var(--wd-cream)] p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h1 className="text-lg font-semibold tracking-tight text-[var(--wd-ink)] sm:text-xl">
            AI 웨딩스냅 만들기
          </h1>
          <span className="hidden text-[11px] text-[var(--wd-mute)] sm:inline">
            평균 약 2분 · 1컷 = 크레딧 1개
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
          <div className="flex items-baseline gap-3 text-[12px] text-[var(--wd-ink)]">
            <span className="flex items-baseline gap-1">
              <span className="text-[10px] tracking-[0.2em] text-[var(--wd-mute)]">스냅</span>
              <span className="text-sm font-semibold">{snapBalance}</span>
              <span className="text-[10px] text-[var(--wd-mute)]">크레딧</span>
            </span>
            <span className="text-[var(--wd-line)]">·</span>
            <span className="flex items-baseline gap-1">
              <span className="text-[10px] tracking-[0.2em] text-[var(--wd-mute)]">재생성</span>
              <span className="text-sm font-semibold">{freeRegen}</span>
              <span className="text-[10px] text-[var(--wd-mute)]">회 무료</span>
            </span>
          </div>
          <Link
            href="/mypage?tab=snap"
            className="inline-flex items-center gap-1 rounded-full border border-[var(--wd-ink)]/25 bg-[var(--wd-paper)] px-3 py-1 text-[11px] font-medium text-[var(--wd-ink)] transition-colors hover:bg-[var(--wd-ink)]/8"
          >
            마이페이지 →
          </Link>
        </div>
      </div>

      <SnapGenerator
        catalog={availableCatalog}
        adminTags={adminTags}
        catalogStats={catalogStats}
        exampleFlow={exampleFlow}
      />
    </main>
  );
}
