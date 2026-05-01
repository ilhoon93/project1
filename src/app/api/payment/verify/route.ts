import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPayment } from '@/lib/payment/portone';

const BodySchema = z.object({ paymentId: z.string().min(1) });

const EXPECTED_AMOUNT = 9_900;
const DEFAULT_PACKAGE_CODE = 'basic';

/**
 * POST /api/payment/verify
 *
 * Verifies the PortOne payment and grants publish credits via the
 * `grant_purchase_credits` RPC. Idempotent on portone_payment_id.
 * Optionally marks the invitation as paid for legacy compatibility.
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
      return NextResponse.json({ error: 'Validation failed', issues: e.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Find the invitation that initiated this payment (set during /prepare).
  const { data: inv } = await supabase
    .from('invitations')
    .select('id, paid_at, total_price, payment_id')
    .eq('payment_id', body.paymentId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!inv) {
    return NextResponse.json({ error: 'Payment not found for this user' }, { status: 404 });
  }

  // Verify with PortOne
  let payment;
  try {
    payment = await getPayment(body.paymentId);
  } catch (e) {
    console.error('[payment/verify] portone error', e);
    return NextResponse.json({ error: '결제 정보 확인에 실패했습니다' }, { status: 502 });
  }

  if (payment.status !== 'PAID') {
    return NextResponse.json(
      { error: `결제가 완료되지 않았습니다 (status=${payment.status})` },
      { status: 400 },
    );
  }
  if (payment.amount.total !== EXPECTED_AMOUNT) {
    console.error('[payment/verify] amount mismatch', {
      paymentId: body.paymentId,
      expected: EXPECTED_AMOUNT,
      actual: payment.amount.total,
    });
    return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: grantResult, error: grantErr } = await admin.rpc('grant_purchase_credits', {
    p_user_id: user.id,
    p_source: 'portone',
    p_package_code: DEFAULT_PACKAGE_CODE,
    p_amount: payment.amount.total,
    p_portone_payment: body.paymentId,
    p_naver_order_no: null,
    p_naver_product_no: null,
    p_raw: payment as never,
  });

  if (grantErr) {
    console.error('[payment/verify] grant_purchase_credits failed', grantErr);
    return NextResponse.json({ error: grantErr.message }, { status: 500 });
  }

  // Legacy bookkeeping: keep invitations.paid_at filled in for any code
  // path that still inspects it (we no longer require it for publish).
  if (!inv.paid_at) {
    await supabase
      .from('invitations')
      .update({ paid_at: new Date().toISOString() })
      .eq('id', inv.id)
      .eq('user_id', user.id);
  }

  return NextResponse.json({
    success: true,
    invitationId: inv.id,
    grant: grantResult,
  });
}
