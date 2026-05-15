import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { InvitationContentSchema } from '@/types/invitation';
import { PreviewBanner } from './preview-banner';
import { LivePreview } from './live-preview';

// 저장 → 미리보기 → 편집 → 미리보기 흐름에서 Next.js Router Cache 가
// 옛 RSC 를 돌려주는 사고를 막기 위해 명시적으로 dynamic 강제 + 캐시 비활성화.
// Supabase 클라이언트가 cookies() 를 쓰기 때문에 사실상 dynamic 이지만,
// build/cache 분석에서 우발적으로 캐시되는 일을 차단.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  params: { id: string };
}

export default async function PreviewPage({ params }: PageProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data } = await supabase
    .from('invitations')
    .select('id, slug, groom_name, bride_name, wedding_date, content, is_published, paid_at')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!data) notFound();

  const content = InvitationContentSchema.parse(data.content ?? {});

  // Most recent active publication URL (for the "공개 링크 열기" hint)
  const { data: pubs } = await supabase
    .from('publications')
    .select('slug, expires_at, revoked_at')
    .eq('invitation_id', data.id)
    .order('published_at', { ascending: false })
    .limit(1);
  const activePub =
    pubs?.find((p) => !p.revoked_at && new Date(p.expires_at) > new Date()) ?? null;

  return (
    <div className="relative">
      <PreviewBanner
        invitationId={data.id}
        publishedSlug={activePub?.slug ?? null}
        isPublished={data.is_published}
      />
      <LivePreview
        invitationId={data.id}
        groomName={data.groom_name}
        brideName={data.bride_name}
        weddingDate={data.wedding_date}
        content={content}
      />
    </div>
  );
}
