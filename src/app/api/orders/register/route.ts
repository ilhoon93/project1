import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkAdmin } from '@/lib/auth/admin';
import {
  isCommerceApiConfigured,
  resolveProductOrder,
} from '@/lib/naver/smartstore';

const BodySchema = z.object({
  productOrderNo: z
    .string()
    .min(4, '주문번호를 입력해주세요')
    .max(40)
    .regex(/^[A-Za-z0-9-]+$/, '숫자/영문/하이픈만 입력 가능합니다'),
  // 본인확인용 주문자 휴대폰 뒷 4자리. 네이버가 연락처를 마스킹 없이 줄 때 대조.
  ordererTel4: z
    .string()
    .regex(/^\d{4}$/, '주문자 휴대폰 번호 뒷 4자리를 입력해주세요'),
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

  // 1) 옵션 단위 적립은 커머스 API 로 상품/옵션을 식별해야만 가능.
  //    입력값이 주문번호일 수도 상품주문번호일 수도 있어 API 조회로만 확정된다.
  if (!isCommerceApiConfigured()) {
    return NextResponse.json(
      {
        error:
          '네이버 스토어 연동이 아직 준비되지 않았습니다. 잠시 후 다시 시도하거나 고객센터로 문의해주세요.',
      },
      { status: 503 },
    );
  }

  // 2) 입력값(상품주문번호 또는 주문번호)을 해석해 상품주문 상세 조회.
  let parsed;
  let raw: unknown = {};
  try {
    const result = await resolveProductOrder(body.productOrderNo);
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
      {
        error:
          '주문을 찾지 못했습니다. 입력하신 번호(주문번호 또는 상품주문번호)가 맞는지, 결제가 완료되었는지 확인해주세요.',
      },
      { status: 404 },
    );
  }
  if (!parsed.productId) {
    return NextResponse.json(
      { error: '주문에서 상품번호를 확인하지 못했습니다. 고객센터로 문의해주세요.' },
      { status: 502 },
    );
  }

  // 본인확인 — 주문자 연락처 뒷 4자리 대조로 타인 주문 선점(탈취)을 차단.
  // 네이버가 연락처를 마스킹 없이 내려줄 때만 검증 가능하므로:
  //   - 사용 가능(숫자 4자리 이상 & '*' 없음) → 뒷 4자리 불일치면 403.
  //   - 마스킹/누락 등 검증 불가 → 막지 않고 통과(기존 등록 흐름 보존) + 경고 로그.
  const apiTel = parsed.ordererTel ?? '';
  const apiDigits = apiTel.replace(/\D/g, '');
  const apiTelUsable = !apiTel.includes('*') && apiDigits.length >= 4;
  if (apiTelUsable) {
    if (apiDigits.slice(-4) !== body.ordererTel4) {
      return NextResponse.json(
        {
          error:
            '주문자 휴대폰 번호 뒷 4자리가 일치하지 않습니다. 본인 주문이 맞는지 확인해주세요.',
        },
        { status: 403 },
      );
    }
  } else {
    console.warn('[orders/register] ordererTel not usable for verification', {
      productOrderNo: parsed.productOrderId,
      masked: apiTel.includes('*'),
      digitLen: apiDigits.length,
    });
  }

  // 해석된 상품주문번호 — 멱등 키이자 grant 의 기준값.
  const productOrderNo = parsed.productOrderId;

  // 3) 멱등성 사전 검사 — 해석된 상품주문번호 기준.
  const { data: existing } = await admin
    .from('purchase_orders')
    .select('id')
    .eq('naver_product_order_no', productOrderNo)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: '이미 등록된 주문입니다.', orderId: existing.id },
      { status: 409 },
    );
  }

  // 4) 옵션 매핑대로 다중 크레딧 적립.
  //    커머스 API 가 "옵션번호"(판매자센터 옵션번호)를 어느 필드에 담는지 환경/버전
  //    마다 달라(optionCode 가 비거나 조합 ID 일 수 있음), 여러 후보 코드로 순차
  //    매칭한다. grant RPC 는 매핑 실패 시 부수효과 없이 'option_not_mapped' 만
  //    돌려주므로 후보를 여러 번 시도해도 안전(중복 적립 없음).
  const candidateCodes = Array.from(
    new Set(
      [parsed.optionCode, parsed.optionManageCode, '']
        .filter((v): v is string => v !== undefined && v !== null),
    ),
  );

  let grantResult: unknown = null;
  let mapped = false;
  for (const code of candidateCodes) {
    const { data, error: grantErr } = await admin.rpc('grant_smartstore_order', {
      p_user_id: user.id,
      p_product_no: parsed.productId,
      p_option_code: code,
      p_amount: parsed.totalPaymentAmount ?? 0,
      p_naver_order_no: parsed.orderId ?? null,
      p_naver_product_order_no: productOrderNo,
      p_raw: raw as never,
    });
    if (grantErr) {
      console.error('[orders/register] grant_smartstore_order failed', grantErr);
      return NextResponse.json({ error: grantErr.message }, { status: 500 });
    }
    const r = data as { error?: string } | null;
    if (r?.error === 'option_not_mapped') continue; // 다음 후보 시도
    grantResult = data;
    mapped = true;
    break;
  }

  if (!mapped) {
    // 진단용 — 실제로 커머스 API 가 내려준 옵션 식별자를 모두 남긴다.
    const diag = {
      productId: parsed.productId,
      optionCode: parsed.optionCode ?? null,
      optionManageCode: parsed.optionManageCode ?? null,
      productOption: parsed.productOption ?? null,
      productName: parsed.productName ?? null,
      candidates: candidateCodes,
    };
    console.error('[orders/register] option not mapped (all candidates)', diag);

    // 관리자(본인 테스트)에게는 어떤 값으로 시드해야 하는지 바로 보이도록 진단을 붙인다.
    const isAdmin = !!(await checkAdmin());
    const base =
      '등록되지 않은 상품 옵션입니다. 고객센터로 문의해주시면 적립해 드리겠습니다.';
    return NextResponse.json(
      {
        error: isAdmin
          ? `${base}\n[진단] 상품번호=${diag.productId ?? '-'} · optionCode=${diag.optionCode ?? '(없음)'} · optionManageCode=${diag.optionManageCode ?? '(없음)'} · 옵션표시="${diag.productOption ?? '-'}"`
          : base,
        ...(isAdmin ? { diagnostic: diag } : {}),
      },
      { status: 422 },
    );
  }

  return NextResponse.json({ success: true, result: grantResult });
}
