/**
 * 카탈로그 운영자 태그 read/write helper.
 *
 * 저장소: supabase 의 public.snap_catalog_tags 테이블 (migration 028).
 * 권한: select 는 인증 사용자 모두, 변경은 app_metadata.role='admin' 만 (RLS).
 *
 * 변경 즉시 사용자 페이지 호환성 판정에 반영되도록 cache 안 함 — 매 페이지 로드
 * 마다 fresh fetch. (행 수가 60~100 개라 부담 없음.)
 */

import { createClient } from '@/lib/supabase/server';

export type CatalogInputCondition = 'selfies' | 'couple-fullbody';
export type CatalogAdminTag = 'recommend' | 'caution' | 'risky' | 'hidden';

export interface CatalogAdminTagRow {
  catalogId: string;
  inputCondition: CatalogInputCondition;
  tag: CatalogAdminTag;
  updatedAt: string;
  updatedBy: string | null;
}

/** id × inputCondition → tag map (서버 컴포넌트에서 fetch 후 그대로 props 로 전달 가능). */
export type CatalogAdminTagMap = Record<
  string,
  Partial<Record<CatalogInputCondition, CatalogAdminTag>>
>;

/** 모든 카탈로그 태그 fetch — 인증된 사용자 누구나 호출 가능 (RLS select). */
export async function fetchAllCatalogTags(): Promise<CatalogAdminTagMap> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('snap_catalog_tags')
    .select('catalog_id, input_condition, tag');
  if (error) {
    // RLS 거부 또는 테이블 없음 등 — 빈 map 으로 안전 fallback.
    return {};
  }
  const out: CatalogAdminTagMap = {};
  for (const row of data ?? []) {
    const id = row.catalog_id as string;
    const cond = row.input_condition as CatalogInputCondition;
    const tag = row.tag as CatalogAdminTag;
    if (!out[id]) out[id] = {};
    out[id][cond] = tag;
  }
  return out;
}

/**
 * 단일 (catalogId, inputCondition) 페어 태그 upsert / 삭제.
 * tag 가 null 이면 행 삭제 (= 운영자 평가 없음 상태로 되돌림).
 * RLS 가 admin role 만 통과 — 다른 사용자가 호출하면 error.
 */
export async function upsertCatalogTag(args: {
  catalogId: string;
  inputCondition: CatalogInputCondition;
  tag: CatalogAdminTag | null;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  if (args.tag === null) {
    const { error } = await supabase
      .from('snap_catalog_tags')
      .delete()
      .eq('catalog_id', args.catalogId)
      .eq('input_condition', args.inputCondition);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }
  const { error } = await supabase.from('snap_catalog_tags').upsert(
    {
      catalog_id: args.catalogId,
      input_condition: args.inputCondition,
      tag: args.tag,
    },
    { onConflict: 'catalog_id,input_condition' },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
