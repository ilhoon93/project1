import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getImageEditResult } from '@/lib/fal/client';

/**
 * POST /api/snap/finalize
 *
 * fal.ai 큐 작업이 COMPLETED 된 뒤 호출. 결과 URL 을 받아 우리 Storage 에 저장하고
 * 영구 public URL 을 돌려준다 (fal.ai CDN 은 짧은 수명이라 재호스팅 필수).
 *
 * 무료 AI 와 달리 사용량 제한(ai_image_usage)을 적용하지 않는다 — 웨딩스냅은
 * 결제 단위로 N장을 만드는 유료 흐름이고, 결제 검증은 별도 라우트에서 다룬다.
 * 또 alone-standing 결과물(알림장 content 와 무관) 이라 invitation 갱신도 없음.
 */

const BodySchema = z.object({
  requestId: z.string().min(1),
  catalogId: z.string().min(1).optional(),
});

export const maxDuration = 30;

export async function POST(req: Request) {
  // 1. Auth
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 2. Validate body
  let input;
  try {
    input = BodySchema.parse(await req.json());
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: e.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // 3. fal.ai 결과 URL 가져오기 (이미 COMPLETED 상태여야 함).
  let generatedUrl: string;
  try {
    generatedUrl = await getImageEditResult(input.requestId);
  } catch (e) {
    console.error('[snap/finalize] fal.queue.result error', e);
    return NextResponse.json(
      { error: '결과 조회에 실패했습니다.' },
      { status: 502 },
    );
  }

  // 4. fal.ai CDN → 우리 public-images 버킷에 재호스팅.
  let publicUrl: string;
  try {
    const blob = await fetch(generatedUrl).then((r) => {
      if (!r.ok) throw new Error(`fetch generated image: ${r.status}`);
      return r.blob();
    });
    const slug = input.catalogId ? `${input.catalogId}-` : '';
    const path = `wedding-snap/${user.id}/${slug}${Date.now()}.jpg`;
    const admin = createAdminClient();
    const { error: upErr } = await admin.storage
      .from('public-images')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (upErr) throw upErr;
    publicUrl = admin.storage.from('public-images').getPublicUrl(path).data.publicUrl;
  } catch (e) {
    console.error('[snap/finalize] storage upload error', e);
    return NextResponse.json(
      { error: '이미지 저장에 실패했습니다.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: publicUrl });
}
