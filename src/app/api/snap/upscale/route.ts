import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runUpscale } from '@/lib/fal/client';

/**
 * POST /api/snap/upscale
 *
 * 사용자가 본인 결과 이미지를 인쇄/액자용 고해상도로 한 번에 키운다.
 * 비용은 약 $0.02 — MVP 단계에선 크레딧 차감하지 않고 무료 제공 (체감 가치 ↑,
 * 환불 / 입소문 개선). 추후 abuse 발생 시 1 크레딧 차감 옵션으로 전환 가능.
 *
 * 보안: source URL 은 우리 public-images 버킷의 wedding-snap/{user.id}/ 하위만
 * 허용. 임의 URL 을 업스케일 호스팅용으로 악용하는 걸 차단.
 */

const BodySchema = z.object({
  imageUrl: z.string().url(),
});

export const maxDuration = 60;

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

  // 1. 본인 결과만 업스케일 허용 — URL 에 사용자 ID 가 들어 있는지 검사.
  if (!input.imageUrl.includes(`wedding-snap/${user.id}/`)) {
    return NextResponse.json(
      { error: '본인의 스냅 결과만 업스케일할 수 있습니다.' },
      { status: 403 },
    );
  }

  // 2. fal 업스케일러 호출 (동기 모드, 5–15초).
  let upscaledUrl: string;
  try {
    upscaledUrl = await runUpscale({ imageUrl: input.imageUrl, upscaleFactor: 2 });
  } catch (e) {
    console.error('[snap/upscale] fal error', e);
    return NextResponse.json({ error: '고화질 변환에 실패했습니다.' }, { status: 502 });
  }

  // 3. 결과 재호스팅 — fal CDN 은 수명이 짧으므로 public-images 에 저장.
  try {
    const blob = await fetch(upscaledUrl).then((r) => {
      if (!r.ok) throw new Error(`fetch upscaled: ${r.status}`);
      return r.blob();
    });
    const path = `wedding-snap/${user.id}/upscaled-${Date.now()}.jpg`;
    const admin = createAdminClient();
    const { error: upErr } = await admin.storage
      .from('public-images')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (upErr) throw upErr;
    const publicUrl = admin.storage.from('public-images').getPublicUrl(path).data.publicUrl;
    return NextResponse.json({ url: publicUrl });
  } catch (e) {
    console.error('[snap/upscale] storage upload error', e);
    return NextResponse.json({ error: '업스케일 결과 저장에 실패했습니다.' }, { status: 500 });
  }
}
