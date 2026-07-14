'use server';

/**
 * /admin/notice-bar server action — admin role 만 통과.
 * 공지바는 마케팅 레이아웃에서 매 요청 읽으므로(동적), 저장 후 홈만 revalidate.
 */

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/admin';
import { saveNoticeBar, type NoticeBarConfig } from '@/lib/marketing/notice-bar';

export async function saveNoticeBarAction(
  config: NoticeBarConfig,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: 'forbidden' };
  }
  const res = await saveNoticeBar(config);
  if (!res.ok) return res;
  revalidatePath('/');
  revalidatePath('/admin/notice-bar');
  return { ok: true };
}
