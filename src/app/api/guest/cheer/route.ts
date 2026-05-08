import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/guest/cheer
 *
 * 메인 슬라이드의 "축하하기" 버튼 클릭 시 호출. invitation_cheers 테이블의
 * 누적 카운트를 +1 한다. 익명 사용자도 호출 가능 (RPC 가 security definer).
 */
const BodySchema = z.object({
  invitationId: z.string().uuid(),
});

export async function POST(req: Request) {
  let body;
  try {
    body = BodySchema.parse(await req.json());
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: e.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc('bump_cheers', {
    inv_id: body.invitationId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true, count: data ?? null });
}
