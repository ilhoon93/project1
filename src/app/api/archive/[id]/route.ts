import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/archive/[id]
 *
 * 영구소장 적용 — `id` 는 `publications.id`. 1 archive credit 차감 + archived = true.
 * 적용된 publications 의 owner URL 은 만료 검사를 우회한다 (소장용 영구 보관).
 * 하객용 URL 은 영향을 받지 않고 기존 expires_at 그대로.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase.rpc('apply_archive', {
    pub_id: params.id,
  });
  if (error) {
    if (error.message.includes('Insufficient archive credits')) {
      return NextResponse.json(
        { error: '영구소장 권한이 부족합니다. 마이페이지에서 영구소장 패키지를 구매해주세요.', code: 'no_credits' },
        { status: 402 },
      );
    }
    if (error.message.includes('Already archived')) {
      return NextResponse.json(
        { error: '이미 영구소장된 알림장입니다.', code: 'already_archived' },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, result: data });
}
