import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { InvitationContent } from '@/types/invitation';

type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface EditorMeta {
  groomName: string;
  brideName: string;
  weddingDate: string | null;
}

interface EditorState {
  invitationId: string | null;
  meta: EditorMeta | null;
  content: InvitationContent | null;
  status: SaveStatus;
  lastError: string | null;

  init: (id: string, meta: EditorMeta, content: InvitationContent) => void;
  reset: () => void;

  patchSection: <K extends keyof InvitationContent>(
    key: K,
    value: InvitationContent[K],
  ) => void;
  setMeta: (meta: Partial<EditorMeta>) => void;

  save: () => Promise<void>;
}

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      invitationId: null,
      meta: null,
      content: null,
      status: 'idle',
      lastError: null,

      init: (id, meta, content) =>
        set({ invitationId: id, meta, content, status: 'idle', lastError: null }),

      reset: () =>
        set({
          invitationId: null,
          meta: null,
          content: null,
          status: 'idle',
          lastError: null,
        }),

      patchSection: (key, value) =>
        set((state) =>
          state.content
            ? { content: { ...state.content, [key]: value }, status: 'dirty' }
            : state,
        ),

      setMeta: (partial) =>
        set((state) =>
          state.meta ? { meta: { ...state.meta, ...partial }, status: 'dirty' } : state,
        ),

      save: async () => {
        const { invitationId, content, meta, status } = get();
        if (!invitationId || !content || !meta) return;
        if (status === 'saving') return;

        set({ status: 'saving', lastError: null });
        try {
          const res = await fetch(`/api/invitations/${invitationId}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              groomName: meta.groomName,
              brideName: meta.brideName,
              weddingDate: meta.weddingDate,
              content,
            }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error ?? `HTTP ${res.status}`);
          }
          set({ status: 'saved' });
        } catch (e) {
          set({
            status: 'error',
            lastError: e instanceof Error ? e.message : 'Unknown error',
          });
        }
      },
    }),
    {
      name: 'wedding-editor-storage',
      // only persist the working content — never the saving status
      partialize: (state) => ({
        invitationId: state.invitationId,
        meta: state.meta,
        content: state.content,
      }),
    },
  ),
);
