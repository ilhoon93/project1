import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { UpdateInvitationSchema } from '@/types/invitation';
import type { Database } from '@/types/database';

type InvitationUpdate = Database['public']['Tables']['invitations']['Update'];

type RouteCtx = { params: { id: string } };

export async function GET(_req: Request, { params }: RouteCtx) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('invitations')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ invitation: data });
}

export async function PATCH(req: Request, { params }: RouteCtx) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  let input;
  try {
    input = UpdateInvitationSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

  const update: InvitationUpdate = {};
  if (input.groomName !== undefined) update.groom_name = input.groomName;
  if (input.brideName !== undefined) update.bride_name = input.brideName;
  if (input.weddingDate !== undefined) update.wedding_date = input.weddingDate;
  if (input.content !== undefined) update.content = input.content;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('invitations')
    .update(update)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select('id, updated_at')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ invitation: data });
}

/**
 * DELETE /api/invitations/[id]
 *
 * Hard-deletes the invitation. Cascades remove guest data and any
 * publications (so previously shared URLs go 404 immediately) — the
 * user explicitly chose to wipe this invitation from their account.
 */
export async function DELETE(_req: Request, { params }: RouteCtx) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error, count } = await supabase
    .from('invitations')
    .delete({ count: 'exact' })
    .eq('id', params.id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!count) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ success: true });
}
