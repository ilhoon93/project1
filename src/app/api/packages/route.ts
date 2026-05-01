import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('addon_packages')
    .select('code, name, description, price, publish_credits_grant, naver_smartstore_product_no, sort_order')
    .eq('active', true)
    .order('sort_order', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ packages: data ?? [] });
}
