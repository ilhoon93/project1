'use server';

/**
 * admin route 의 server action — admin role 만 통과.
 *
 * 클라이언트 form 에서 useFormState / fetch 로 호출. 결과는 server-side
 * revalidatePath 로 admin 페이지 자체를 다시 그려 최신 상태 반영.
 */

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/admin';
import {
  upsertCatalogTag,
  type CatalogAdminTag,
  type CatalogInputCondition,
} from '@/lib/snap/catalog-admin-tags';

const VALID_TAGS: CatalogAdminTag[] = ['recommend', 'caution', 'risky', 'hidden'];
const VALID_CONDS: CatalogInputCondition[] = ['selfies', 'couple-fullbody'];

export async function setCatalogTag(args: {
  catalogId: string;
  inputCondition: CatalogInputCondition;
  /** null = 행 삭제 (운영자 평가 없음 상태로 되돌림) */
  tag: CatalogAdminTag | null;
}): Promise<{ ok: boolean; error?: string }> {
  // 권한 체크 — admin 아니면 throw.
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: 'forbidden' };
  }
  // 입력 검증.
  if (!args.catalogId || typeof args.catalogId !== 'string') {
    return { ok: false, error: 'invalid catalogId' };
  }
  if (!VALID_CONDS.includes(args.inputCondition)) {
    return { ok: false, error: 'invalid inputCondition' };
  }
  if (args.tag !== null && !VALID_TAGS.includes(args.tag)) {
    return { ok: false, error: 'invalid tag' };
  }
  const res = await upsertCatalogTag(args);
  if (!res.ok) return res;
  // 페이지 다시 그리기 (서버 컴포넌트 fresh fetch).
  revalidatePath('/admin/snap-catalog-tags');
  return { ok: true };
}
