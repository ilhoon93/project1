import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateSlug } from '@/lib/utils/nanoid';
import { PG_UNIQUE_VIOLATION } from '@/lib/utils/validation';

interface PublishV2Result {
  publication_id: string;
  slug: string;
  expires_at: string;
}

/**
 * POST /api/publish/[id]
 *
 * Consumes one publish credit and emits a fresh `publications` row
 * with its own unique slug + 30-day expiry. Re-publishing the same
 * invitation creates an additional publication (and a new URL),
 * leaving any previously shared URLs valid until they expire.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Allocate a slug; retry on the (vanishingly rare) collision against
  // publications.slug, since publish_invitation_v2 takes the slug as input.
  for (let attempt = 0; attempt < 4; attempt++) {
    const slug = generateSlug();
    const { data, error } = await supabase.rpc('publish_invitation_v2', {
      inv_id: params.id,
      new_slug: slug,
    });

    if (!error) {
      const result = data as unknown as PublishV2Result;
      return NextResponse.json({
        success: true,
        slug: result.slug,
        publicationId: result.publication_id,
        expiresAt: result.expires_at,
        url: `${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/${result.slug}`,
      });
    }

    // 23505 = unique_violation on publications.slug — retry with a new slug
    if ((error as { code?: string }).code === PG_UNIQUE_VIOLATION) continue;

    if (error.message.includes('Insufficient publish credits')) {
      return NextResponse.json(
        { error: '발행권이 부족합니다. 마이페이지에서 패키지를 구매하거나 주문번호를 등록해주세요.' },
        { status: 402 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ error: 'Failed to allocate slug' }, { status: 500 });
}
