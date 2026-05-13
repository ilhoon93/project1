import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getImageEditResult } from '@/lib/fal/client';
import { markSnapJobCompleted } from '@/lib/snap/jobs';

/**
 * /api/snap/anchor — solo anchor 아키텍처.
 *
 * GET    — 현재 사용자의 anchor 행 + 무료 활성화 quota 여부.
 *          { groom_anchor_url, bride_anchor_url, source_mode, body 가이드, ... }
 * POST   — 선택한 groom anchor + bride anchor 의 fal requestId 를 받아 둘 다
 *          public-images 로 영구 호스팅 + snap_anchors 갱신. 한쪽만 보내도
 *          허용 (점진 선택). 마지막에 두 URL 모두 채워지면 selection 완료.
 * DELETE — anchor 폐기 (다음 batch 는 4 크레딧).
 *
 * 무료 활성화 정책:
 *   * snap_anchors 행이 없음           = 무료 가능
 *   * 행은 있는데 last_batch_at NULL   = 마이그 13 이후 quota 리셋된 상태 (무료 가능)
 *   * 행 + last_batch_at 채워짐        = 이미 batch 만든 적 있음 → 재생성은 유료
 */

const SaveSchema = z
  .object({
    groomRequestId: z.string().min(1).optional(),
    brideRequestId: z.string().min(1).optional(),
  })
  .refine((v) => v.groomRequestId || v.brideRequestId, {
    message: 'At least one of groomRequestId or brideRequestId is required',
  });

export const maxDuration = 30;

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
      'groom_anchor_url, bride_anchor_url, source_mode, groom_height_cm, groom_weight_kg, bride_height_cm, bride_weight_kg, last_batch_at, updated_at',
    )
    .eq('user_id', user.id)
    .maybeSingle();

  // 무료 활성화: 행이 없거나 last_batch_at 이 NULL (legacy reset).
  const freeActivationAvailable = !data || data.last_batch_at === null;

  return NextResponse.json(
    {
      anchor: data ?? null,
      freeActivationAvailable,
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

  const admin = createAdminClient();

  // 1. 선택된 requestId 각각에 대해: fal 결과 → public-images 업로드 → 우리 URL.
  const persistOne = async (
    slot: 'groom' | 'bride',
    requestId: string,
  ): Promise<{ url: string } | { error: NextResponse }> => {
    let generatedUrl: string;
    try {
      generatedUrl = await getImageEditResult(requestId);
    } catch (e) {
      console.error(`[snap/anchor save] ${slot} fal result error`, e);
      return {
        error: NextResponse.json(
          { error: `선택한 ${slot === 'groom' ? '신랑' : '신부'} 앵커 결과를 가져오지 못했습니다.` },
          { status: 502 },
        ),
      };
    }
    try {
      const blob = await fetch(generatedUrl).then((r) => {
        if (!r.ok) throw new Error(`fetch anchor: ${r.status}`);
        return r.blob();
      });
      const path = `wedding-snap/${user.id}/anchor-${slot}-${Date.now()}.jpg`;
      const { error: upErr } = await admin.storage
        .from('public-images')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
      if (upErr) throw upErr;
      const publicUrl = admin.storage.from('public-images').getPublicUrl(path).data.publicUrl;
      // snap_jobs 의 해당 row 를 completed 로 마크.
      void markSnapJobCompleted(requestId, publicUrl);
      return { url: publicUrl };
    } catch (e) {
      console.error(`[snap/anchor save] ${slot} storage upload error`, e);
      return {
        error: NextResponse.json(
          { error: `${slot === 'groom' ? '신랑' : '신부'} 앵커 저장에 실패했습니다.` },
          { status: 500 },
        ),
      };
    }
  };

  let groomUrl: string | null = null;
  let brideUrl: string | null = null;

  if (input.groomRequestId) {
    const r = await persistOne('groom', input.groomRequestId);
    if ('error' in r) return r.error;
    groomUrl = r.url;
  }
  if (input.brideRequestId) {
    const r = await persistOne('bride', input.brideRequestId);
    if ('error' in r) return r.error;
    brideUrl = r.url;
  }

  // 2. snap_anchors 갱신 — single-path upsert.
  //    기존 행이 있으면 source_mode / last_batch_at / 다른 slot URL 은 보존.
  const { data: existing, error: fetchErr } = await admin
    .from('snap_anchors')
    .select('source_mode, last_batch_at, groom_anchor_url, bride_anchor_url')
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
    groom_anchor_url: groomUrl ?? existing?.groom_anchor_url ?? null,
    bride_anchor_url: brideUrl ?? existing?.bride_anchor_url ?? null,
    source_mode: existing?.source_mode ?? ('selfies' as const),
    last_batch_at: existing?.last_batch_at ?? new Date().toISOString(),
  };

  const { error: upsertErr } = await admin
    .from('snap_anchors')
    .upsert(upsertPayload, { onConflict: 'user_id' });

  if (upsertErr) {
    console.error('[snap/anchor save] upsert error', upsertErr, { payload: upsertPayload });
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

  return NextResponse.json({
    groomAnchorUrl: upsertPayload.groom_anchor_url,
    brideAnchorUrl: upsertPayload.bride_anchor_url,
    bothSet: !!upsertPayload.groom_anchor_url && !!upsertPayload.bride_anchor_url,
  });
}

export async function DELETE() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  // 1. 현재 snap_anchors 행 읽기 (있으면 history 로 복사하기 위함).
  const { data: current } = await admin
    .from('snap_anchors')
    .select(
      'groom_anchor_url, bride_anchor_url, source_mode, groom_height_cm, groom_weight_kg, bride_height_cm, bride_weight_kg, created_at',
    )
    .eq('user_id', user.id)
    .maybeSingle();

  // 2. 행이 있고 적어도 한쪽 URL 이 set 이면 history 에 보존. 둘 다 NULL 이면
  //    아직 저장 안 된 상태(batch 만 만든 row) 라 history 가치 없음.
  if (current && (current.groom_anchor_url || current.bride_anchor_url)) {
    const { error: histErr } = await admin.from('snap_anchor_history').insert({
      user_id: user.id,
      groom_anchor_url: current.groom_anchor_url,
      bride_anchor_url: current.bride_anchor_url,
      source_mode: current.source_mode,
      groom_height_cm: current.groom_height_cm,
      groom_weight_kg: current.groom_weight_kg,
      bride_height_cm: current.bride_height_cm,
      bride_weight_kg: current.bride_weight_kg,
      anchor_created_at: current.created_at,
    });
    if (histErr) {
      // 히스토리 보존 실패는 본 흐름 차단 X (로그만) — 사용자 명령은 폐기.
      console.warn('[snap/anchor delete] history insert failed', histErr);
    }
  }

  // 3. snap_anchors 행 삭제.
  const { error } = await admin.from('snap_anchors').delete().eq('user_id', user.id);
  if (error) {
    console.error('[snap/anchor delete] error', error);
    return NextResponse.json({ error: '앵커 삭제에 실패했습니다.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
