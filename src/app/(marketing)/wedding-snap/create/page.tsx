import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SnapGenerator } from '@/components/snap/SnapGenerator';
import { getAvailableCatalogWith } from '@/lib/snap/catalog-availability';
import { fetchAllCatalogTags } from '@/lib/snap/catalog-admin-tags';
import { fetchCatalogStatsMap } from '@/lib/snap/catalog-stats';

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
  const [adminTags, catalogStats, snapBalanceRes, quotaRes] = await Promise.all([
    fetchAllCatalogTags(),
    fetchCatalogStatsMap(),
    supabase.rpc('snap_credits_balance', { uid: user.id }),
    admin
      .from('snap_user_quota')
      .select('free_regen_remaining')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);
  const snapBalance =
    typeof snapBalanceRes.data === 'number' ? snapBalanceRes.data : 0;
  const freeRegen = quotaRes.data?.free_regen_remaining ?? 0;
  const availableCatalog = getAvailableCatalogWith(adminTags);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6">
      <h1 className="text-xl font-semibold tracking-tight text-[#3D2E1F]">
        AI 웨딩스냅 만들기
      </h1>
      <p className="mt-2 text-xs text-[#8B7355]">
        평균 생성 시간 60~120초 · 1컷당 스냅 크레딧 1개 차감
      </p>

      {/*
        잔액 요약 헤더 — 스냅 크레딧 / 무료 재생성 잔량 / 마이페이지(AI 웨딩스냅 탭)
        바로가기. 사용자가 잔액 확인 + 결과 보러 가는 동선을 한 줄에 통합.
      */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#E8DCC9] bg-[#FAF7F2] px-3 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-baseline gap-1 text-[#5C4633]">
            <span className="text-[10px] tracking-[0.2em] text-[#8B7355]">스냅</span>
            <span className="text-sm font-semibold text-[#3D2E1F]">{snapBalance}</span>
            <span className="text-[10px] text-[#8B7355]">크레딧</span>
          </span>
          <span className="text-[#D4C5B0]">|</span>
          <span className="flex items-baseline gap-1 text-[#5C4633]">
            <span className="text-[10px] tracking-[0.2em] text-[#8B7355]">재생성</span>
            <span className="text-sm font-semibold text-[#3D2E1F]">{freeRegen}</span>
            <span className="text-[10px] text-[#8B7355]">회 무료</span>
          </span>
        </div>
        <Link
          href="/mypage?tab=snap"
          className="inline-flex items-center gap-1 rounded-md border border-[#3D2E1F] bg-white px-2.5 py-1 text-[11px] font-medium text-[#3D2E1F] transition-colors hover:bg-[#3D2E1F] hover:text-white"
        >
          마이페이지 →
        </Link>
      </div>

      <SnapGenerator
        catalog={availableCatalog}
        adminTags={adminTags}
        catalogStats={catalogStats}
      />
    </main>
  );
}
