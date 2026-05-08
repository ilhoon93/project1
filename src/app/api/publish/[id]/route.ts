import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateOwnerToken, generateSlug } from '@/lib/utils/nanoid';
import { PG_UNIQUE_VIOLATION } from '@/lib/utils/validation';

interface PublishV3Result {
  publication_id: string;
  slug: string;
  owner_token: string;
  expires_at: string;
}

/**
 * POST /api/publish/[id]
 *
 * 발행권 1개를 차감하고 새 publications row 를 만든다.
 * 한 번의 발행에서 두 종류 URL 이 생성됨:
 *   - 하객용  : `/{slug}`               — 사람들에게 배포
 *   - 소장용  : `/{slug}/o/{owner_token}` — 신랑신부 본인 전용 (메시지/통계 뷰)
 *
 * 재발행 시에는 publications row 가 추가되며, 새 slug + 새 owner_token 도 함께 발급.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  for (let attempt = 0; attempt < 4; attempt++) {
    const slug = generateSlug();
    const ownerToken = generateOwnerToken();
    const { data, error } = await supabase.rpc('publish_invitation_v3', {
      inv_id: params.id,
      new_slug: slug,
      new_owner_tok: ownerToken,
    });

    if (!error) {
      const result = data as unknown as PublishV3Result;
      const base = process.env.NEXT_PUBLIC_BASE_URL ?? '';
      return NextResponse.json({
        success: true,
        slug: result.slug,
        ownerToken: result.owner_token,
        publicationId: result.publication_id,
        expiresAt: result.expires_at,
        url: `${base}/${result.slug}`,
        ownerUrl: `${base}/${result.slug}/o/${result.owner_token}`,
      });
    }

    // 23505 = unique_violation on publications.slug or owner_token — retry.
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
