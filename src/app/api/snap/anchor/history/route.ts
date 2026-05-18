import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * /api/snap/anchor/history
 *
 * GET    — 라이브러리(과거 앵커) 목록 반환. 최신 archive 순.
 * DELETE — 슬롯 단위 영구 삭제. query `?id=<historyId>&slot=groom|bride`.
 *          - 그 slot 의 anchor/selfie/height/weight 컬럼을 NULL 처리.
 *          - 양쪽 slot 이 모두 NULL 이 되면 row 자체를 삭제 (DELETE).
 *          - slot 미지정 / 알 수 없는 값 → 400.
 *
 * 라이브러리는 POST /api/snap/anchor 시 기존 완전 앵커를 자동 archive 한 결과.
 * 사용자가 신랑 / 신부 각자 별도로 폐기할 수 있도록 slot 단위로 동작.
 */

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
  const { data, error } = await admin
    .from('snap_anchor_history')
    .select(
      'id, groom_anchor_url, bride_anchor_url, source_mode, groom_height_cm, groom_weight_kg, bride_height_cm, bride_weight_kg, anchor_created_at, discarded_at',
    )
    .eq('user_id', user.id)
    .order('discarded_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[snap/anchor/history] fetch error', error);
    return NextResponse.json(
      { error: '폐기 앵커 조회 실패', detail: error.message },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }

  return NextResponse.json({ entries: data ?? [] }, { headers: NO_STORE_HEADERS });
}

export async function DELETE(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE_HEADERS });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const slot = url.searchParams.get('slot');
  if (!id) {
    return NextResponse.json(
      { error: 'id query param is required' },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }
  if (slot !== 'groom' && slot !== 'bride') {
    return NextResponse.json(
      { error: "slot query param must be 'groom' or 'bride'" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const admin = createAdminClient();
  // 현재 상태 확인 — 다른쪽 slot 이 NULL 이면 row 자체 삭제 (양쪽 NULL row 보존 X).
  const { data: row, error: fetchErr } = await admin
    .from('snap_anchor_history')
    .select('id, groom_anchor_url, bride_anchor_url')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (fetchErr) {
    console.error('[snap/anchor/history DELETE] fetch error', fetchErr);
    return NextResponse.json(
      { error: '라이브러리 조회 실패', detail: fetchErr.message },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
  if (!row) {
    return NextResponse.json(
      { error: '해당 항목을 찾을 수 없습니다.' },
      { status: 404, headers: NO_STORE_HEADERS },
    );
  }

  // 이 slot 이 이미 NULL 이면 아무것도 안 함 (idempotent).
  const targetUrlCol = slot === 'groom' ? row.groom_anchor_url : row.bride_anchor_url;
  if (!targetUrlCol) {
    return NextResponse.json(
      { ok: true, alreadyEmpty: true },
      { headers: NO_STORE_HEADERS },
    );
  }

  // 다른 slot 도 NULL 이거나, 이 작업으로 양쪽 NULL 이 되면 row 자체 삭제.
  const otherUrlCol = slot === 'groom' ? row.bride_anchor_url : row.groom_anchor_url;
  if (!otherUrlCol) {
    // 다른쪽 slot 이 이미 NULL → row 통째로 삭제.
    const { error: delErr } = await admin
      .from('snap_anchor_history')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (delErr) {
      console.error('[snap/anchor/history DELETE] row delete error', delErr);
      return NextResponse.json(
        { error: '라이브러리 삭제 실패', detail: delErr.message },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }
    return NextResponse.json({ ok: true, rowDeleted: true }, { headers: NO_STORE_HEADERS });
  }

  // 한쪽 slot 만 NULL 처리. 그 slot 의 anchor/selfie/height/weight 모두 함께.
  const update: Record<string, null> =
    slot === 'groom'
      ? {
          groom_anchor_url: null,
          groom_selfie_url: null,
          groom_height_cm: null,
          groom_weight_kg: null,
        }
      : {
          bride_anchor_url: null,
          bride_selfie_url: null,
          bride_height_cm: null,
          bride_weight_kg: null,
        };
  const { error: updErr } = await admin
    .from('snap_anchor_history')
    .update(update as never)
    .eq('id', id)
    .eq('user_id', user.id);
  if (updErr) {
    console.error('[snap/anchor/history DELETE] slot null error', updErr);
    return NextResponse.json(
      { error: '라이브러리 slot 비우기 실패', detail: updErr.message },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
  return NextResponse.json({ ok: true, slotCleared: slot }, { headers: NO_STORE_HEADERS });
}
