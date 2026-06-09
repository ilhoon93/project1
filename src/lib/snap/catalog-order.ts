/**
 * 카탈로그 노출 순서(운영자 지정) read/write helper.
 *
 * 저장소: public.snap_catalog_order (migration 044).
 * 권한: select 공개, 변경은 app_metadata.role='admin' 만 (RLS).
 *
 * sort_order 가 지정된 항목이 오름차순으로 먼저, 미지정 항목은 코드(SNAP_CATALOG)
 * 정의 순서를 유지한 채 그 뒤에 붙는다. (catalog-availability 가 적용.)
 */

import { createClient } from '@/lib/supabase/server';

/** catalogId → sort_order. */
export type CatalogOrderMap = Record<string, number>;

/** 모든 카탈로그 순서 fetch. 실패/미설정 시 빈 map → 코드 순서 폴백. */
export async function fetchCatalogOrder(): Promise<CatalogOrderMap> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('snap_catalog_order')
    .select('catalog_id, sort_order');
  if (error) return {};
  const out: CatalogOrderMap = {};
  for (const row of data ?? []) {
    out[row.catalog_id as string] = row.sort_order as number;
  }
  return out;
}

/**
 * order map 에 따라 items 를 정렬한 새 배열 반환.
 * - sort_order 지정 항목: 그 값 오름차순.
 * - 미지정 항목: 원래(코드) 순서를 유지한 채 지정 항목들 뒤로.
 * 안정 정렬을 위해 원래 인덱스를 tie-breaker 로 사용.
 */
export function sortByCatalogOrder<T extends { id: string }>(
  items: T[],
  order: CatalogOrderMap,
): T[] {
  return items
    .map((item, idx) => ({ item, idx }))
    .sort((a, b) => {
      const av = order[a.item.id] ?? Number.MAX_SAFE_INTEGER;
      const bv = order[b.item.id] ?? Number.MAX_SAFE_INTEGER;
      return av - bv || a.idx - b.idx;
    })
    .map((x) => x.item);
}

/** 단일 카탈로그 순서 upsert. RLS 가 admin 만 통과. */
export async function setCatalogOrder(
  catalogId: string,
  sortOrder: number,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const { error } = await supabase.from('snap_catalog_order').upsert(
    { catalog_id: catalogId, sort_order: sortOrder },
    { onConflict: 'catalog_id' },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * 카탈로그 순서를 통째로 다시 쓴다 (운영자가 정한 순서대로 0,1,2,...).
 * 목록에 없는(=미지정으로 되돌릴) catalogId 는 호출부에서 제외하면 된다.
 * 전체를 지우고 다시 넣는 단순/안전 방식 (행 수 ~수십 개).
 */
export async function replaceCatalogOrder(
  orderedIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const { error: delErr } = await supabase
    .from('snap_catalog_order')
    .delete()
    .neq('catalog_id', '__none__'); // 전체 삭제
  if (delErr) return { ok: false, error: delErr.message };
  if (orderedIds.length === 0) return { ok: true };
  const rows = orderedIds.map((catalog_id, i) => ({ catalog_id, sort_order: i }));
  const { error } = await supabase.from('snap_catalog_order').insert(rows);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
