'use client';

import Link from 'next/link';

interface Props {
  invitationId: string;
  publishedSlug: string | null;
  isPublished: boolean;
}

/**
 * Top banner shown over the preview. After scope change:
 * 발행은 마이페이지에서만 진행 — 편집 중 우발 발행을 막고
 * 발행 전 한번 더 정리할 수 있게 한다.
 */
export function PreviewBanner({ invitationId, publishedSlug }: Props) {
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
          <Link href="/mypage" className="underline">
            마이페이지에서 발행
          </Link>
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
    </div>
  );
}
