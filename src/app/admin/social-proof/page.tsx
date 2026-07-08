import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { checkAdmin } from '@/lib/auth/admin';
import { getSocialProof } from '@/lib/marketing/social-proof';
import { SocialProofEditor } from './SocialProofEditor';

export const metadata: Metadata = {
  title: 'Admin · 사회적 증거 설정',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * 운영자 전용 — 메인 알림장 섹션 하단 사회적 증거(리뷰 이미지 + 커플 수 등) 세팅.
 *
 * 현재는 세팅 저장만 하고 실제 메인 렌더에는 아직 연결하지 않는다(요청사항).
 * enabled 토글/문구/이미지를 미리 준비해두고, 이후 랜딩 연결 시 그대로 사용.
 */
export default async function SocialProofAdminPage() {
  const ctx = await checkAdmin();
  if (!ctx) notFound();

  const config = await getSocialProof();

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6">
      <header className="mb-4">
        <h1 className="text-xl font-semibold text-[#3D2E1F]">사회적 증거 설정</h1>
        <p className="mt-1 text-xs leading-relaxed text-[#8B7355]">
          메인 화면 알림장 소개 섹션 하단에 넣을 리뷰 이미지와 커플 수 등을 세팅합니다.
          <span className="ml-2">로그인 계정: {ctx.email}</span>
        </p>
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-[11px] leading-relaxed text-amber-800">
          아직 실제 메인 화면에는 노출되지 않습니다. 여기서 저장한 내용은 이후 랜딩
          연결 작업에서 그대로 사용됩니다.
        </p>
      </header>

      <SocialProofEditor initialConfig={config} />
    </main>
  );
}
