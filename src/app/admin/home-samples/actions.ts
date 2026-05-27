'use server';

/**
 * /admin/home-samples server action — admin role 만 통과.
 * 저장 후 랜딩(/, /designs)과 admin 페이지를 revalidate 해 즉시 반영.
 */

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/admin';
import { saveHomeSamples } from '@/lib/marketing/home-samples';
import type { HomeSamplesConfig } from '@/lib/marketing/sample-invitations';

export async function saveHomeSamplesAction(
  config: HomeSamplesConfig,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: 'forbidden' };
  }
  const res = await saveHomeSamples(config);
  if (!res.ok) return res;
  revalidatePath('/');
  revalidatePath('/designs');
  revalidatePath('/admin/home-samples');
  return { ok: true };
}
