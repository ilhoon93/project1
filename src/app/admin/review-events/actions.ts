'use server';

/**
 * /admin/review-events server actions — admin 만 통과.
 *
 * 관리자가 포토리뷰 이벤트 제출을 확인하면 영구소장권 1개를 적립하고 상태를
 * confirmed 로 바꾼다. archive_credit_granted 플래그로 중복 적립을 막는다.
 */

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';

export async function confirmReviewEvent(
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch {
    return { ok: false, error: 'forbidden' };
  }

  const admin = createAdminClient();
  // review_event_submissions 는 자동생성 DB 타입(064 미반영)에 아직 없어 any 캐스팅.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const table = () => (admin as any).from('review_event_submissions');

  const { data: row, error: readErr } = await table()
    .select('user_id, status, archive_credit_granted')
    .eq('user_id', userId)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  if (!row) return { ok: false, error: '제출을 찾을 수 없습니다.' };

  // 아직 적립 전이면 영구소장권 1개 적립.
  if (!row.archive_credit_granted) {
    // archive_credits_ledger 는 자동생성 DB 타입에 없어 any 캐스팅.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: ledgerErr } = await (admin as any)
      .from('archive_credits_ledger')
      .insert({
        user_id: userId,
        delta: 1,
        reason: 'event',
        ref_table: 'review_event_submissions',
        note: 'photo review event',
      });
    if (ledgerErr) return { ok: false, error: `적립 실패: ${ledgerErr.message}` };
  }

  const { error: updErr } = await table()
    .update({
      status: 'confirmed',
      archive_credit_granted: true,
      confirmed_at: new Date().toISOString(),
      confirmed_by: ctx.userId,
    })
    .eq('user_id', userId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath('/admin/review-events');
  return { ok: true };
}
