import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';

const PostSchema = z.object({
  invitationId: z.string().uuid(),
  visitorName: z.string().min(1).max(20),
  message: z.string().min(1).max(300),
  consentPersonalInfo: z.boolean(),
});

export async function POST(req: Request) {
  let body;
  try {
    body = PostSchema.parse(await req.json());
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: e.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('guestbook_messages')
    .insert({
      invitation_id: body.invitationId,
      visitor_name: body.visitorName,
      message: body.message,
      consent_personal_info: body.consentPersonalInfo,
    })
    .select('id, visitor_name, message, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ message: data });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const invitationId = url.searchParams.get('invitationId');
  if (!invitationId) {
    return NextResponse.json({ error: 'invitationId is required' }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('guestbook_messages')
    .select('id, visitor_name, message, created_at')
    .eq('invitation_id', invitationId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ messages: data ?? [] });
}
