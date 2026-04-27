import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Atomic: row-locks the invitation, validates payment, flips is_published
  const { error } = await supabase.rpc('publish_invitation', { inv_id: params.id });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data } = await supabase
    .from('invitations')
    .select('slug, expires_at')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  return NextResponse.json({
    success: true,
    slug: data?.slug,
    expiresAt: data?.expires_at,
    url: `${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/${data?.slug}`,
  });
}
