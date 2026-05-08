import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { InvitationContentSchema } from '@/types/invitation';
import { InvitationSlides } from '@/components/invitation/InvitationSlides';
import { InAppBrowserGuard } from '@/components/invitation/InAppBrowserGuard';
import { FullscreenToggle } from '@/components/invitation/FullscreenToggle';

// 노트북에서 저장한 직후 모바일에서 열어도 항상 최신 publications.content 가
// 보이도록 페이지/메타데이터 모두 캐시 우회. Supabase 클라이언트가 cookies()
// 를 쓰기 때문에 사실상 dynamic 이지만, CDN/프록시/브라우저 단의 라우트 세그먼트
// 캐시까지 막기 위해 명시.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

interface PageProps {
  params: { slug: string };
}

interface PublishedView {
  invitation_id: string;
  slug: string;
  groom_name: string;
  bride_name: string;
  wedding_date: string | null;
  content: unknown;
  expires_at: string | null;
}

type FetchResult =
  | { kind: 'ok'; inv: PublishedView }
  | { kind: 'expired'; inv: PublishedView }
  | { kind: 'missing' };

/**
 * Resolve a public slug. Prefer `publications` (the post-credits world
 * where each publish has its own URL); fall back to legacy
 * `invitations.slug` for backwards compatibility.
 */
async function fetchInvitation(slug: string): Promise<FetchResult> {
  const supabase = createClient();

  // 1) New world: publications snapshot
  const { data: pub } = await supabase
    .from('publications')
    .select('invitation_id, slug, groom_name, bride_name, wedding_date, content, expires_at, revoked_at')
    .eq('slug', slug)
    .maybeSingle();

  if (pub) {
    if (pub.revoked_at) return { kind: 'missing' };
    const view: PublishedView = {
      invitation_id: pub.invitation_id,
      slug: pub.slug,
      groom_name: pub.groom_name,
      bride_name: pub.bride_name,
      wedding_date: pub.wedding_date,
      content: pub.content,
      expires_at: pub.expires_at,
    };
    if (pub.expires_at && new Date(pub.expires_at) < new Date()) {
      return { kind: 'expired', inv: view };
    }
    return { kind: 'ok', inv: view };
  }

  // 2) Legacy: pre-migration invitations
  const { data } = await supabase
    .from('invitations')
    .select('id, slug, groom_name, bride_name, wedding_date, content, expires_at')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();
  if (!data) return { kind: 'missing' };

  const view: PublishedView = {
    invitation_id: data.id,
    slug: data.slug,
    groom_name: data.groom_name,
    bride_name: data.bride_name,
    wedding_date: data.wedding_date,
    content: data.content,
    expires_at: data.expires_at,
  };
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { kind: 'expired', inv: view };
  }
  return { kind: 'ok', inv: view };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const result = await fetchInvitation(params.slug);
  if (result.kind === 'missing') return { title: '우리다운' };
  const { inv } = result;
  const title = `${inv.groom_name} ❤ ${inv.bride_name} 결혼합니다`;
  // 카카오톡 공유 카드에 보이는 한 줄 설명 — 인앱 뷰어 안내까지 같이 표기.
  const description =
    '저희 두 사람의 결혼을 알립니다. 전체 화면으로 보시려면 외부 브라우저로 열어주세요.';
  return {
    title,
    description,
    openGraph: { title, description },
  };
}

export default async function PublicInvitationPage({ params }: PageProps) {
  const result = await fetchInvitation(params.slug);
  if (result.kind === 'missing') notFound();
  if (result.kind === 'expired') return <ExpiredView inv={result.inv} />;

  const inv = result.inv;
  const content = InvitationContentSchema.parse(inv.content ?? {});

  return (
    <>
      <InAppBrowserGuard />
      <FullscreenToggle />
      <InvitationSlides
        invitationId={inv.invitation_id}
        groomName={inv.groom_name}
        brideName={inv.bride_name}
        weddingDate={inv.wedding_date}
        content={content}
      />
    </>
  );
}

function ExpiredView({ inv }: { inv: PublishedView }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FAF7F2] px-6 py-12 text-center text-[#3D2E1F]">
      <p className="text-xs tracking-[0.3em] text-[#8B7355]">EXPIRED</p>
      <h1 className="text-2xl font-semibold tracking-tight">
        {inv.groom_name} · {inv.bride_name}
      </h1>
      <p className="max-w-sm text-sm leading-relaxed text-[#5C4633]">
        발행 후 30일이 지나 알림장이 비공개로 전환되었습니다.
        <br />
        축복해주신 모든 분들께 감사드립니다.
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex h-10 items-center justify-center rounded-md bg-[#8B7355] px-5 text-sm font-medium text-white"
      >
        홈으로
      </Link>
    </main>
  );
}
