import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { checkAdmin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { getDisplayEmail } from '@/lib/naver/account';
import { ReviewEventsAdmin, type ReviewEventRow } from './ReviewEventsAdmin';

export const metadata: Metadata = {
  title: 'Admin · 포토리뷰 이벤트',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * 운영자 전용 — 포토리뷰 이벤트 제출 모아보기. 캡처본/동의 확인 후 '확인'을 누르면
 * 영구소장권 1개가 적립되고 상태가 confirmed 로 바뀐다.
 */
export default async function ReviewEventsAdminPage() {
  const ctx = await checkAdmin();
  if (!ctx) notFound();

  const admin = createAdminClient();
  // review_event_submissions 는 자동생성 DB 타입(064 미반영)에 아직 없어 any 캐스팅.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from('review_event_submissions')
    .select('user_id, image_url, status, created_at')
    .order('created_at', { ascending: false });

  const rows: ReviewEventRow[] = [];
  for (const r of (data ?? []) as Array<{
    user_id: string;
    image_url: string;
    status: string;
    created_at: string;
  }>) {
    rows.push({
      userId: r.user_id,
      email: await getDisplayEmail(r.user_id, null),
      imageUrl: r.image_url,
      status: r.status === 'confirmed' ? 'confirmed' : 'submitted',
      createdAt: r.created_at,
    });
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6">
      <header className="mb-4">
        <h1 className="text-xl font-semibold text-[#3D2E1F]">포토리뷰 이벤트</h1>
        <p className="mt-1 text-xs leading-relaxed text-[#8B7355]">
          고객이 제출한 리뷰 캡처본을 확인하고 &lsquo;확인&rsquo;을 누르면 영구소장권이
          적립됩니다.
          <span className="ml-2">로그인 계정: {ctx.email}</span>
        </p>
      </header>

      <ReviewEventsAdmin rows={rows} />
    </main>
  );
}
