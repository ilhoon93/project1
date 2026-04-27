import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getPayment } from '@/lib/payment/portone';

const BodySchema = z.object({ paymentId: z.string().min(1) });

const EXPECTED_AMOUNT = 9_900;

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

  // Find the invitation tied to this paymentId (set during /prepare)
  const { data: inv } = await supabase
    .from('invitations')
    .select('id, paid_at, total_price, payment_id, is_published')
    .eq('payment_id', body.paymentId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!inv) {
    return NextResponse.json({ error: 'Payment not found for this user' }, { status: 404 });
  }
  if (inv.is_published) {
    return NextResponse.json({ error: '이미 발행된 알림장입니다' }, { status: 409 });
  }
  if (inv.paid_at) {
    return NextResponse.json({ success: true, alreadyPaid: true, invitationId: inv.id });
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

  // Mark as paid
  const { error } = await supabase
    .from('invitations')
    .update({ paid_at: new Date().toISOString() })
    .eq('id', inv.id)
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, invitationId: inv.id });
}
