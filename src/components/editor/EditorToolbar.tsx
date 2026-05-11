'use client';

import { useState } from 'react';
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

  // 미리보기는 자동 저장 안 함. 단, 저장이 진행 중이면 끝까지 기다렸다가 이동 →
  // "저장" 클릭 후 바로 "미리보기" 누르는 흐름에서도 최신 데이터가 반영되게 한다.
  const handlePreview = async () => {
    if (navigating) return;
    if (status === 'dirty') {
      const ok = window.confirm(
        '저장하지 않은 변경사항이 있어요. 미리보기에는 저장된 내용만 반영됩니다. 그래도 미리보기로 이동할까요?',
      );
      if (!ok) return;
    }
    setNavigating(true);
    // 저장 진행 중이면 완료까지 폴링 — race condition 방지.
    while (useEditorStore.getState().status === 'saving') {
      await new Promise((r) => setTimeout(r, 50));
    }
    router.push(`/preview/${invitationId}`);
  };

  // 저장내역 (= 마이페이지) 이동 — 미저장 변경이 있으면 confirm. 사용자가 "이동"
  // 을 선택하면 로컬 스토어를 reset 해 다음에 에디터로 돌아왔을 때 항상 서버에
  // 저장된 데이터만 보이도록 한다 (팝업의 "변경사항이 사라집니다" 문구를 실제로
  // 이행). 저장 진행 중이면 완료까지 기다림.
  const handleGoMypage = async () => {
    if (status === 'dirty') {
      const ok = window.confirm(
        '저장하지 않은 변경사항이 있어요. 저장내역으로 이동하면 변경사항이 사라집니다. 이동할까요?',
      );
      if (!ok) return;
      useEditorStore.getState().reset();
    }
    while (useEditorStore.getState().status === 'saving') {
      await new Promise((r) => setTimeout(r, 50));
    }
    router.push('/mypage');
  };

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleGoMypage()}
          className="text-sm text-muted-foreground hover:text-foreground"
          aria-label="저장내역으로"
        >
          ←
        </button>
        <span className={`text-xs ${STATUS_COLOR[status]}`} title={lastError ?? undefined}>
          {STATUS_LABEL[status]}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => void handleGoMypage()}>
          저장내역
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={() => void save()}
          disabled={status === 'saving' || status === 'idle' || status === 'saved'}
        >
          저장
        </Button>
        {/* lg 이상에서는 좌측 패널이 실시간 미리보기 역할이라 별도 버튼 불필요 */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handlePreview()}
          disabled={navigating || status === 'saving'}
          className="lg:hidden"
        >
          {navigating ? '이동 중...' : '미리보기'}
        </Button>
      </div>
    </header>
  );
}
