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
  /**
   * 마지막으로 로컬에서 편집한 시각(ms epoch). 다른 기기에서 더 나중에 저장한
   * 본이 있으면 그쪽을 우선 사용하기 위한 비교 기준. patchSection / setMeta
   * 가 호출될 때마다 갱신되며 save 성공 시에는 그대로 둔다 (서버 updated_at
   * 와 동기화된 값으로 다음 hydrate 에서 재평가).
   */
  lastEditedAt: number | null;
  /**
   * 마지막 성공한 save 직후의 서버 invitations.updated_at (ISO 문자열).
   * 다음 hydrate 에서 page 의 serverUpdatedAt prop 과 비교해, 우리 마지막
   * 저장이 prop 이상이면 prop 이 Next.js Router Cache 의 stale 데이터일
   * 가능성이 높다고 보고 로컬을 유지한다 — 저장 → 미리보기 → 뒤로가기 시
   * 캐시된 옛 RSC 가 store 를 덮어쓰는 회귀 방지. init 시에도 함께 갱신.
   */
  lastSavedServerTs: string | null;

  init: (
    id: string,
    meta: EditorMeta,
    content: InvitationContent,
    serverUpdatedAt: string | null,
  ) => void;
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
      lastEditedAt: null,
      lastSavedServerTs: null,

      init: (id, meta, content, serverUpdatedAt) =>
        set({
          invitationId: id,
          meta,
          content,
          status: 'idle',
          lastError: null,
          unsaved: false,
          lastEditedAt: null,
          lastSavedServerTs: serverUpdatedAt,
        }),

      reset: () =>
        set({
          invitationId: null,
          meta: null,
          content: null,
          status: 'idle',
          lastError: null,
          unsaved: false,
          lastEditedAt: null,
          lastSavedServerTs: null,
        }),

      patchSection: (key, value) =>
        set((state) =>
          state.content
            ? {
                content: { ...state.content, [key]: value },
                status: 'dirty',
                unsaved: true,
                lastEditedAt: Date.now(),
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
                lastEditedAt: Date.now(),
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
          // PATCH 응답에서 서버 updated_at 을 받아 lastSavedServerTs 에 기록.
          // 다음 hydrate 가 이 값을 page 의 serverUpdatedAt prop 과 비교해
          // Router Cache 의 stale RSC 가 로컬을 덮어쓰는 사고를 막는다.
          const data = await res.json().catch(() => ({} as { invitation?: { updated_at?: string } }));
          const updatedAt = data?.invitation?.updated_at ?? null;
          // 저장 직후엔 lastEditedAt 도 함께 null 화 — 이 기기의 다음 마운트에서
          // 서버 updated_at 와 동률(혹은 더 작은) 상태가 되어 자연스럽게 서버
          // 데이터를 받아들이도록.
          set({
            status: 'saved',
            unsaved: false,
            lastEditedAt: null,
            lastSavedServerTs: updatedAt,
          });
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
        lastEditedAt: state.lastEditedAt,
        lastSavedServerTs: state.lastSavedServerTs,
      }),
    },
  ),
);
