import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { nanoid } from '@/lib/utils/nanoid';

const BodySchema = z.object({ invitationId: z.string().uuid() });

const PRICE = 9_900;
const PRODUCT_NAME = '미니멈 웨딩 스튜디오 — 알림장';

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

  // Ownership + must not be already paid/published
  const { data: inv } = await supabase
    .from('invitations')
    .select('id, paid_at, is_published')
    .eq('id', body.invitationId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!inv) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (inv.is_published) {
    return NextResponse.json({ error: '이미 발행된 알림장입니다' }, { status: 409 });
  }
  if (inv.paid_at) {
    return NextResponse.json({ error: '이미 결제되었습니다' }, { status: 409 });
  }

  const paymentId = `inv_${body.invitationId.replace(/-/g, '').slice(0, 16)}_${nanoid(8)}`;

  const { error } = await supabase
    .from('invitations')
    .update({ payment_id: paymentId })
    .eq('id', body.invitationId)
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    paymentId,
    amount: PRICE,
    currency: 'KRW',
    productName: PRODUCT_NAME,
  });
}
