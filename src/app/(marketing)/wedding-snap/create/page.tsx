import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import fs from 'fs';
import path from 'path';
import { createClient } from '@/lib/supabase/server';
import { SnapGenerator } from '@/components/snap/SnapGenerator';
import { SNAP_CATALOG } from '@/lib/snap/catalog';

export const metadata: Metadata = {
  title: 'AI 웨딩스냅 — 사진 입력 / 카탈로그 선택',
};

/**
 * 카탈로그 마스터 이미지가 실제로 public/ 에 존재하는 항목만 picker 에 노출.
 *
 * 카탈로그 정의는 코드(`SNAP_CATALOG`) 에 그대로 두지만, 마스터 파일이 아직
 * 안 올라온 항목은 사용자에게 "선택했는데 생성 실패" 가 나는 걸 방지하기 위해
 * 서버사이드에서 filesystem 체크해서 거른다. 새 jpg 만 올리면 재배포 시 자동 노출.
 */
function filterCatalogWithImages() {
  return SNAP_CATALOG.filter((item) => {
    // item.image 는 '/wedding-snap/catalog/xxx.jpg' 형식 — process.cwd() 기준
    // public/ 하위 절대 경로로 풀어 존재 여부 확인.
    const rel = item.image.startsWith('/') ? item.image.slice(1) : item.image;
    const abs = path.join(process.cwd(), 'public', rel);
    try {
      return fs.statSync(abs).isFile();
    } catch {
      return false;
    }
  });
}

export default async function WeddingSnapCreatePage() {
  // 인증 게이트 — 비로그인 시 로그인 페이지로 보낸 뒤 다시 이 페이지로 복귀.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/wedding-snap/create');

  const availableCatalog = filterCatalogWithImages();

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6">
      <h1 className="text-xl font-semibold tracking-tight text-[#3D2E1F]">
        AI 웨딩스냅 — 샘플 테스트
      </h1>
      <p className="mt-2 text-xs text-[#8B7355]">
        MVP 단계 · 결제 없이 카탈로그 1컷씩 시험 생성
      </p>
      <SnapGenerator catalog={availableCatalog} />
    </main>
  );
}
