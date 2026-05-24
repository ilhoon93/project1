/**
 * 운영자 권한 체크 helper.
 *
 * supabase auth user 의 `app_metadata.role === 'admin'` 인 사용자만 admin 페이지
 * / admin RPC 접근 가능. raw_app_meta_data 는 supabase service 키 또는 console
 * 에서만 set 가능 — 사용자가 클라이언트에서 변조 불가.
 *
 * 운영자 권한 부여:
 *   supabase SQL editor 에서:
 *     update auth.users
 *     set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'::jsonb
 *     where email = 'admin@example.com';
 */

import { createClient } from '@/lib/supabase/server';

export interface AdminContext {
  userId: string;
  email: string | null;
}

/**
 * 현재 요청의 사용자가 admin 인지 확인. 아니면 null.
 * 페이지에서 redirect / API 에서 403 분기에 사용.
 */
export async function checkAdmin(): Promise<AdminContext | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const role =
    (user.app_metadata as { role?: string } | null | undefined)?.role ?? null;
  if (role !== 'admin') return null;
  return {
    userId: user.id,
    email: user.email ?? null,
  };
}

/**
 * 페이지 / route handler 안에서 admin 만 통과시키는 가드.
 * admin 아니면 throw — Next.js error boundary 가 404 처리.
 *
 * 사용 예 (server component):
 *   const ctx = await requireAdmin();   // admin 이면 통과, 아니면 notFound() throw
 */
export async function requireAdmin(): Promise<AdminContext> {
  const ctx = await checkAdmin();
  if (!ctx) {
    // 404 는 notFound() import 필요 — 호출부에서 다시 wrapping. 여기선 Error throw.
    const err = new Error('forbidden: admin only');
    (err as { status?: number }).status = 404;
    throw err;
  }
  return ctx;
}
