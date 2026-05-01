'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEditorStore } from '@/stores/editor';
import { Button } from '@/components/ui/button';

const STATUS_LABEL = {
  idle: '',
  dirty: '저장 안 됨',
  saving: '저장 중...',
  saved: '저장됨',
  error: '저장 실패',
} as const;

const STATUS_COLOR = {
  idle: 'text-muted-foreground',
  dirty: 'text-amber-600',
  saving: 'text-muted-foreground',
  saved: 'text-emerald-600',
  error: 'text-destructive',
} as const;

export function EditorToolbar({ invitationId }: { invitationId: string }) {
  const status = useEditorStore((s) => s.status);
  const save = useEditorStore((s) => s.save);
  const lastError = useEditorStore((s) => s.lastError);
  const router = useRouter();
  const [navigating, setNavigating] = useState(false);

  // Preview must always show the latest edits — if the user clicks before
  // autosave's 2s debounce fires, the server still has stale content and the
  // preview misses what they just typed. So flush a save first, then navigate.
  const handlePreview = async () => {
    if (navigating) return;
    setNavigating(true);
    try {
      if (status === 'dirty' || status === 'saving' || status === 'error') {
        await save();
      }
    } finally {
      router.push(`/preview/${invitationId}`);
    }
  };

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <Link
          href="/mypage"
          className="text-sm text-muted-foreground hover:text-foreground"
          aria-label="저장 내역으로"
        >
          ←
        </Link>
        <span className={`text-xs ${STATUS_COLOR[status]}`} title={lastError ?? undefined}>
          {STATUS_LABEL[status]}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => void save()} disabled={status === 'saving'}>
          저장
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handlePreview()}
          disabled={navigating || status === 'saving'}
        >
          {navigating ? '저장 중...' : '미리보기'}
        </Button>
      </div>
    </header>
  );
}
