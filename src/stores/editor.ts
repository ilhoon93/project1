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
  /**
   * 마지막 patchSection / setMeta 가 마지막 저장(또는 init) 이후에 일어났는지.
   * persist 미들웨어로 localStorage 에 따라 다닌다 → 다른 기기에서 같은
   * 청첩장을 열 때, "이 기기에 저장 안 한 변경분이 있다" 인지 알려준다.
   */
  unsaved: boolean;

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
      unsaved: false,

      init: (id, meta, content) =>
        set({
          invitationId: id,
          meta,
          content,
          status: 'idle',
          lastError: null,
          unsaved: false,
        }),

      reset: () =>
        set({
          invitationId: null,
          meta: null,
          content: null,
          status: 'idle',
          lastError: null,
          unsaved: false,
        }),

      patchSection: (key, value) =>
        set((state) =>
          state.content
            ? {
                content: { ...state.content, [key]: value },
                status: 'dirty',
                unsaved: true,
              }
            : state,
        ),

      setMeta: (partial) =>
        set((state) =>
          state.meta
            ? {
                meta: { ...state.meta, ...partial },
                status: 'dirty',
                unsaved: true,
              }
            : state,
        ),

      save: async () => {
        const { invitationId, content, meta, status } = get();
        if (!invitationId || !content || !meta) return;
        if (status === 'saving') return;

        const doPatch = async (confirmDelete: boolean) =>
          fetch(`/api/invitations/${invitationId}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              groomName: meta.groomName,
              brideName: meta.brideName,
              weddingDate: meta.weddingDate,
              content,
              confirmDeleteResponses: confirmDelete,
            }),
          });

        set({ status: 'saving', lastError: null });
        try {
          let res = await doPatch(false);

          // 409 = 발행된 알림장에서 quiz/vote 가 변경됐는데 기존 응답이 있어
          // 사용자 확인이 필요한 경우. 모달 대신 window.confirm 으로 즉시 확인.
          if (res.status === 409) {
            const data = await res.json().catch(() => ({}));
            if (data?.requiresConfirmation) {
              const q = data.quizResponseCount ?? 0;
              const v = data.voteResponseCount ?? 0;
              const parts: string[] = [];
              if (q > 0) parts.push(`퀴즈 응답 ${q}건`);
              if (v > 0) parts.push(`투표 응답 ${v}건`);
              const msg =
                `이미 모인 ${parts.join(' · ')}이(가) 모두 삭제됩니다.\n` +
                `퀴즈/투표 내용이 바뀌면 기존 응답이 어긋나기 때문이에요.\n\n계속 진행할까요?`;
              if (typeof window === 'undefined' || !window.confirm(msg)) {
                set({ status: 'dirty' });
                return;
              }
              res = await doPatch(true);
            }
          }

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error ?? `HTTP ${res.status}`);
          }
          set({ status: 'saved', unsaved: false });
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
      // only persist the working content — never the saving status.
      // `unsaved` 도 함께 저장해 다른 기기에서 같은 청첩장을 열 때 충돌 판별에 사용.
      partialize: (state) => ({
        invitationId: state.invitationId,
        meta: state.meta,
        content: state.content,
        unsaved: state.unsaved,
      }),
    },
  ),
);
