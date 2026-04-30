import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { defaultInvitationContent } from '@/types/invitation';
import { generateSlug } from '@/lib/utils/nanoid';
import { PG_UNIQUE_VIOLATION } from '@/lib/utils/validation';

/**
 * 신랑·신부 이름과 날짜는 더 이상 별도의 사전 입력 페이지에서 받지 않는다.
 * 사용자가 "새 알림장 만들기" 를 누르면 빈 값으로 즉시 invitation 을 생성하고
 * 편집기로 이동시킨다 — 이름/날짜는 편집기의 "기본 정보 → 신랑·신부와 가족"
 * 하위 섹션에서 입력.
 */
export default async function NewInvitationPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/new');

  const content = defaultInvitationContent();

  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = generateSlug();
    const { data, error } = await supabase
      .from('invitations')
      .insert({
        user_id: user.id,
        slug,
        groom_name: '',
        bride_name: '',
        wedding_date: null,
        content,
      })
      .select('id')
      .single();

    if (!error && data) {
      redirect(`/edit/${data.id}`);
    }
    if (error && error.code !== PG_UNIQUE_VIOLATION) {
      throw new Error(error.message);
    }
  }
  throw new Error('Failed to allocate slug');
}
