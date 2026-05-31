import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { defaultInvitationContent, type InvitationContent } from '@/types/invitation';
import { generateSlug } from '@/lib/utils/nanoid';
import { PG_UNIQUE_VIOLATION } from '@/lib/utils/validation';
import { MAX_INVITATIONS_PER_USER } from '@/lib/limits';
import { DEFAULT_SAMPLE_CONFIGS } from '@/lib/marketing/sample-invitations';

/**
 * 신랑·신부 이름과 날짜는 더 이상 별도의 사전 입력 페이지에서 받지 않는다.
 * 사용자가 "새 알림장 만들기" 를 누르면 빈 값으로 즉시 invitation 을 생성하고
 * 편집기로 이동시킨다 — 이름/날짜는 편집기의 "기본 정보 → 신랑·신부와 가족"
 * 하위 섹션에서 입력.
 *
 * 로그아웃 상태에서 진입하면 next=/ 로 로그인 페이지로 보낸다 — 로그인이
 * 끝나도 자동으로 알림장이 만들어지지 않고 홈으로 돌아오게 해, 사용자가
 * 한번 더 "무료로 만들어보기" 를 눌렀을 때만 빈 알림장이 생성되도록 한다.
 */
interface PageProps {
  searchParams: { preset?: string };
}

export default async function NewInvitationPage({ searchParams }: PageProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/');

  // 한도 초과: 마이페이지로 안내하는 안내 화면 렌더 (자동 생성 X)
  const { count } = await supabase
    .from('invitations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);
  if ((count ?? 0) >= MAX_INVITATIONS_PER_USER) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 py-12 text-center">
        <p className="text-xs tracking-[0.3em] text-[#8B7355]">LIMIT REACHED</p>
        <h1 className="text-xl font-semibold tracking-tight">
          알림장이 최대 {MAX_INVITATIONS_PER_USER}개까지 저장되어 있어요
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          새 알림장을 만들려면 마이페이지에서 사용하지 않는 알림장을 먼저 삭제해주세요.
        </p>
        <Link
          href="/mypage"
          className="inline-flex h-10 items-center justify-center rounded-md bg-[#8B7355] px-5 text-sm font-medium text-white"
        >
          마이페이지로 이동
        </Link>
      </main>
    );
  }

  const initial = buildInitialState(searchParams.preset);

  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = generateSlug();
    const { data, error } = await supabase
      .from('invitations')
      .insert({
        user_id: user.id,
        slug,
        groom_name: initial.groomName,
        bride_name: initial.brideName,
        wedding_date: initial.weddingDate,
        content: initial.content,
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

interface InitialState {
  groomName: string;
  brideName: string;
  weddingDate: string | null;
  content: InvitationContent;
}

/**
 * `?preset=<design-id>` 가 있으면 마케팅 디자인 카탈로그의 해당 디자인에서
 * 레이아웃·색·폰트·배경효과·표지 디자인 옵션 + 신랑·신부 이름·날짜·인사말을
 * 시작값으로 가져온다. 사용자는 자기 이름·사진으로 덮어쓰면 됨.
 * 사진(heroImage, gallery, story image) 은 사용자 업로드 자리로 비워둠 —
 * 카탈로그 샘플 사진 경로(/wedding-snap/catalog/*) 는 InvitationContent 의
 * z.string().url() 검증을 통과하지 못해 어차피 저장 불가.
 */
function buildInitialState(presetId: string | undefined): InitialState {
  const content = defaultInvitationContent();
  const preset = presetId
    ? DEFAULT_SAMPLE_CONFIGS.find((c) => c.id === presetId)
    : null;
  if (!preset) {
    return { groomName: '', brideName: '', weddingDate: null, content };
  }

  content.theme.colorTheme = preset.colorTheme;
  content.theme.petalType = preset.petalType;
  content.theme.font = preset.font;
  content.main = { ...preset.main, heroImage: null };

  return {
    groomName: preset.groomName,
    brideName: preset.brideName,
    weddingDate: preset.weddingDate,
    content,
  };
}
