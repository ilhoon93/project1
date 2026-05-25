import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { checkAdmin } from '@/lib/auth/admin';
import { SNAP_CATALOG } from '@/lib/snap/catalog';
import { createClient } from '@/lib/supabase/server';
import { CatalogStatsTable, type StatsRow } from './CatalogStatsTable';

export const metadata: Metadata = {
  title: 'Admin · 카탈로그 통계',
  robots: { index: false, follow: false },
};

// admin route 는 항상 dynamic — 통계는 매 요청마다 fresh aggregate.
export const dynamic = 'force-dynamic';

/**
 * 운영자 전용 통계 페이지 — snap_catalog_stats view 를 카탈로그 × 모드로 표시.
 *
 *  컬럼:
 *    catalog_id / 한국어 라벨
 *    mode (selfies / couple)
 *    gen_count (완료된 생성 수)
 *    like_count / like_rate
 *    regen_count / regen_rate
 *
 *  마이그 031 에서 snap_catalog_stats view 생성. 이번 페이지가 첫 consumer.
 *
 *  사용 시나리오:
 *    - "어떤 카탈로그가 좋아요가 많은가?" → like_rate 기준 정렬
 *    - "재생성 비율이 높은 카탈로그는?" → regen_rate 기준 정렬 (운영자가 prompt
 *      개선 필요한지 판단)
 *    - selfies vs couple 모드별 성능 차이 비교
 */
export default async function SnapCatalogStatsAdminPage() {
  const ctx = await checkAdmin();
  if (!ctx) notFound();

  // view 는 RLS 없이 authenticated 모두 read 가능 (031 마이그에서 grant).
  // 일반 server client 로 충분 — service role key 환경 의존 없음.
  const supabase = createClient();
  const { data, error } = await supabase
    .from('snap_catalog_stats')
    .select(
      'catalog_id, mode, gen_count, like_count, regen_count, like_rate, regen_rate',
    )
    .order('gen_count', { ascending: false });

  if (error) {
    return (
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-6">
        <h1 className="text-xl font-semibold text-[#3D2E1F]">카탈로그 통계</h1>
        <p className="mt-4 text-sm text-red-600">
          통계 조회 실패: {error.message}
        </p>
      </main>
    );
  }

  // catalog_id → 한국어 label lookup (코드 source-of-truth).
  const labelMap = new Map(
    SNAP_CATALOG.map((c) => [c.id, c.label] as const),
  );
  const rows: StatsRow[] = (data ?? []).map((r) => ({
    catalogId: r.catalog_id as string,
    label: labelMap.get(r.catalog_id as string) ?? '(코드 삭제됨)',
    mode: (r.mode as 'selfies' | 'couple' | 'unknown') ?? 'unknown',
    genCount: Number(r.gen_count ?? 0),
    likeCount: Number(r.like_count ?? 0),
    regenCount: Number(r.regen_count ?? 0),
    likeRate: Number(r.like_rate ?? 0),
    regenRate: Number(r.regen_rate ?? 0),
  }));

  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-6">
      <header className="mb-4">
        <h1 className="text-xl font-semibold text-[#3D2E1F]">카탈로그 통계</h1>
        <p className="mt-1 text-xs text-[#8B7355]">
          카탈로그 × 모드 별 누적 생성/좋아요/재생성 통계. 좋아요 비율이 낮거나
          재생성 비율이 높은 카탈로그는 운영자 검토 대상 — 태그 조정 또는 prompt
          수정 검토.
          <span className="ml-2">로그인 계정: {ctx.email}</span>
        </p>
      </header>
      <CatalogStatsTable rows={rows} />
    </main>
  );
}
