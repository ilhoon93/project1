/**
 * snap_catalog_stats view 의 read helper. 사용자 페이지 정렬 ("인기순"/"좋아요순")
 * 에 사용. view 는 PII 가 없어 anon 까지 read 가능 (031 마이그).
 *
 * 같은 catalog_id 가 mode (selfies / couple) 별로 2 행씩 나올 수 있음 — 호출자가
 * 합산 또는 mode 필터링.
 */

import { createClient } from '@/lib/supabase/server';

export interface CatalogStatsRow {
  catalogId: string;
  mode: 'selfies' | 'couple' | 'unknown';
  genCount: number;
  likeCount: number;
  regenCount: number;
  likeRate: number;
  regenRate: number;
}

/**
 * catalog_id 별 합산 stats map. selfies + couple 의 gen/like/regen 단순 합.
 * 사용자 페이지의 "인기순"/"좋아요순" 정렬에 적합 (모드 구분 없는 누적 인기도).
 */
export type CatalogStatsMap = Record<
  string,
  { genCount: number; likeCount: number; regenCount: number }
>;

export async function fetchCatalogStatsMap(): Promise<CatalogStatsMap> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('snap_catalog_stats')
    .select('catalog_id, gen_count, like_count, regen_count');
  if (error) {
    // view 누락 또는 권한 거부 → 빈 map fallback. 정렬은 default order 로.
    return {};
  }
  const out: CatalogStatsMap = {};
  for (const row of data ?? []) {
    const id = row.catalog_id as string;
    const prev = out[id] ?? { genCount: 0, likeCount: 0, regenCount: 0 };
    out[id] = {
      genCount: prev.genCount + Number(row.gen_count ?? 0),
      likeCount: prev.likeCount + Number(row.like_count ?? 0),
      regenCount: prev.regenCount + Number(row.regen_count ?? 0),
    };
  }
  return out;
}
