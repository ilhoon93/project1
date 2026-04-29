import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { InvitationContentSchema } from '@/types/invitation';
import { InvitationSlides } from '@/components/invitation/InvitationSlides';

interface PageProps {
  params: { slug: string };
}

type FetchResult =
  | { kind: 'ok'; inv: PublishedInvitation }
  | { kind: 'expired'; inv: PublishedInvitation }
  | { kind: 'missing' };

interface PublishedInvitation {
  id: string;
  slug: string;
  groom_name: string;
  bride_name: string;
  wedding_date: string | null;
  content: unknown;
  expires_at: string | null;
}

async function fetchInvitation(slug: string): Promise<FetchResult> {
  const supabase = createClient();
  const { data } = await supabase
    .from('invitations')
    .select('id, slug, groom_name, bride_name, wedding_date, content, expires_at')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();
  if (!data) return { kind: 'missing' };
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { kind: 'expired', inv: data };
  }
  return { kind: 'ok', inv: data };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const result = await fetchInvitation(params.slug);
  if (result.kind === 'missing') return { title: '미니멈 웨딩 스튜디오' };
  const { inv } = result;
  const title = `${inv.groom_name} ❤ ${inv.bride_name} 결혼합니다`;
  return {
    title,
    description: '저희 두 사람의 결혼식에 초대합니다',
    openGraph: { title, description: '저희 두 사람의 결혼식에 초대합니다' },
  };
}

export default async function PublicInvitationPage({ params }: PageProps) {
  const result = await fetchInvitation(params.slug);
  if (result.kind === 'missing') notFound();
  if (result.kind === 'expired') return <ExpiredView inv={result.inv} />;

  const inv = result.inv;
  const content = InvitationContentSchema.parse(inv.content ?? {});

  return (
    <InvitationSlides
      invitationId={inv.id}
      groomName={inv.groom_name}
      brideName={inv.bride_name}
      weddingDate={inv.wedding_date}
      content={content}
    />
  );
}

function ExpiredView({ inv }: { inv: PublishedInvitation }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FAF7F2] px-6 py-12 text-center text-[#3D2E1F]">
      <p className="text-xs tracking-[0.3em] text-[#8B7355]">EXPIRED</p>
      <h1 className="text-2xl font-semibold tracking-tight">
        {inv.groom_name} · {inv.bride_name}
      </h1>
      <p className="max-w-sm text-sm leading-relaxed text-[#5C4633]">
        결혼식이 끝나고 30일이 지나 알림장이 비공개로 전환되었습니다.
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
