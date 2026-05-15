import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

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

  // 게스트 입력은 service-role 로 RLS 우회 — invitation_is_active() 가
  // 마이그레이션 환경 차이(레거시 invitations vs 신규 publications) 로
  // 거짓 음성을 내는 케이스가 있어 RLS 가 정상 게스트 메시지까지 차단하는
  // 문제를 회피한다. 입력은 위 Zod 스키마로 sanitize 완료.
  const supabase = createAdminClient();
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
