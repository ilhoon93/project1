import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { checkAdmin } from '@/lib/auth/admin';
import { getNoticeBar } from '@/lib/marketing/notice-bar';
import { NoticeBarEditor } from './NoticeBarEditor';

export const metadata: Metadata = {
  title: 'Admin · 상단 공지바',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * 운영자 전용 — 홈 상단 공지바(문구/링크/노출 여부) 설정.
 * 기본 비노출. 노출 토글을 켜면 마케팅 페이지 상단 전체폭 띠로 노출된다.
 */
export default async function NoticeBarAdminPage() {
  const ctx = await checkAdmin();
  if (!ctx) notFound();

  const config = await getNoticeBar();

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6 sm:px-6">
      <header className="mb-4">
        <h1 className="text-xl font-semibold text-[#3D2E1F]">상단 공지바</h1>
        <p className="mt-1 text-xs leading-relaxed text-[#8B7355]">
          홈(마케팅) 페이지 상단에 전체폭으로 노출되는 공지 띠를 설정합니다. 기존
          고객에게 개별 메시지 대신 홈 안내로 갈음할 때 사용하세요.
          <span className="ml-2">로그인 계정: {ctx.email}</span>
        </p>
      </header>

      <NoticeBarEditor initialConfig={config} />
    </main>
  );
}
