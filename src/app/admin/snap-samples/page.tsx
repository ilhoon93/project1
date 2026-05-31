import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { checkAdmin } from '@/lib/auth/admin';
import { getHomeSamplesConfig } from '@/lib/marketing/home-samples';
import { getAvailableCatalog } from '@/lib/snap/catalog-availability';
import { SnapSamplesEditor } from '../home-samples/HomeSamplesEditor';

export const metadata: Metadata = {
  title: 'Admin · AI 스냅 샘플 설정',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * 운영자 전용 — 메인(랜딩)의 샘플 AI스냅(폴라로이드·스트립) + Before/After 설정.
 * 알림장 디자인 샘플 설정은 /admin/home-samples 로 분리.
 * 권한: app_metadata.role === 'admin' 만. 그 외 404.
 */
export default async function SnapSamplesAdminPage() {
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-[#3D2E1F]">AI 스냅 샘플 설정</h1>
          <Link
            href="/admin/home-samples"
            className="rounded-full border border-[#8B7355]/40 px-3 py-1.5 text-[12px] font-medium text-[#5C4633] hover:bg-[#FAF7F2]"
          >
            ← 알림장 샘플 설정
          </Link>
        </div>
        <p className="mt-1 text-xs text-[#8B7355]">
          메인 화면의 샘플 AI스냅(폴라로이드·썸네일 스트립)과 Before/After 슬라이더를
          세팅합니다. 저장하면 메인 페이지에 즉시 반영됩니다.
        </p>
      </header>
      <SnapSamplesEditor initialConfig={config} catalog={catalogItems} />
    </main>
  );
}
