import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { checkAdmin } from '@/lib/auth/admin';
import { SNAP_CATALOG } from '@/lib/snap/catalog';
import { fetchAllCatalogTags } from '@/lib/snap/catalog-admin-tags';
import { CatalogTagsTable } from './CatalogTagsTable';

export const metadata: Metadata = {
  title: 'Admin · 카탈로그 태그 관리',
  robots: { index: false, follow: false },
};

// admin route 는 항상 dynamic — 운영자 변경이 즉시 반영되도록 cache 없음.
export const dynamic = 'force-dynamic';

/**
 * 운영자 전용 페이지 — 카탈로그 × 입력 조건 별 태그 세팅.
 *
 *  입력 조건 (2):
 *    selfies          — 셀카 모드
 *    couple-fullbody  — 커플 모드 + 입력 전신
 *
 *  태그 (4):
 *    recommend / caution / risky / hidden
 *
 *  미설정 = 운영자 평가 없음 (default 동작).
 *
 * 권한: supabase user 의 app_metadata.role === 'admin' 만 접근. 그 외는 404.
 */
export default async function SnapCatalogTagsAdminPage() {
  const admin = await checkAdmin();
  if (!admin) notFound();

  const tagMap = await fetchAllCatalogTags();
  // SNAP_CATALOG 자체는 코드 source-of-truth — admin 페이지에서 추가/삭제는 안 함.
  // 표시 순서는 코드 정의 순서 그대로 (직관적).
  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-6">
      <header className="mb-4">
        <h1 className="text-xl font-semibold text-[#3D2E1F]">
          카탈로그 태그 관리
        </h1>
        <p className="mt-1 text-xs text-[#8B7355]">
          입력 조건(셀카 / 커플 전신) 별로 카탈로그 등급을 세팅합니다. 운영자가
          설정한 태그는 사용자 페이지의 호환성 판정에 그대로 반영돼요.
          미설정 = default 동작.
          <span className="ml-2">로그인 계정: {admin.email}</span>
        </p>
      </header>
      <CatalogTagsTable catalog={SNAP_CATALOG} tagMap={tagMap} />
    </main>
  );
}
