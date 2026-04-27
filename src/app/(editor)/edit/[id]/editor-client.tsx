'use client';

import { useEffect, useRef } from 'react';
import { useEditorStore } from '@/stores/editor';
import type { InvitationContent } from '@/types/invitation';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
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

interface Props {
  invitationId: string;
  meta: { groomName: string; brideName: string; weddingDate: string | null };
  content: InvitationContent;
}

const AUTOSAVE_DEBOUNCE_MS = 2_000;

export function EditorClient({ invitationId, meta, content }: Props) {
  const init = useEditorStore((s) => s.init);
  const status = useEditorStore((s) => s.status);
  const save = useEditorStore((s) => s.save);

  // Hydrate the store with server-provided data.
  // We use a ref to ensure init only runs once per page load even with
  // localStorage persist + StrictMode double-invocation.
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
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

      <main className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-6 pb-32">
        <MetaEditor />
        <MainEditor />
        <StoryEditor />
        <GalleryEditor />
        <VideoEditor />
        <QuizEditor />
        <VoteEditor />
        <GuestbookEditor />
        <AccountEditor />
        <ClosingEditor />
      </main>
    </div>
  );
}
