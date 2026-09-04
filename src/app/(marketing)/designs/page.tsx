import type { Metadata } from 'next';
import Link from 'next/link';
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
        {/* 소개글 좌 + CTA 우(상단 정렬) — 페이지 진입 즉시 "무료로 만들기"
            액션이 viewport 안에 들어오게. 모바일은 CTA 가 자연스럽게 아래로 떨어짐. */}
        <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:gap-6">
          <div className="min-w-0 flex-1">
            <div className="font-italiana text-[11px] font-medium tracking-[0.18em] text-[var(--wd-coral)]">
              DESIGN SAMPLES
            </div>
            <h1 className="mt-2 max-w-[20ch] text-balance break-keep text-[24px] font-medium leading-[1.4] tracking-tight sm:text-[28px]">
              마음에 드는 디자인을 고르고, 우리답게 바꾸세요
            </h1>
            <p className="mt-2 max-w-[540px] break-keep text-[14px] leading-[1.75] text-[var(--wd-mute)]">
              아래는 14가지 컬러 테마와 9가지 움직이는 배경 효과, 14가지 레이아웃 디자인을
              자유롭게 조합해 만든 실제 알림장 미리보기예요. 카드를 누르면 다양한 폰트와
              텍스트 애니메이션까지 입힌 전체 알림장을 폰 화면 그대로 둘러볼 수 있습니다.
            </p>
          </div>
          <Link
            href="/new"
            className="inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--wd-ink)] px-5 py-3 text-[13px] font-medium text-[var(--wd-cream)] transition-transform active:scale-[0.97] sm:mt-1"
          >
            무료로 내 알림장 만들기 →
          </Link>
        </div>

        <div className="mt-8">
          <DesignCatalogClient designs={designs} />
        </div>
      </div>
    </main>
  );
}
