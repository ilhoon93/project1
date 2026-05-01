import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/credits — current balance + recent ledger entries.
 */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [{ data: balance }, { data: ledger }] = await Promise.all([
    supabase.rpc('publish_credits_balance', { uid: user.id }),
    supabase
      .from('publish_credits_ledger')
      .select('id, delta, reason, ref_table, ref_id, note, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  return NextResponse.json({
    balance: typeof balance === 'number' ? balance : 0,
    ledger: ledger ?? [],
  });
}
