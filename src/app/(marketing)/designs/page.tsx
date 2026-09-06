import type { Metadata } from 'next';
import { DesignCatalogClient } from '@/components/marketing/DesignCatalogClient';
import { getHomeSamples } from '@/lib/marketing/home-samples';

export const metadata: Metadata = {
  title: '디자인 샘플 — 우리다운',
  description:
    '컬러 테마·배경 효과·레이아웃을 조합한 알림장 디자인 샘플을 실제 미리보기로 둘러보세요.',
};

export const dynamic = 'force-dynamic';

export default async function DesignsPage() {
  const { designs } = await getHomeSamples();
  return (
    <main className="px-6 py-12 sm:py-16">
      <div className="mx-auto max-w-3xl">
        {/* 인트로(소개글 + CTA + 사진/무사진 전환 스위치)와 카탈로그 그리드는 상태를
            공유해야 하므로 클라이언트 컴포넌트가 함께 렌더한다. */}
        <DesignCatalogClient designs={designs} />
      </div>
    </main>
  );
}
