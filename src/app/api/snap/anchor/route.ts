import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getImageEditResult } from '@/lib/fal/client';
import { markSnapJobCompleted } from '@/lib/snap/jobs';
import {
  uploadPrivate,
  SIGNED_URL_TTL_LONG,
} from '@/lib/snap/private-storage';

/**
 * /api/snap/anchor — solo anchor 아키텍처.
 *
 * GET    — 현재 사용자의 anchor 행 + 라이브러리 (과거 앵커들) + 무료 quota 잔량.
 *          {
 *            anchor, library, freeBatchesLeft, freeActivationAvailable,
 *            hasPurchased,    // 결제 이력 — 무료 batch 자격 결정
 *            welcomeGranted   // 가입 환영 크레딧 처음 받은 경우 true
 *          }
 *          ※ GET 진입 시 가입 환영 +1 크레딧 1회만 자동 적립 (idempotent RPC).
 * POST   — 선택한 groom anchor + bride anchor 의 fal requestId 를 받아 둘 다
 *          public-images 로 영구 호스팅 + snap_anchors 갱신.
 * DELETE — anchor 폐기 (history 로 복사 + snap_anchors 삭제).
 *
 * 무료 활성화 정책 (마이그 016 적용 후):
 *   * 앵커 무료 batch 는 "스냅 크레딧 결제 이력이 있는" 사용자에게만 제공.
 *   * 결제 사용자: free_full_batches_used < 1 → 최초 1회만 무료(개정).
 *   * 미결제 사용자: 무료 묶음 0회 (첫 묶음부터 4 크레딧 필요).
 *   * 가입 환영 크레딧 +1 은 별도 — 커플 카탈로그 1장 체험용.
 */

// 클라이언트가 한쪽만 선택한 경우 다른 쪽은 null 로 전송한다 (JSON.stringify 가
// undefined 를 dropping 하지 않도록). .nullish() 로 null 과 undefined 둘 다 허용.
const SaveSchema = z
  .object({
    groomRequestId: z.string().min(1).nullish(),
    brideRequestId: z.string().min(1).nullish(),
  })
  .refine((v) => !!v.groomRequestId || !!v.brideRequestId, {
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

  // 가입 환영 +1 크레딧 — 첫 진입 시에만 적립. RPC 자체가 idempotent (이미
  // welcome ledger 행이 있으면 추가 적립 X). 응답 본 흐름 차단하지 않게 try/catch.
  let welcomeGranted = false;
  try {
    const { data: welcome } = await admin.rpc('grant_welcome_snap_credit', {
      p_user_id: user.id,
    });
    const w = welcome as { granted?: boolean } | null;
    welcomeGranted = !!w?.granted;
  } catch (e) {
    console.warn('[snap/anchor GET] welcome grant failed (continuing)', e);
  }

  // 현재 anchor + 라이브러리 + 결제 이력 병렬 조회.
  // selfie URL 도 함께 가져와 라이브러리에서 picker 선택 시 catalog 단계에 같이 넘김.
  const [{ data: anchor }, { data: libraryRaw }, { data: purchasedRaw }] =
    await Promise.all([
      admin
        .from('snap_anchors')
        .select(
          'groom_anchor_url, bride_anchor_url, groom_selfie_url, bride_selfie_url, source_mode, groom_height_cm, groom_weight_kg, bride_height_cm, bride_weight_kg, last_batch_at, updated_at, free_full_batches_used',
        )
        .eq('user_id', user.id)
        .maybeSingle(),
      admin
        .from('snap_anchor_history')
        .select(
          'id, groom_anchor_url, bride_anchor_url, groom_selfie_url, bride_selfie_url, source_mode, groom_height_cm, groom_weight_kg, bride_height_cm, bride_weight_kg, anchor_created_at, discarded_at',
        )
        .eq('user_id', user.id)
        .order('discarded_at', { ascending: false })
        .limit(50),
      admin.rpc('has_purchased_snap', { p_user_id: user.id }),
    ]);

  const hasPurchased = !!purchasedRaw;

  // 라이브러리는 슬롯 단위로 분리해서 노출. 한 history row 가 양쪽 slot 모두
  // 채워져 있으면 groomLibrary / brideLibrary 양쪽에 동시에 (같은 row id 로) 노출.
  // 사용자가 신랑은 row A, 신부는 row B 로 따로 골라 조합할 수 있게 함.
  const rawHistory = libraryRaw ?? [];
  const groomLibrary = rawHistory
    .filter((e) => !!e.groom_anchor_url)
    .map((e) => ({
      id: e.id as string,
      anchorUrl: e.groom_anchor_url as string,
      selfieUrl: (e.groom_selfie_url as string | null) ?? null,
      heightCm: (e.groom_height_cm as number | null) ?? null,
      weightKg: (e.groom_weight_kg as number | null) ?? null,
      sourceMode: e.source_mode as string,
      anchorCreatedAt: e.anchor_created_at as string | null,
      discardedAt: e.discarded_at as string,
    }));
  const brideLibrary = rawHistory
    .filter((e) => !!e.bride_anchor_url)
    .map((e) => ({
      id: e.id as string,
      anchorUrl: e.bride_anchor_url as string,
      selfieUrl: (e.bride_selfie_url as string | null) ?? null,
      heightCm: (e.bride_height_cm as number | null) ?? null,
      weightKg: (e.bride_weight_kg as number | null) ?? null,
      sourceMode: e.source_mode as string,
      anchorCreatedAt: e.anchor_created_at as string | null,
      discardedAt: e.discarded_at as string,
    }));

  // 무료 앵커 묶음: 결제 사용자에게 "최초 1회" 만 제공 — 정책 개정(2→1).
  // 미결제면 잔량 0.
  const freeUsed = anchor?.free_full_batches_used ?? 0;
  const freeBatchesLeft = hasPurchased ? Math.max(0, 1 - freeUsed) : 0;
  const freeActivationAvailable = freeBatchesLeft > 0;

  return NextResponse.json(
    {
      anchor: anchor ?? null,
      groomLibrary,
      brideLibrary,
      freeBatchesLeft,
      freeActivationAvailable,
      hasPurchased,
      welcomeGranted,
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
      // 앵커는 사용자 얼굴 정체성 reference — private-uploads 에 저장하고 long TTL
      // signed URL (1년) 로 노출. 만료 시 별도 갱신 흐름 필요 (TODO).
      const { signedUrl } = await uploadPrivate(
        path,
        Buffer.from(await blob.arrayBuffer()),
        'image/jpeg',
        SIGNED_URL_TTL_LONG,
      );
      // snap_jobs 의 해당 row 를 completed 로 마크.
      void markSnapJobCompleted(requestId, signedUrl);
      return { url: signedUrl };
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
  //    history archive 를 위해 selfie / 신체 메타까지 함께 fetch.
  const { data: existing, error: fetchErr } = await admin
    .from('snap_anchors')
    .select(
      'source_mode, last_batch_at, groom_anchor_url, bride_anchor_url, groom_selfie_url, bride_selfie_url, groom_height_cm, groom_weight_kg, bride_height_cm, bride_weight_kg, created_at',
    )
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

  // 2-a. Auto-archive: 기존 앵커가 양쪽 slot 모두 채워진 "완전 앵커" 였고,
  //      적어도 한쪽이 새 URL 로 바뀌는 경우 history 에 사본 보존.
  //      → 라이브러리에서 과거 앵커 선택 가능 (DELETE 폐기 흐름 없이도 자연스럽게
  //        쌓임). history 보존 실패는 본 흐름 차단 X (로그만).
  if (
    existing?.groom_anchor_url &&
    existing?.bride_anchor_url &&
    ((groomUrl !== null && groomUrl !== existing.groom_anchor_url) ||
      (brideUrl !== null && brideUrl !== existing.bride_anchor_url))
  ) {
    const { error: histErr } = await admin.from('snap_anchor_history').insert({
      user_id: user.id,
      groom_anchor_url: existing.groom_anchor_url,
      bride_anchor_url: existing.bride_anchor_url,
      groom_selfie_url: existing.groom_selfie_url,
      bride_selfie_url: existing.bride_selfie_url,
      source_mode: existing.source_mode,
      groom_height_cm: existing.groom_height_cm,
      groom_weight_kg: existing.groom_weight_kg,
      bride_height_cm: existing.bride_height_cm,
      bride_weight_kg: existing.bride_weight_kg,
      anchor_created_at: existing.created_at,
    });
    if (histErr) {
      console.warn('[snap/anchor save] auto-archive failed (continuing)', histErr);
    }
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
      'groom_anchor_url, bride_anchor_url, groom_selfie_url, bride_selfie_url, source_mode, groom_height_cm, groom_weight_kg, bride_height_cm, bride_weight_kg, created_at',
    )
    .eq('user_id', user.id)
    .maybeSingle();

  // 2. 행이 있고 적어도 한쪽 URL 이 set 이면 history 에 보존. 둘 다 NULL 이면
  //    아직 저장 안 된 상태(batch 만 만든 row) 라 history 가치 없음.
  //    selfie URL 도 함께 보존 — 라이브러리에서 picker 선택 시 face identity reference 활용.
  if (current && (current.groom_anchor_url || current.bride_anchor_url)) {
    const { error: histErr } = await admin.from('snap_anchor_history').insert({
      user_id: user.id,
      groom_anchor_url: current.groom_anchor_url,
      bride_anchor_url: current.bride_anchor_url,
      groom_selfie_url: current.groom_selfie_url,
      bride_selfie_url: current.bride_selfie_url,
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
