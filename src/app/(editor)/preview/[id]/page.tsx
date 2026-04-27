import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { InvitationContentSchema } from '@/types/invitation';
import { InvitationSlides } from '@/components/invitation/InvitationSlides';
import { PreviewBanner } from './preview-banner';

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

  return (
    <div className="relative">
      <PreviewBanner
        invitationId={data.id}
        slug={data.slug}
        isPublished={data.is_published}
        paidAt={data.paid_at}
      />
      <InvitationSlides
        invitationId={data.id}
        groomName={data.groom_name}
        brideName={data.bride_name}
        weddingDate={data.wedding_date}
        content={content}
        isPreview
      />
    </div>
  );
}
