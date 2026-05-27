import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { checkAdmin } from '@/lib/auth/admin';
import { getHomeSamplesConfig } from '@/lib/marketing/home-samples';
import { getAvailableCatalog } from '@/lib/snap/catalog-availability';
import { HomeSamplesEditor } from './HomeSamplesEditor';

export const metadata: Metadata = {
  title: 'Admin · 메인 샘플 설정',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * 운영자 전용 — 메인(랜딩)의 샘플 AI스냅 + 알림장 디자인 표지 설정.
 * 권한: app_metadata.role === 'admin' 만. 그 외 404.
 */
export default async function HomeSamplesAdminPage() {
  const admin = await checkAdmin();
  if (!admin) notFound();

  const config = await getHomeSamplesConfig();
  const catalog = await getAvailableCatalog();
  const catalogItems = catalog.map((c) => ({
    id: c.id,
    label: c.label,
    src: `/wedding-snap/catalog/${c.id}.jpg`,
  }));

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6">
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-[#3D2E1F]">메인 샘플 설정</h1>
        <p className="mt-1 text-xs text-[#8B7355]">
          메인 화면의 샘플 AI스냅(폴라로이드·스트립)과 알림장 디자인 표지를 세팅합니다.
          저장하면 메인/디자인 샘플 페이지에 즉시 반영됩니다.
        </p>
      </header>
      <HomeSamplesEditor initialConfig={config} catalog={catalogItems} />
    </main>
  );
}
