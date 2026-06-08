import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  isCommerceApiConfigured,
  lookupProductOrder,
} from '@/lib/naver/smartstore';

const BodySchema = z.object({
  productOrderNo: z
    .string()
    .min(4, '상품주문번호를 입력해주세요')
    .max(40)
    .regex(/^[A-Za-z0-9-]+$/, '숫자/영문/하이픈만 입력 가능합니다'),
});

/**
 * POST /api/orders/register
 *
 * 스마트스토어 상품주문번호 수동 등록 → 옵션 매핑대로 크레딧 적립.
 *
 * 흐름:
 *   1. 상품주문번호 중복 사전 검사 (멱등성 1차).
 *   2. 커머스 API 로 상품주문 상세 조회 → productId(상품번호) + optionCode(옵션).
 *   3. grant_smartstore_order(상품번호, 옵션코드) 로 다중 크레딧 적립.
 *      매핑(naver_option_grants)이 없으면 422 로 안내.
 *
 * 적립량은 옵션마다 다르고(번들 포함) DB 의 naver_option_grants 가 단일
 * source of truth 다. 상품에 옵션이 없으면 optionCode 가 비므로 '' 로 매칭한다.
 *
 * 보안 메모: 커머스 API 는 셀러 기준이라 주문번호만 알면 누구나 조회된다.
 * 상품주문번호당 멱등(중복 적립 불가)이라 같은 주문을 두 번 타먹을 순 없지만,
 * 타인의 주문번호를 먼저 등록하는 선점 위험은 남는다. 주문번호가 길고
 * 추측이 어렵다는 점에 기대 1차 출시에선 별도 본인확인을 강제하지 않는다.
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try {
    body = BodySchema.parse(await req.json());
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', issues: e.issues },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const admin = createAdminClient();

  // 1) 멱등성 사전 검사 — purchase_orders.naver_product_order_no 유니크.
  const { data: existing } = await admin
    .from('purchase_orders')
    .select('id')
    .eq('naver_product_order_no', body.productOrderNo)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: '이미 등록된 주문번호입니다.', orderId: existing.id },
      { status: 409 },
    );
  }

  // 2) 옵션 단위 적립은 커머스 API 로 상품/옵션을 식별해야만 가능.
  if (!isCommerceApiConfigured()) {
    return NextResponse.json(
      {
        error:
          '네이버 스토어 연동이 아직 준비되지 않았습니다. 잠시 후 다시 시도하거나 고객센터로 문의해주세요.',
      },
      { status: 503 },
    );
  }

  let parsed;
  let raw: unknown = {};
  try {
    const result = await lookupProductOrder(body.productOrderNo);
    parsed = result.parsed;
    raw = result.raw;
  } catch (e) {
    console.error('[orders/register] commerce api error', e);
    return NextResponse.json(
      { error: '네이버 주문 조회에 실패했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 502 },
    );
  }

  if (!parsed) {
    return NextResponse.json(
      { error: '주문번호를 찾을 수 없습니다. 결제 완료 후 다시 시도해주세요.' },
      { status: 404 },
    );
  }
  if (!parsed.productId) {
    return NextResponse.json(
      { error: '주문에서 상품번호를 확인하지 못했습니다. 고객센터로 문의해주세요.' },
      { status: 502 },
    );
  }

  // 옵션 없는 상품은 optionCode 가 비어있을 수 있어 '' 로 매칭한다.
  const optionCode = parsed.optionCode ?? parsed.optionManageCode ?? '';

  // 3) 옵션 매핑대로 다중 크레딧 적립.
  const { data: grantResult, error: grantErr } = await admin.rpc(
    'grant_smartstore_order',
    {
      p_user_id: user.id,
      p_product_no: parsed.productId,
      p_option_code: optionCode,
      p_amount: parsed.totalPaymentAmount ?? 0,
      p_naver_order_no: parsed.orderId ?? null,
      p_naver_product_order_no: body.productOrderNo,
      p_raw: raw as never,
    },
  );

  if (grantErr) {
    console.error('[orders/register] grant_smartstore_order failed', grantErr);
    return NextResponse.json({ error: grantErr.message }, { status: 500 });
  }

  const result = grantResult as {
    error?: string;
    product_no?: string;
    option_code?: string;
  } | null;

  if (result?.error === 'option_not_mapped') {
    console.error('[orders/register] option not mapped', {
      product_no: result.product_no,
      option_code: result.option_code,
    });
    return NextResponse.json(
      {
        error:
          '등록되지 않은 상품 옵션입니다. 고객센터로 문의해주시면 적립해 드리겠습니다.',
      },
      { status: 422 },
    );
  }

  return NextResponse.json({ success: true, result: grantResult });
}
