import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { InvitationContentSchema } from '@/types/invitation';
import { EditorClient } from './editor-client';

export default async function EditPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('invitations')
    .select('id, groom_name, bride_name, wedding_date, content, is_published')
    .eq('id', params.id)
    .maybeSingle();

  if (error || !data) notFound();

  if (data.is_published) {
    redirect(`/preview/${data.id}`);
  }

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
    />
  );
}
