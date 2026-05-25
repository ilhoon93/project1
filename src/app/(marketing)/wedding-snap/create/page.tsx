import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SnapGenerator } from '@/components/snap/SnapGenerator';
import { getAvailableCatalogWith } from '@/lib/snap/catalog-availability';
import { fetchAllCatalogTags } from '@/lib/snap/catalog-admin-tags';
import { fetchCatalogStatsMap } from '@/lib/snap/catalog-stats';

export const metadata: Metadata = {
  title: 'AI 웨딩스냅 — 사진 업로드 / 카탈로그 선택',
};

// admin 태그 변경이 즉시 반영되도록 cache 없음.
export const dynamic = 'force-dynamic';

export default async function WeddingSnapCreatePage() {
  // 인증 게이트 — 비로그인 시 로그인 페이지로 보낸 뒤 다시 이 페이지로 복귀.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/wedding-snap/create');

  // tagMap + stats 병렬 fetch — getAvailableCatalogWith + SnapGenerator 양쪽에 전달.
  // stats 는 인기/좋아요순 정렬에만 사용 — 실패 시 빈 map 으로 fallback (정렬 chip
  // 만 default 로 묶임, 기능은 그대로).
  const [adminTags, catalogStats] = await Promise.all([
    fetchAllCatalogTags(),
    fetchCatalogStatsMap(),
  ]);
  const availableCatalog = getAvailableCatalogWith(adminTags);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6">
      <h1 className="text-xl font-semibold tracking-tight text-[#3D2E1F]">
        AI 웨딩스냅 만들기
      </h1>
      <p className="mt-2 text-xs text-[#8B7355]">
        평균 생성 시간 60~120초 · 1컷당 스냅 크레딧 1개 차감
      </p>
      <SnapGenerator
        catalog={availableCatalog}
        adminTags={adminTags}
        catalogStats={catalogStats}
      />
    </main>
  );
}
