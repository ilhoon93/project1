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
 * Manual smart-store order registration. The user enters their
 * 상품주문번호; we either validate it against the Naver Commerce API
 * (if credentials are configured) or accept it on trust as a manual
 * record. In both cases credit grant is idempotent on the
 * (source, naver_product_order_no) pair, so a user can't double-claim.
 *
 * The granted credits come from the addon_packages catalogue, matched
 * by naver_smartstore_product_no when the API returns a productId,
 * else falling back to the 'basic' package.
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

  // Idempotency: pre-check on the unique index in purchase_orders
  const { data: existing } = await admin
    .from('purchase_orders')
    .select('id, granted_credits')
    .eq('naver_product_order_no', body.productOrderNo)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: '이미 등록된 주문번호입니다.', orderId: existing.id },
      { status: 409 },
    );
  }

  // Optionally validate against Naver Commerce API
  let productId: string | null = null;
  let amount = 0;
  let raw: unknown = { manual: true };
  let orderNo: string | null = null;

  if (isCommerceApiConfigured()) {
    try {
      const { raw: rawApi, parsed } = await lookupProductOrder(body.productOrderNo);
      if (!parsed) {
        return NextResponse.json(
          { error: '주문번호를 찾을 수 없습니다. 결제 완료 후 다시 시도해주세요.' },
          { status: 404 },
        );
      }
      productId = parsed.productId ?? null;
      amount = parsed.totalPaymentAmount ?? 0;
      orderNo = parsed.orderId ?? null;
      raw = rawApi;
    } catch (e) {
      console.error('[orders/register] commerce api error', e);
      return NextResponse.json(
        { error: '네이버 커머스 API 호출에 실패했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 502 },
      );
    }
  }

  // Pick the package: by productId match, else 'basic' as default
  let packageCode = 'basic';
  if (productId) {
    const { data: pkg } = await admin
      .from('addon_packages')
      .select('code')
      .eq('naver_smartstore_product_no', productId)
      .eq('active', true)
      .maybeSingle();
    if (pkg) packageCode = pkg.code;
  }

  const { data: grantResult, error: grantErr } = await admin.rpc('grant_purchase_credits', {
    p_user_id: user.id,
    p_source: 'naver_smartstore',
    p_package_code: packageCode,
    p_amount: amount,
    p_portone_payment: null,
    p_naver_order_no: orderNo,
    p_naver_product_no: body.productOrderNo,
    p_raw: raw as never,
  });

  if (grantErr) {
    return NextResponse.json({ error: grantErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    result: grantResult,
  });
}
