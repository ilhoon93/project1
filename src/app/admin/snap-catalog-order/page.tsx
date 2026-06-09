import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { checkAdmin } from '@/lib/auth/admin';
import { getAvailableCatalog } from '@/lib/snap/catalog-availability';
import { CatalogOrderTable } from './CatalogOrderTable';

export const metadata: Metadata = {
  title: 'Admin · 카탈로그 노출 순서',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * 운영자 전용 — AI 스냅 카탈로그의 노출(정렬) 순서 지정.
 *
 * getAvailableCatalog 는 이미 현재 저장된 순서(snap_catalog_order)대로 정렬해
 * 돌려주므로, 운영자는 현재 노출 순서 그대로를 보며 위/아래로 재배치한다.
 * 저장하면 사용자 카탈로그 화면(기본 정렬)에 즉시 반영된다.
 */
export default async function SnapCatalogOrderAdminPage() {
  const admin = await checkAdmin();
  if (!admin) notFound();

  const catalog = await getAvailableCatalog();
  const items = catalog.map((c) => ({ id: c.id, label: c.label, image: c.image }));

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6">
      <header className="mb-4">
        <h1 className="text-xl font-semibold text-[#3D2E1F]">카탈로그 노출 순서</h1>
        <p className="mt-1 text-xs leading-relaxed text-[#8B7355]">
          AI 스냅 카탈로그 화면의 <strong>기본 정렬 순서</strong>를 위/아래로 직접
          조정합니다. 저장하면 사용자 카탈로그 화면(인기/좋아요 정렬을 누르기 전
          기본 상태)에 그대로 반영돼요. &lsquo;기본 순서로 초기화&rsquo; 하면
          코드 정의 순서로 돌아갑니다.
          <span className="ml-2">로그인 계정: {admin.email}</span>
        </p>
      </header>
      <CatalogOrderTable items={items} />
    </main>
  );
}
