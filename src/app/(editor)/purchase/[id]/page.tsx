import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PurchaseClient } from './purchase-client';

interface PageProps {
  params: { id: string };
}

export default async function PurchasePage({ params }: PageProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: inv } = await supabase
    .from('invitations')
    .select('id, slug, groom_name, bride_name, wedding_date, paid_at, is_published, total_price')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!inv) notFound();
  if (inv.is_published) redirect(`/${inv.slug}`);

  return (
    <PurchaseClient
      invitation={{
        id: inv.id,
        slug: inv.slug,
        groomName: inv.groom_name,
        brideName: inv.bride_name,
        weddingDate: inv.wedding_date,
        paidAt: inv.paid_at,
        totalPrice: inv.total_price,
      }}
      userEmail={user.email ?? null}
      userName={user.user_metadata?.name ?? user.user_metadata?.preferred_username ?? null}
      portoneStoreId={process.env.NEXT_PUBLIC_PORTONE_STORE_ID ?? ''}
      portoneChannelKey={process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY ?? ''}
    />
  );
}
