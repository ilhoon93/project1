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
import { MetaEditor } from '@/components/editor/sections/MetaEditor';
import { ThemeEditor } from '@/components/editor/sections/ThemeEditor';
import { BasicInfoEditor } from '@/components/editor/sections/BasicInfoEditor';

interface Props {
  invitationId: string;
  meta: { groomName: string; brideName: string; weddingDate: string | null };
  content: InvitationContent;
}

const AUTOSAVE_DEBOUNCE_MS = 2_000;

type Tab = 'edit' | 'ai';

export function EditorClient({ invitationId, meta, content }: Props) {
  const init = useEditorStore((s) => s.init);
  const status = useEditorStore((s) => s.status);
  const save = useEditorStore((s) => s.save);
  const [tab, setTab] = useState<Tab>('edit');

  // Hydrate the store with server-provided data on first mount.
  //
  // Important: if the persisted store already holds this invitation's content
  // (e.g. user clicked 미리보기, came back, and Next.js may serve a cached
  // server render), keep the local store as-is. Otherwise round-tripping to
  // /preview wipes uncommitted edits with stale server data.
  //
  // We do still re-parse the local content through the current schema so any
  // fields that didn't exist when the state was persisted (e.g. account
  // groomFather/brideMother added in step 5) get filled in with defaults
  // instead of crashing the editor with `undefined.map(...)`.
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const current = useEditorStore.getState();
    if (current.invitationId === invitationId && current.content) {
      try {
        const reparsed = InvitationContentSchema.parse(current.content);
        if (JSON.stringify(reparsed) !== JSON.stringify(current.content)) {
          useEditorStore.setState({ content: reparsed });
        }
      } catch {
        // If old persisted state can't be coerced, fall back to server data.
        init(invitationId, meta, content);
      }
      return;
    }
    init(invitationId, meta, content);
  }, [invitationId, meta, content, init]);

  // Debounced auto-save: when status flips to 'dirty', schedule a save.
  useEffect(() => {
    if (status !== 'dirty') return;
    const t = setTimeout(() => void save(), AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [status, save]);

  return (
    <div className="min-h-screen bg-muted/30">
      <EditorToolbar invitationId={invitationId} />

      <div className="sticky top-[57px] z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl gap-1 px-4">
          <TabButton selected={tab === 'edit'} onClick={() => setTab('edit')}>
            기본 편집
          </TabButton>
          <TabButton selected={tab === 'ai'} onClick={() => setTab('ai')}>
            AI 이미지
          </TabButton>
        </div>
      </div>

      <main className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-6 pb-32">
        {tab === 'edit' ? (
          <>
            <MetaEditor />
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
