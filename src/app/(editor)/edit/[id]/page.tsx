import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { InvitationContentSchema } from '@/types/invitation';
import { EditorClient } from './editor-client';

// 다른 기기에서 저장한 최신 본이 즉시 보이도록 캐시 우회.
// Supabase 클라이언트가 cookies() 를 쓰기 때문에 사실상 dynamic 이 강제되지만,
// 명시적으로 표시해 빌드 분석이나 향후 변경에서 캐시되는 사고를 방지.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function EditPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('invitations')
    .select('id, groom_name, bride_name, wedding_date, content, is_published, created_at, updated_at')
    .eq('id', params.id)
    .maybeSingle();

  if (error || !data) notFound();

  // With the credit + publications model, drafts can be edited freely;
  // each publish creates a new URL while previously shared links stay
  // valid until they expire (snapshot is captured at publish time).

  // Coerce stored JSONB through Zod so missing/legacy fields get defaults.
  const content = InvitationContentSchema.parse(data.content ?? {});

  return (
    <EditorClient
      invitationId={data.id}
      meta={{
        groomName: data.groom_name,
        brideName: data.bride_name,
        weddingDate: data.wedding_date,
      }}
      content={content}
      serverUpdatedAt={data.updated_at}
      // 한 번도 저장된 적 없는 신규 알림장이면 "추천으로 시작하기" 패널을 펼쳐 안내.
      recommendOpen={data.updated_at === data.created_at}
    />
  );
}
