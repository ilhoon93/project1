'use client';

import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '@/stores/editor';
import { InvitationContentSchema, type InvitationContent } from '@/types/invitation';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { AIPanel } from '@/components/editor/AIPanel';
import { MainEditor } from '@/components/editor/sections/MainEditor';
import { StoryEditor } from '@/components/editor/sections/StoryEditor';
import { GalleryEditor } from '@/components/editor/sections/GalleryEditor';
import { VideoEditor } from '@/components/editor/sections/VideoEditor';
import { QuizEditor } from '@/components/editor/sections/QuizEditor';
import { VoteEditor } from '@/components/editor/sections/VoteEditor';
import { GuestbookEditor } from '@/components/editor/sections/GuestbookEditor';
import { AccountEditor } from '@/components/editor/sections/AccountEditor';
import { ClosingEditor } from '@/components/editor/sections/ClosingEditor';
import { ThemeEditor } from '@/components/editor/sections/ThemeEditor';
import { BasicInfoEditor } from '@/components/editor/sections/BasicInfoEditor';
import { EditorLivePreview } from '@/components/editor/EditorLivePreview';

interface Props {
  invitationId: string;
  meta: { groomName: string; brideName: string; weddingDate: string | null };
  content: InvitationContent;
}

// 자동 저장 주기를 길게 가져간다 — 사용자는 수동 "저장" 버튼이 주된 경로이고,
// 60초 백그라운드 저장은 사고로 탭이 닫혔을 때를 위한 안전망이다. 자주 쓰면
// 글자 한 자에 PATCH 가 폭주해 미리보기 스트림이 끊긴다.
const AUTOSAVE_DEBOUNCE_MS = 60_000;

type Tab = 'edit' | 'ai';

export function EditorClient({ invitationId, meta, content }: Props) {
  const init = useEditorStore((s) => s.init);
  const status = useEditorStore((s) => s.status);
  const save = useEditorStore((s) => s.save);
  const [tab, setTab] = useState<Tab>('edit');

  // Hydrate the store with server-provided data on first mount.
  //
  // 정책:
  //   - 같은 청첩장 ID 의 persist 데이터가 있고 + `unsaved === true` 이면
  //     로컬에 저장 안 한 편집분이 있다는 뜻 → 그대로 사용 (예: /preview 다녀와도 보존).
  //   - 그 외에는 항상 서버 데이터를 사용 → 다른 기기(모바일↔노트북)에서
  //     같은 네이버 계정으로 열었을 때 최신 저장 결과가 그대로 보임.
  //
  // 로컬 content 는 현재 스키마로 한 번 reparse 해 신규 필드도 기본값으로 채운다.
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const current = useEditorStore.getState();
    const sameInvitation = current.invitationId === invitationId && current.content;
    if (sameInvitation && current.unsaved) {
      try {
        const reparsed = InvitationContentSchema.parse(current.content);
        if (JSON.stringify(reparsed) !== JSON.stringify(current.content)) {
          useEditorStore.setState({ content: reparsed });
        }
      } catch {
        // 로컬 데이터가 스키마와 맞지 않으면 안전하게 서버 데이터로 폴백.
        init(invitationId, meta, content);
      }
      return;
    }
    // 저장 완료 상태이거나 다른 청첩장 → 서버 데이터로 초기화 (기기간 동기화 보장).
    init(invitationId, meta, content);
  }, [invitationId, meta, content, init]);

  // Debounced auto-save: when status flips to 'dirty', schedule a save.
  // 60초 — 백그라운드 안전망. 즉시 저장은 툴바의 "저장" 버튼.
  useEffect(() => {
    if (status !== 'dirty') return;
    const t = setTimeout(() => void save(), AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [status, save]);

  // 미저장 변경이 있을 때 탭/창 닫기 경고.
  useEffect(() => {
    if (status !== 'dirty') return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [status]);

  return (
    <div className="min-h-screen bg-muted/30">
      <EditorToolbar invitationId={invitationId} />

      {/* lg 이상에서는 좌측 실시간 미리보기 + 우측 컨트롤 2단 분할.
          미만은 기존 단일 컬럼 그대로. */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:gap-6 lg:px-6 lg:py-6">
        {/* ── 좌측: 실시간 미리보기 (lg+ 전용) ───────────────────── */}
        <aside className="hidden lg:flex lg:sticky lg:top-[calc(57px+1.5rem)] lg:h-[calc(100vh-57px-3rem)] lg:items-center lg:justify-center">
          <EditorLivePreview invitationId={invitationId} />
        </aside>

        {/* ── 우측 (mobile: 단일 컬럼): 탭 + 에디터 컨트롤 ─────── */}
        <div className="flex min-w-0 flex-col">
          <div className="sticky top-[57px] z-10 -mx-0 border-b bg-background/80 backdrop-blur lg:top-0 lg:rounded-md lg:border lg:bg-background">
            <div className="mx-auto flex max-w-2xl gap-1 px-4 lg:max-w-none lg:px-3">
              <TabButton selected={tab === 'edit'} onClick={() => setTab('edit')}>
                기본 편집
              </TabButton>
              <TabButton selected={tab === 'ai'} onClick={() => setTab('ai')}>
                AI 이미지
              </TabButton>
            </div>
          </div>

          <main className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 py-6 pb-32 lg:max-w-none lg:px-0 lg:py-4">
            {tab === 'edit' ? (
              <>
                <ThemeEditor />
                <MainEditor />
                <BasicInfoEditor />
                <StoryEditor />
                <GalleryEditor />
                <VideoEditor />
                <QuizEditor />
                <VoteEditor />
                <GuestbookEditor />
                <AccountEditor />
                <ClosingEditor />
              </>
            ) : (
              <AIPanel />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={`relative px-3 py-2.5 text-sm transition-colors ${
        selected
          ? 'font-medium text-foreground'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
      {selected && (
        <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-foreground" />
      )}
    </button>
  );
}
