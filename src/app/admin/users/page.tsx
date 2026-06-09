import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { checkAdmin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { UsersTable, type AdminUserRow } from './UsersTable';

export const metadata: Metadata = {
  title: 'Admin · 가입자 / 크레딧',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * 운영자 전용 — 가입자 목록 + 크레딧/결제 현황 조회 + 크레딧 수동 조정.
 *
 * admin_user_overview RPC(service_role 전용)로 가입자별 발행권/영구소장/스냅
 * 잔액과 결제 건수/총액을 한 번에 집계해 가져온다. 크레딧 조정은 행 단위
 * 인라인 폼 → adjustCredits 서버 액션 → admin_adjust_credits RPC.
 */
export default async function AdminUsersPage() {
  const admin = await checkAdmin();
  if (!admin) notFound();

  const sb = createAdminClient();
  const { data, error } = await sb.rpc('admin_user_overview');
  const rows = (Array.isArray(data) ? data : []) as AdminUserRow[];

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6">
      <header className="mb-4">
        <h1 className="text-xl font-semibold text-[#3D2E1F]">가입자 / 크레딧</h1>
        <p className="mt-1 text-xs leading-relaxed text-[#8B7355]">
          가입자별 크레딧(발행권 / 영구소장 / 스냅) 잔액과 결제 현황을 조회하고,
          크레딧을 수동으로 지급/회수합니다. 조정 내역은 각 원장에
          admin_grant / admin_revoke 로 기록돼요.
          <span className="ml-2">로그인 계정: {admin.email}</span>
        </p>
      </header>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          가입자 목록을 불러오지 못했습니다: {error.message}
          <br />
          (마이그레이션 044 가 적용되었는지 확인해주세요.)
        </p>
      ) : (
        <UsersTable rows={rows} />
      )}
    </main>
  );
}
