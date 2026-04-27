'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Props {
  invitationId: string;
  slug: string;
  isPublished: boolean;
  paidAt: string | null;
}

export function PreviewBanner({ invitationId, slug, isPublished, paidAt }: Props) {
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePublish = async () => {
    if (publishing) return;
    setErrorMsg(null);
    setPublishing(true);
    try {
      const res = await fetch(`/api/publish/${invitationId}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.push(`/${data.slug}`);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '발행 실패');
      setPublishing(false);
    }
  };

  return (
    <div className="fixed left-1/2 top-3 z-30 flex -translate-x-1/2 flex-col items-center gap-1">
      <div className="flex items-center gap-2 rounded-full bg-black/80 px-3 py-1.5 text-xs text-white shadow-lg backdrop-blur">
        <span className="font-medium">미리보기</span>
        <span className="text-white/40">|</span>
        {isPublished ? (
          <Link href={`/${slug}`} className="underline">
            공개 링크 열기
          </Link>
        ) : paidAt ? (
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing}
            className="underline disabled:opacity-50"
          >
            {publishing ? '발행 중...' : '지금 발행하기'}
          </button>
        ) : (
          <Link href={`/purchase/${invitationId}`} className="underline">
            결제하고 발행
          </Link>
        )}
        <span className="text-white/40">|</span>
        <Link href={`/edit/${invitationId}`} className="underline">
          편집
        </Link>
      </div>
      {errorMsg && (
        <p className="rounded-full bg-destructive px-3 py-1 text-xs text-destructive-foreground">
          {errorMsg}
        </p>
      )}
    </div>
  );
}
