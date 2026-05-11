import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getImageEditResult } from '@/lib/fal/client';

/**
 * /api/snap/anchor
 *
 * GET  — 현재 사용자의 앵커 (없으면 null) 와 활성화 상태 반환.
 * POST — 선택한 앵커 후보(requestId)를 영구 저장. fal CDN URL 을 우리
 *        public-images 버킷으로 옮기고 snap_anchors.image_url 을 갱신.
 * DELETE — 앵커 폐기 (다음 생성은 다시 유료 재생성 요금 — 정책 일관).
 *
 * 무료 활성화 정책: snap_anchors 행이 존재하지 않으면 첫 batch 가 무료. 즉
 *   * "행 없음"      = 무료 활성화 가능
 *   * "행 있음·NULL" = batch 만 만들고 아직 선택 안 함 (무료 quota 소비)
 *   * "행 있음·set"  = 선택 완료 상태
 */

const SaveSchema = z.object({
  requestId: z.string().min(1),
});

export const maxDuration = 30;

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data } = await admin
    .from('snap_anchors')
    .select(
      'image_url, source_mode, groom_height_cm, groom_weight_kg, bride_height_cm, bride_weight_kg, last_batch_at, updated_at',
    )
    .eq('user_id', user.id)
    .maybeSingle();

  return NextResponse.json({
    anchor: data ?? null,
    // 무료 활성화 quota — 행 자체가 없을 때만 사용 가능.
    freeActivationAvailable: !data,
  });
}

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let input;
  try {
    input = SaveSchema.parse(await req.json());
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: e.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // 1. fal 결과 URL 가져오기.
  let generatedUrl: string;
  try {
    generatedUrl = await getImageEditResult(input.requestId);
  } catch (e) {
    console.error('[snap/anchor save] fal.queue.result error', e);
    return NextResponse.json({ error: '선택한 앵커 결과를 가져오지 못했습니다.' }, { status: 502 });
  }

  // 2. 우리 public-images 버킷에 영구 호스팅.
  let publicUrl: string;
  try {
    const blob = await fetch(generatedUrl).then((r) => {
      if (!r.ok) throw new Error(`fetch anchor: ${r.status}`);
      return r.blob();
    });
    const path = `wedding-snap/${user.id}/anchor-${Date.now()}.jpg`;
    const admin = createAdminClient();
    const { error: upErr } = await admin.storage
      .from('public-images')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (upErr) throw upErr;
    publicUrl = admin.storage.from('public-images').getPublicUrl(path).data.publicUrl;
  } catch (e) {
    console.error('[snap/anchor save] storage upload error', e);
    return NextResponse.json({ error: '앵커 저장에 실패했습니다.' }, { status: 500 });
  }

  // 3. snap_anchors 갱신. row 가 이미 generate 단계에서 upsert 됐다고 기대하지만,
  //    혹시 없으면 (예: 직접 POST) 안전하게 upsert.
  const admin = createAdminClient();
  const { error: upErr } = await admin
    .from('snap_anchors')
    .update({ image_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('user_id', user.id);
  if (upErr) {
    // generate 를 거치지 않은 직접 호출 케이스 — 행이 없다. source_mode 정보가
    // 없으므로 selfies 로 가정.
    console.warn('[snap/anchor save] update miss, falling back to upsert', upErr);
    const { error: fallbackErr } = await admin.from('snap_anchors').upsert(
      {
        user_id: user.id,
        image_url: publicUrl,
        source_mode: 'selfies',
        last_batch_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    if (fallbackErr) {
      console.error('[snap/anchor save] upsert fallback error', fallbackErr);
      return NextResponse.json({ error: '앵커 메타 저장에 실패했습니다.' }, { status: 500 });
    }
  }

  return NextResponse.json({ url: publicUrl });
}

export async function DELETE() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin.from('snap_anchors').delete().eq('user_id', user.id);
  if (error) {
    console.error('[snap/anchor delete] error', error);
    return NextResponse.json({ error: '앵커 삭제에 실패했습니다.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
