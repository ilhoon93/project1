'use server';

/**
 * 카탈로그 노출 순서 저장 — admin 만 통과.
 * 운영자가 정렬한 catalogId 배열을 받아 0,1,2,... 로 다시 기록한다.
 */

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/admin';
import { replaceCatalogOrder } from '@/lib/snap/catalog-order';

export async function saveCatalogOrder(
  orderedIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: 'forbidden' };
  }
  if (!Array.isArray(orderedIds) || orderedIds.some((x) => typeof x !== 'string')) {
    return { ok: false, error: 'invalid input' };
  }
  const res = await replaceCatalogOrder(orderedIds);
  if (!res.ok) return res;
  // 운영자 페이지 + 사용자 노출 페이지 둘 다 재검증.
  revalidatePath('/admin/snap-catalog-order');
  revalidatePath('/wedding-snap');
  revalidatePath('/wedding-snap/create');
  return { ok: true };
}

/** 운영자 지정 순서 전체 초기화 → 코드(기본) 순서로 폴백. */
export async function resetCatalogOrder(): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: 'forbidden' };
  }
  const res = await replaceCatalogOrder([]);
  if (!res.ok) return res;
  revalidatePath('/admin/snap-catalog-order');
  revalidatePath('/wedding-snap');
  revalidatePath('/wedding-snap/create');
  return { ok: true };
}
