import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { editImage } from '@/lib/fal/client';
import { FREE_TEMPLATES, isTemplateKey } from '@/lib/fal/prompts';
import { InvitationContentSchema } from '@/types/invitation';

const BodySchema = z.object({
  invitationId: z.string().uuid(),
  photoUrl: z.string().url(),
  template: z.string().refine(isTemplateKey, { message: 'Unknown template' }),
});

export const maxDuration = 60; // fal.ai edits typically finish well within 30s

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

  // 3. Ownership + free-quota check
  const { data: inv, error: invError } = await supabase
    .from('invitations')
    .select('id, content, is_published')
    .eq('id', input.invitationId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (invError) return NextResponse.json({ error: invError.message }, { status: 500 });
  if (!inv) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (inv.is_published) {
    return NextResponse.json({ error: '발행된 알림장은 수정할 수 없습니다' }, { status: 403 });
  }

  const currentContent = InvitationContentSchema.parse(inv.content ?? {});
  if (currentContent.main.heroImage) {
    return NextResponse.json(
      { error: '무료 미리보기는 1회만 사용 가능합니다. 추가 이미지는 결제 후 이용해주세요.' },
      { status: 403 },
    );
  }

  // 4. Generate via fal.ai
  let generatedUrl: string;
  try {
    generatedUrl = await editImage({
      imageUrl: input.photoUrl,
      prompt: FREE_TEMPLATES[input.template].prompt,
    });
  } catch (e) {
    console.error('[ai/free-preview] fal.ai error', e);
    return NextResponse.json(
      { error: 'AI 이미지 생성에 실패했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 502 },
    );
  }

  // 5. Re-host the image in our Storage (fal CDN URLs are short-lived)
  let publicUrl: string;
  try {
    const blob = await fetch(generatedUrl).then((r) => {
      if (!r.ok) throw new Error(`fetch generated image: ${r.status}`);
      return r.blob();
    });
    const path = `invitations/${inv.id}/hero-${Date.now()}.jpg`;
    const admin = createAdminClient();
    const { error: upErr } = await admin.storage
      .from('public-images')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (upErr) throw upErr;
    publicUrl = admin.storage.from('public-images').getPublicUrl(path).data.publicUrl;
  } catch (e) {
    console.error('[ai/free-preview] storage upload error', e);
    return NextResponse.json(
      { error: '이미지 저장에 실패했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 },
    );
  }

  // 6. Persist to content.main.heroImage (merge)
  const nextContent = {
    ...currentContent,
    main: { ...currentContent.main, heroImage: publicUrl },
  };
  const { error: upErr } = await supabase
    .from('invitations')
    .update({ content: nextContent })
    .eq('id', inv.id)
    .eq('user_id', user.id);
  if (upErr) {
    console.error('[ai/free-preview] update content error', upErr);
    // Image is already uploaded — frontend can still use the URL.
    // Return success but note the warning.
  }

  return NextResponse.json({ url: publicUrl });
}
