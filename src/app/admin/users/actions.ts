'use server';

/**
 * 가입자 크레딧 가감 — admin 만 통과.
 * admin_adjust_credits RPC(service_role 전용)를 admin 클라이언트로 호출.
 */

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';

const KINDS = ['publish', 'archive', 'snap'] as const;
type CreditKind = (typeof KINDS)[number];

export async function adjustCredits(args: {
  userId: string;
  kind: CreditKind;
  delta: number;
  note?: string;
}): Promise<{ ok: boolean; error?: string; balance?: number }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: 'forbidden' };
  }
  if (!args.userId || typeof args.userId !== 'string') {
    return { ok: false, error: 'invalid user' };
  }
  if (!KINDS.includes(args.kind)) {
    return { ok: false, error: 'invalid kind' };
  }
  if (!Number.isInteger(args.delta) || args.delta === 0) {
    return { ok: false, error: '가감 수량은 0이 아닌 정수여야 합니다' };
  }
  if (Math.abs(args.delta) > 10000) {
    return { ok: false, error: '한 번에 ±10000 까지만 조정할 수 있습니다' };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('admin_adjust_credits', {
    p_user_id: args.userId,
    p_kind: args.kind,
    p_delta: args.delta,
    p_note: args.note ?? null,
  });
  if (error) return { ok: false, error: error.message };

  const result = data as { balance?: number } | null;
  revalidatePath('/admin/users');
  return { ok: true, balance: result?.balance };
}
