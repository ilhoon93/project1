import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getImageEditResult } from '@/lib/fal/client';
import { isConceptKey } from '@/lib/fal/concepts';

/**
 * POST /api/ai/concept-finalize
 *
 * fal.ai 큐 작업이 COMPLETED 된 뒤 호출. 결과 URL 을 받아 우리 Storage 에 저장하고,
 * ai_image_usage 사용량을 +1 한다. (fal.ai CDN 은 짧은 수명이라 반드시 재호스팅.)
 *
 * 한 번의 함수 호출은 fetch + upload + DB 만 하므로 3–5초 안쪽으로 끝난다.
 */

const BodySchema = z.object({
  requestId: z.string().min(1),
  concept: z.string().refine(isConceptKey, { message: 'Unknown concept' }),
});

export const maxDuration = 30;

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let input;
  try {
    input = BodySchema.parse(await req.json());
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: e.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // 다시 쿼터 확인 — submit 이후 다른 탭에서 finalize 가 먼저 들어왔을 수 있음.
  const admin = createAdminClient();
  const { data: usage } = await admin
    .from('ai_image_usage')
    .select('used_count')
    .eq('user_id', user.id)
    .maybeSingle();
  if (usage && usage.used_count >= 1) {
    return NextResponse.json(
      { error: 'AI 이미지 생성은 계정당 1회만 사용 가능합니다.', code: 'quota_exhausted' },
      { status: 403 },
    );
  }

  // 1. fal.ai 결과 URL 가져오기 (이미 COMPLETED 상태여야 함).
  let generatedUrl: string;
  try {
    generatedUrl = await getImageEditResult(input.requestId);
  } catch (e) {
    console.error('[ai/concept-finalize] fal.queue.result error', e);
    return NextResponse.json(
      { error: '결과를 가져오는 데 실패했습니다.' },
      { status: 502 },
    );
  }

  // 2. fal.ai CDN → 우리 public-images 버킷에 재호스팅.
  let publicUrl: string;
  let storagePath: string;
  try {
    const blob = await fetch(generatedUrl).then((r) => {
      if (!r.ok) throw new Error(`fetch generated image: ${r.status}`);
      return r.blob();
    });
    storagePath = `ai-results/${user.id}/${input.concept}-${Date.now()}.jpg`;
    const { error: upErr } = await admin.storage
      .from('public-images')
      .upload(storagePath, blob, { contentType: 'image/jpeg', upsert: false });
    if (upErr) throw upErr;
    publicUrl = admin.storage.from('public-images').getPublicUrl(storagePath).data.publicUrl;
  } catch (e) {
    console.error('[ai/concept-finalize] storage upload error', e);
    return NextResponse.json(
      { error: '이미지 저장에 실패했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 },
    );
  }

  // 3. 사용량 기록 — INSERT ON CONFLICT(user_id) DO UPDATE.
  const { error: usageErr } = await admin.from('ai_image_usage').upsert(
    {
      user_id: user.id,
      used_count: (usage?.used_count ?? 0) + 1,
      last_used_at: new Date().toISOString(),
      last_image_path: storagePath,
    },
    { onConflict: 'user_id' },
  );
  if (usageErr) {
    console.error('[ai/concept-finalize] usage upsert error', usageErr);
  }

  return NextResponse.json({ url: publicUrl });
}
