import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { checkAdmin } from '@/lib/auth/admin';
import { getSocialProof } from '@/lib/marketing/social-proof';
import { ShowcaseEditor } from './ShowcaseEditor';

export const metadata: Metadata = {
  title: 'Admin · showcase 커버',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * 운영자 전용 — 메인 사회적 증거 "디자인 사진" 마퀴에 넣을 showcase 커버 관리.
 *
 * 실제 고객 알림장(마케팅 동의)의 메인 사진에 얼굴 스티커를 붙여 익명화한 뒤,
 * 그 이미지를 heroImage 로 갈아끼운 커버 스냅샷을 저장한다. 홈에서는
 * InvitationPreview 로 config 렌더돼 실제 메인 디자인 그대로 노출된다.
 */
export default async function ShowcaseAdminPage() {
  const ctx = await checkAdmin();
  if (!ctx) notFound();

  const config = await getSocialProof();

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6">
      <header className="mb-4">
        <h1 className="text-xl font-semibold text-[#3D2E1F]">showcase 커버 관리</h1>
        <p className="mt-1 text-xs leading-relaxed text-[#8B7355]">
          고객 알림장의 메인 사진에 얼굴 스티커를 붙여 익명화한 뒤, 실제 메인 디자인을
          홈 &lsquo;디자인 사진&rsquo; 마퀴에 그대로 노출합니다.
          <span className="ml-2">로그인 계정: {ctx.email}</span>
        </p>
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-[11px] leading-relaxed text-amber-800">
          반드시 <strong>마케팅 노출에 동의한 고객</strong>의 알림장만 등록하세요. 얼굴은
          스티커로 가리고 이름은 익명(이니셜)으로 저장됩니다.
        </p>
      </header>

      <ShowcaseEditor initialCovers={config.covers} />
    </main>
  );
}
