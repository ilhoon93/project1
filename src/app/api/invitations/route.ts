import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  CreateInvitationSchema,
  defaultInvitationContent,
} from '@/types/invitation';
import { generateSlug } from '@/lib/utils/nanoid';
import { PG_UNIQUE_VIOLATION } from '@/lib/utils/validation';
import { MAX_INVITATIONS_PER_USER } from '@/lib/limits';

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('invitations')
    .select('id, slug, groom_name, bride_name, wedding_date, is_published, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invitations: data });
}

export async function POST(req: Request) {
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
    input = CreateInvitationSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: e.issues }, { status: 400 });
    }
    throw e;
  }

  // Enforce per-user invitation cap.
  const { count, error: countErr } = await supabase
    .from('invitations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);
  if (countErr) {
    return NextResponse.json({ error: countErr.message }, { status: 500 });
  }
  if ((count ?? 0) >= MAX_INVITATIONS_PER_USER) {
    return NextResponse.json(
      {
        error: `알림장은 계정당 최대 ${MAX_INVITATIONS_PER_USER}개까지만 만들 수 있어요. 마이페이지에서 사용하지 않는 알림장을 삭제한 뒤 다시 시도해주세요.`,
      },
      { status: 409 },
    );
  }

  const content = defaultInvitationContent();

  // Retry on slug collision (vanishingly rare with 8-char nanoid).
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = generateSlug();
    const { data, error } = await supabase
      .from('invitations')
      .insert({
        user_id: user.id,
        slug,
        groom_name: input.groomName,
        bride_name: input.brideName,
        wedding_date: input.weddingDate ?? null,
        content,
      })
      .select('id, slug')
      .single();

    if (!error) {
      return NextResponse.json({ invitation: data }, { status: 201 });
    }
    if (error.code !== PG_UNIQUE_VIOLATION) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  return NextResponse.json({ error: 'Failed to allocate slug' }, { status: 500 });
}
