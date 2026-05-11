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

// 사용자별로 자주 바뀌고 캐시되면 안 되는 응답 — 브라우저/CDN 모두 캐시 금지.
const NO_STORE_HEADERS = {
  'cache-control': 'no-store, no-cache, must-revalidate',
} as const;

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE_HEADERS });

  const admin = createAdminClient();
  const { data } = await admin
    .from('snap_anchors')
    .select(
      'image_url, source_mode, groom_height_cm, groom_weight_kg, bride_height_cm, bride_weight_kg, last_batch_at, updated_at',
    )
    .eq('user_id', user.id)
    .maybeSingle();

  return NextResponse.json(
    {
      anchor: data ?? null,
      // 무료 활성화 quota — 행 자체가 없을 때만 사용 가능.
      freeActivationAvailable: !data,
    },
    { headers: NO_STORE_HEADERS },
  );
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

  // 3. snap_anchors 갱신 — single-path upsert.
  //    행이 있으면 source_mode / last_batch_at 은 generate 시점 값을 보존,
  //    없으면 (직접 POST 등 예외 케이스) selfies + now 로 기본값.
  const admin = createAdminClient();
  const { data: existing, error: fetchErr } = await admin
    .from('snap_anchors')
    .select('source_mode, last_batch_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (fetchErr) {
    console.error('[snap/anchor save] fetch existing error', fetchErr);
    return NextResponse.json(
      {
        error: '앵커 메타 조회에 실패했습니다.',
        detail: fetchErr.message,
        code: fetchErr.code ?? null,
      },
      { status: 500 },
    );
  }

  const upsertPayload = {
    user_id: user.id,
    image_url: publicUrl,
    source_mode: existing?.source_mode ?? ('selfies' as const),
    last_batch_at: existing?.last_batch_at ?? new Date().toISOString(),
  };

  const { error: upsertErr } = await admin
    .from('snap_anchors')
    .upsert(upsertPayload, { onConflict: 'user_id' });

  if (upsertErr) {
    console.error('[snap/anchor save] upsert error', upsertErr, { payload: upsertPayload });
    // 실제 원인을 클라이언트에 노출 — 마이그레이션 미적용 / RLS / 스키마 문제 등을
    // 운영에서 빠르게 찾기 위함. 민감 정보 없음 (PG 에러 메시지 + 코드).
    return NextResponse.json(
      {
        error: '앵커 메타 저장에 실패했습니다.',
        detail: upsertErr.message,
        code: upsertErr.code ?? null,
        hint: upsertErr.hint ?? null,
      },
      { status: 500 },
    );
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
