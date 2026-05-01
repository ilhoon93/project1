'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEditorStore } from '@/stores/editor';

interface Props {
  invitationId: string;
  publishedSlug: string | null;
  isPublished: boolean;
}

export function PreviewBanner({ invitationId, publishedSlug, isPublished }: Props) {
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const status = useEditorStore((s) => s.status);
  const save = useEditorStore((s) => s.save);

  const handlePublish = async () => {
    if (publishing) return;
    setErrorMsg(null);
    setPublishing(true);
    try {
      // Make sure the latest in-memory edits are persisted before we snapshot.
      if (status === 'dirty' || status === 'error') {
        await save();
      }
      const res = await fetch(`/api/publish/${invitationId}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 402) throw new Error(data.error ?? '발행권이 부족합니다');
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      router.push(`/${data.slug}`);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '발행 실패');
      setPublishing(false);
    }
  };

  return (
    <div className="fixed left-1/2 top-3 z-30 flex -translate-x-1/2 flex-col items-center gap-1">
      <div className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-black/80 px-3 py-1.5 text-[11px] text-white shadow-lg backdrop-blur">
        <span className="font-medium">미리보기</span>
        <span className="text-white/40">|</span>
        {publishedSlug ? (
          <Link href={`/${publishedSlug}`} className="underline">
            공개 링크 열기
          </Link>
        ) : (
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing}
            className="underline disabled:opacity-50"
          >
            {publishing ? '발행 중...' : '지금 발행하기'}
          </button>
        )}
        <span className="text-white/40">|</span>
        <Link href={`/edit/${invitationId}`} className="underline">
          편집
        </Link>
        <span className="text-white/40">|</span>
        <Link href="/mypage" className="underline">
          저장 내역
        </Link>
      </div>

      {/* "재발행" 버튼 — 이미 발행된 알림장이라도 다시 새 URL로 발행할 수 있게. */}
      {isPublished && publishedSlug && (
        <button
          type="button"
          onClick={handlePublish}
          disabled={publishing}
          className="rounded-full bg-white/90 px-3 py-1 text-[11px] text-[#3D2E1F] shadow ring-1 ring-black/10 disabled:opacity-50"
        >
          {publishing ? '재발행 중...' : '새 URL로 재발행'}
        </button>
      )}

      {errorMsg && (
        <p className="rounded-full bg-destructive px-3 py-1 text-xs text-destructive-foreground">
          {errorMsg}
        </p>
      )}
    </div>
  );
}
