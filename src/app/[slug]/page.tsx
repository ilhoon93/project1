import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { InvitationContentSchema } from '@/types/invitation';
import { fetchLiveDisplaySettings, applyLiveDisplaySettings } from '@/lib/invitation/live-display';
import { InvitationSlides } from '@/components/invitation/InvitationSlides';
import { InAppBrowserGuard } from '@/components/invitation/InAppBrowserGuard';
import { FullscreenToggle } from '@/components/invitation/FullscreenToggle';
import { InvitationEntryGate } from '@/components/invitation/InvitationEntryGate';

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
    .select('invitation_id, slug, groom_name, bride_name, wedding_date, content, expires_at, revoked_at, archived')
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
    // 영구소장(archived=true) 이면 만료 무시 — 하객용도 영구 유지(소장용과 동일).
    if (!pub.archived && pub.expires_at && new Date(pub.expires_at) < new Date()) {
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
  // ⚠️ 개인 알림장(하객용) — 신랑신부 이름·사진·계좌가 검색에 노출되면 안 되는
  // 프라이버시 영역이므로 모든 경우에 색인/추적을 차단한다(robots: noindex,nofollow).
  // 카카오/메신저 공유 카드(openGraph)는 그대로 동작 — noindex 는 검색 색인만 막는다.
  const noindex = { robots: { index: false, follow: false } } as const;
  const result = await fetchInvitation(params.slug);
  if (result.kind === 'missing') return { title: '우리다운', ...noindex };
  const { inv } = result;
  const title = `${inv.groom_name} ❤ ${inv.bride_name} 결혼합니다`;
  // 카카오톡 공유 카드에 보이는 한 줄 설명 — 인앱 뷰어 안내까지 같이 표기.
  const description =
    '저희 두 사람의 결혼을 알립니다. 전체 화면으로 보시려면 외부 브라우저로 열어주세요.';
  // 공유 카드 이미지 결정:
  //   1) 표지(hero) 사진이 있으면 그 사진(public-images 공개 URL)을 그대로.
  //   2) 사진이 없는 일러스트/텍스트 표지면 /api/og/{slug} 로 "테마 배경색 + 표지
  //      일러스트" 이미지를 동적 생성해 사용.
  //   3) 그 외(사진·일러스트 모두 없음)면 사이트 기본 og.png 상속.
  const main = (inv.content as {
    main?: {
      heroImage?: unknown;
      layout?: string;
      textDesign?: { variant?: string };
    };
  } | null)?.main;
  const heroRaw = main?.heroImage;
  let ogImage: string | null =
    typeof heroRaw === 'string' && /^https?:\/\//.test(heroRaw) ? heroRaw : null;
  if (!ogImage) {
    const layout = main?.layout;
    const textVariant = main?.textDesign?.variant;
    const hasIllust =
      layout === 'illustration' ||
      (layout === 'text' && !!textVariant && textVariant !== 'none');
    if (hasIllust) {
      const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://wooridaun.com';
      ogImage = `${base}/api/og/${inv.slug}`;
    }
  }
  return {
    title,
    description,
    ...noindex,
    openGraph: {
      title,
      description,
      ...(ogImage ? { images: [{ url: ogImage, alt: title }] } : {}),
    },
  };
}

export default async function PublicInvitationPage({ params }: PageProps) {
  const result = await fetchInvitation(params.slug);
  if (result.kind === 'missing') notFound();
  if (result.kind === 'expired') return <ExpiredView inv={result.inv} />;

  const inv = result.inv;
  const content = InvitationContentSchema.parse(inv.content ?? {});
  // 표시용 설정(예: 갤러리 확대 보기)은 재발행 없이 저장 즉시 반영되도록 원본에서 덮어쓴다.
  applyLiveDisplaySettings(content, await fetchLiveDisplaySettings(inv.invitation_id));

  return (
    <>
      <InAppBrowserGuard />
      {/* 진입 인트로 — 탭이 곧 사용자 제스처가 되어 배경음악이 입장과 동시에 재생됨. */}
      <InvitationEntryGate
        groomName={inv.groom_name}
        brideName={inv.bride_name}
        heroImage={content.main.heroImage}
        colorTheme={content.theme.colorTheme}
      />
      {/* 모바일은 풀스크린, 노트북/PC(>= md)는 가운데 폰 프레임 박스로 가둬 보여준다 —
          소장용(o/[token]) 뷰와 동일한 처리. 큰 모니터에서 가로로 늘어진 알림장이
          어색해 보이는 문제 해결. scoped 로 InvitationSlides 가 부모 박스 기준으로 렌더. */}
      <div className="flex min-h-[100dvh] w-full items-center justify-center bg-neutral-950 md:p-6">
        <FullscreenToggle />
        <div className="relative h-[100dvh] w-full overflow-hidden bg-black md:h-[min(92dvh,calc(100vw*16/9))] md:max-h-[min(92dvh,900px)] md:w-[min(92vw,calc(92dvh*9/16))] md:max-w-[506px] md:rounded-2xl md:shadow-2xl">
          <InvitationSlides
            invitationId={inv.invitation_id}
            groomName={inv.groom_name}
            brideName={inv.bride_name}
            weddingDate={inv.wedding_date}
            content={content}
            scoped
            // 게이트 탭이 첫 제스처가 되어 음악을 켜므로 마운트 자동재생은 끈다.
            autoplayBgmOnMount={false}
          />
        </div>
      </div>
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
