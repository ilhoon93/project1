import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SnapGenerator } from '@/components/snap/SnapGenerator';
import { getAvailableCatalog } from '@/lib/snap/catalog-availability';

export const metadata: Metadata = {
  title: 'AI 웨딩스냅 — 사진 업로드 / 카탈로그 선택',
};

export default async function WeddingSnapCreatePage() {
  // 인증 게이트 — 비로그인 시 로그인 페이지로 보낸 뒤 다시 이 페이지로 복귀.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/wedding-snap/create');

  // hidden / 마스터 파일 없는 항목 제외 (랜딩 미리보기와 동일 기준).
  const availableCatalog = getAvailableCatalog();

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6">
      <h1 className="text-xl font-semibold tracking-tight text-[#3D2E1F]">
        AI 웨딩스냅 만들기
      </h1>
      <p className="mt-2 text-xs text-[#8B7355]">
        평균 생성 시간 60~120초 · 1컷당 스냅 크레딧 1개 차감
      </p>
      <SnapGenerator catalog={availableCatalog} />
    </main>
  );
}
