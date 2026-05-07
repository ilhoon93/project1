import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { editImageWithGptImage } from '@/lib/fal/client';
import { buildConceptPrompt, isConceptKey } from '@/lib/fal/concepts';

/**
 * POST /api/ai/concept-generate
 *
 * 사용자가 직접 업로드한 사진 + 컨셉 키를 받아 fal.ai 의 chatGPT 2.0
 * (gpt-image-1) 인페인팅으로 결과 이미지를 만든 뒤 우리 Storage 에 저장,
 * publicUrl 을 반환한다. 같은 네이버 계정당 1회만 허용.
 *
 * 메인 사진 교체 로직은 없다 — 결과 URL 만 보여주고 다운로드 받게 한다.
 */

const BodySchema = z.object({
  photoUrl: z.string().url(),
  concept: z.string().refine(isConceptKey, { message: 'Unknown concept' }),
});

export const maxDuration = 60;

export async function POST(req: Request) {
  // 1. Auth — 네이버 로그인 필수.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 2. Validate body.
  let input;
  try {
    input = BodySchema.parse(await req.json());
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: e.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // 3. 사용자당 1회 제한 — service-role 로 ai_image_usage 조회.
  const admin = createAdminClient();
  const { data: usage } = await admin
    .from('ai_image_usage')
    .select('used_count')
    .eq('user_id', user.id)
    .maybeSingle();

  if (usage && usage.used_count >= 1) {
    return NextResponse.json(
      {
        error: 'AI 이미지 생성은 계정당 1회만 사용 가능합니다.',
        code: 'quota_exhausted',
      },
      { status: 403 },
    );
  }

  // 4. fal.ai 호출 — chatGPT 2.0 (gpt-image-1) 모델로 인페인팅.
  let generatedUrl: string;
  try {
    generatedUrl = await editImageWithGptImage({
      imageUrl: input.photoUrl,
      prompt: buildConceptPrompt(input.concept),
    });
  } catch (e) {
    console.error('[ai/concept-generate] fal.ai error', e);
    const message =
      e instanceof Error && e.message.includes('FAL_KEY')
        ? 'AI 키 설정이 누락되었습니다. 관리자에게 문의해주세요.'
        : 'AI 이미지 생성에 실패했습니다. 잠시 후 다시 시도해주세요.';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // 5. fal.ai CDN 은 짧은 수명이라 우리 public-images 버킷에 다시 저장.
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
    console.error('[ai/concept-generate] storage upload error', e);
    return NextResponse.json(
      { error: '이미지 저장에 실패했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 },
    );
  }

  // 6. 사용량 기록 — INSERT ON CONFLICT(user_id) DO UPDATE.
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
    // 이미지는 이미 저장됐으므로 사용자에겐 결과를 돌려준다 — 로그만 남김.
    console.error('[ai/concept-generate] usage upsert error', usageErr);
  }

  return NextResponse.json({ url: publicUrl });
}

/**
 * GET /api/ai/concept-generate
 *
 * 클라이언트가 진입 시 잔여 사용 가능 여부 + 마지막 결과 이미지 URL 을 받아
 * UI 상태(생성 폼 vs 결과 표시) 를 분기하기 위해 사용.
 */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: usage } = await admin
    .from('ai_image_usage')
    .select('used_count, last_used_at, last_image_path')
    .eq('user_id', user.id)
    .maybeSingle();

  const used = !!usage && usage.used_count >= 1;
  const lastUrl =
    usage?.last_image_path
      ? admin.storage.from('public-images').getPublicUrl(usage.last_image_path).data.publicUrl
      : null;

  return NextResponse.json({ used, lastUrl, lastUsedAt: usage?.last_used_at ?? null });
}
