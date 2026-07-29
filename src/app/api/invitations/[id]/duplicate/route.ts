import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateSlug } from '@/lib/utils/nanoid';
import { PG_UNIQUE_VIOLATION } from '@/lib/utils/validation';
import { MAX_INVITATIONS_PER_USER } from '@/lib/limits';

type RouteCtx = { params: { id: string } };

const BUCKET = 'public-images';

/**
 * POST /api/invitations/[id]/duplicate
 *
 * 본인 소유 알림장을 통째로 복사해 새 미발행 draft 를 만든다. 혼주용처럼 "복사한
 * 뒤 계좌만 바꾸는" 용도. 복사본은 내용(디자인·사진·글·계좌)을 그대로 물려받되:
 *   - 새 slug 로 별개의 알림장이 되고 is_published=false (발행/공개 URL 미승계)
 *   - 개수 한도(MAX_INVITATIONS_PER_USER)에 포함 → 한도 초과면 409
 *   - 하객 데이터(방명록·서명·퀴즈·투표)는 복사하지 않음 (새 알림장이므로 자연히 없음)
 *
 * 이미지는 깊은 복사: 원본 스토리지 prefix(invitations/{원본id}/…) 아래 객체를 새
 * prefix(invitations/{새id}/…) 로 복제하고 content 의 이미지 URL 을 새 prefix 로
 * 재작성한다 → 원본을 삭제해도 복사본 이미지가 깨지지 않는다. 스토리지 복사가
 * 실패하면 content 를 원본 URL 그대로 둬(얕은 복사 폴백) 이미지가 깨지지 않게 한다.
 */
export async function POST(_req: Request, { params }: RouteCtx) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 1) 원본 조회 + 소유권 확인.
  const { data: src, error: srcError } = await supabase
    .from('invitations')
    .select('groom_name, bride_name, wedding_date, content')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (srcError) return NextResponse.json({ error: srcError.message }, { status: 500 });
  if (!src) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // 2) 개수 한도 확인.
  const { count } = await supabase
    .from('invitations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);
  if ((count ?? 0) >= MAX_INVITATIONS_PER_USER) {
    return NextResponse.json(
      {
        error: `알림장은 최대 ${MAX_INVITATIONS_PER_USER}개까지 만들 수 있어요. 기존 알림장을 삭제한 뒤 복사해주세요.`,
      },
      { status: 409 },
    );
  }

  // 3) 새 draft 삽입 — 우선 원본 content 그대로(원본 이미지 URL 공유)로 넣는다.
  //    스토리지 복사가 끝난 뒤 URL 만 새 prefix 로 재작성한다. slug 충돌 시 재시도.
  let newId: string | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = generateSlug();
    const { data, error } = await supabase
      .from('invitations')
      .insert({
        user_id: user.id,
        slug,
        groom_name: src.groom_name,
        bride_name: src.bride_name,
        wedding_date: src.wedding_date,
        content: src.content,
      })
      .select('id')
      .single();
    if (!error && data) {
      newId = data.id;
      break;
    }
    if (error && error.code !== PG_UNIQUE_VIOLATION) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  if (!newId) {
    return NextResponse.json(
      { error: '알림장 생성에 실패했어요. 잠시 후 다시 시도해주세요.' },
      { status: 500 },
    );
  }

  // 4) 깊은 복사 — 스토리지 객체를 새 prefix 로 복제. 전부 성공했을 때만 content 의
  //    이미지 URL 을 새 prefix 로 재작성한다(부분 실패 시 원본 URL 유지 = 얕은 복사 폴백).
  const copiedAll = await copyStoragePrefix(
    supabase,
    BUCKET,
    `invitations/${params.id}`,
    `invitations/${newId}`,
  );
  if (copiedAll) {
    // content 안의 원본 스토리지 경로만 새 id 경로로 치환. UUID 라 다른 곳과 충돌 없음.
    const rewritten = JSON.parse(
      JSON.stringify(src.content)
        .split(`invitations/${params.id}/`)
        .join(`invitations/${newId}/`),
    );
    await supabase
      .from('invitations')
      .update({ content: rewritten })
      .eq('id', newId)
      .eq('user_id', user.id);
  }

  return NextResponse.json({ id: newId });
}

/**
 * fromPrefix 아래 모든 객체를 toPrefix 로 복제. Supabase Storage 는 list 가 1 단계만
 * 보여주므로 폴더(id === null)를 만나면 재귀. 이 앱의 이미지 깊이는 ≤ 2
 * (예: gallery/file.jpg, story-2/file.jpg).
 *
 * 반환: 모든 객체가 성공적으로 복사되면 true. 하나라도 실패하면 false 를 반환해
 * 호출부가 URL 재작성을 건너뛰고 원본 URL(얕은 복사)로 폴백하게 한다.
 */
async function copyStoragePrefix(
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  fromPrefix: string,
  toPrefix: string,
): Promise<boolean> {
  try {
    const { data: entries, error } = await supabase.storage
      .from(bucket)
      .list(fromPrefix, { limit: 1000 });
    if (error) return false;
    if (!entries || entries.length === 0) return true; // 복사할 이미지 없음 = 성공.

    let ok = true;
    for (const entry of entries) {
      const from = `${fromPrefix}/${entry.name}`;
      const to = `${toPrefix}/${entry.name}`;
      // 폴더는 id === null (Supabase 관행). 재귀.
      if (entry.id === null) {
        ok = (await copyStoragePrefix(supabase, bucket, from, to)) && ok;
      } else {
        const { error: copyError } = await supabase.storage.from(bucket).copy(from, to);
        if (copyError) ok = false;
      }
    }
    return ok;
  } catch {
    return false;
  }
}
