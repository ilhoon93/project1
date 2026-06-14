import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { checkAdmin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { InvitationContentSchema } from '@/types/invitation';
import { InvitationSlides } from '@/components/invitation/InvitationSlides';

export const metadata: Metadata = {
  title: 'Admin · 알림장 미리보기',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  params: { id: string };
}

/**
 * 운영자 알림장 미리보기 — 발행 여부와 무관하게(미발행 draft 포함) 저장된
 * 내용을 그대로 렌더한다. 소유자 한정인 /preview/[id] 와 달리 service-role 로
 * 임의 알림장을 조회하며, checkAdmin 가드로 운영자만 접근 가능.
 */
export default async function AdminInvitationPreview({ params }: PageProps) {
  const admin = await checkAdmin();
  if (!admin) notFound();

  const sb = createAdminClient();
  const { data } = await sb
    .from('invitations')
    .select(
      'id, slug, groom_name, bride_name, wedding_date, content, is_published',
    )
    .eq('id', params.id)
    .maybeSingle();
  if (!data) notFound();

  const parsed = InvitationContentSchema.safeParse(data.content ?? {});

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#15110E]">
      <div className="flex shrink-0 items-center justify-between gap-2 bg-black/80 px-4 py-2 text-[11px] text-white">
        <span className="truncate">
          운영자 미리보기 · {data.groom_name} · {data.bride_name} ·{' '}
          <span
            className={data.is_published ? 'text-emerald-300' : 'text-amber-300'}
          >
            {data.is_published ? '발행됨' : '미발행'}
          </span>
        </span>
        <Link
          href="/admin/invitations"
          className="shrink-0 rounded bg-white/15 px-3 py-1 hover:bg-white/30"
        >
          목록으로
        </Link>
      </div>

      {/* 모바일: 전체 채움 / 데스크톱: 가운데 폰 프레임(9:18 비율). scoped 로
          뷰포트 단위 대신 프레임 박스 기준으로 렌더된다. */}
      <div className="flex flex-1 justify-center overflow-hidden sm:items-center sm:p-6">
        {parsed.success ? (
          <div className="relative h-full w-full overflow-hidden bg-background sm:h-[min(86vh,880px)] sm:w-auto sm:aspect-[1/2] sm:rounded-[2.2rem] sm:border-[3px] sm:border-black sm:shadow-2xl">
            <InvitationSlides
              invitationId={data.id}
              groomName={data.groom_name}
              brideName={data.bride_name}
              weddingDate={data.wedding_date}
              content={parsed.data}
              isPreview
              scoped
            />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-xs text-white">
            저장된 콘텐츠가 현재 스키마와 호환되지 않아 미리보기를 렌더할 수
            없습니다. (구버전 데이터일 수 있음)
          </div>
        )}
      </div>
    </div>
  );
}
