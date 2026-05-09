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
  /** 서버 invitations.updated_at — 로컬 lastEditedAt 와 비교해 어느 쪽이 최신인지 판정. */
  serverUpdatedAt: string | null;
}

// 자동 저장 주기를 길게 가져간다 — 사용자는 수동 "저장" 버튼이 주된 경로이고,
type Tab = 'edit' | 'ai';

export function EditorClient({
  invitationId,
  meta,
  content,
  serverUpdatedAt,
}: Props) {
  const init = useEditorStore((s) => s.init);
  const status = useEditorStore((s) => s.status);
  const [tab, setTab] = useState<Tab>('edit');

  // Hydrate the store with server-provided data on first mount.
  //
  // 정책 (다른 기기 ↔ 같은 기기 모두 정확히 처리):
  //   1) 청첩장 ID 가 다르거나 로컬에 데이터가 없음 → 서버 데이터로 초기화.
  //   2) 같은 청첩장 + 미저장 편집(unsaved=true) 이면 로컬 lastEditedAt 와 서버
  //      updated_at 을 비교:
  //        - 서버가 더 최신 → 다른 기기에서 저장된 내용이 있음 → 서버 우선.
  //          (이 기기의 미저장 편집은 폐기. 일반적으로 원치 않는 손실이지만,
  //           "수정한 게 즉시 보여야 한다" 는 사용자 요구가 더 우선.)
  //        - 로컬이 더 최신 → /preview 다녀온 케이스 등 → 로컬 보존.
  //   3) 같은 청첩장 + 저장 완료(unsaved=false) → 서버 데이터로 초기화.
  //
  // 로컬 content 는 현재 스키마로 한 번 reparse 해 신규 필드도 기본값으로 채운다.
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const current = useEditorStore.getState();
    const sameInvitation = current.invitationId === invitationId && current.content;

    if (sameInvitation && current.unsaved) {
      const localTs = current.lastEditedAt ?? 0;
      const serverTs = serverUpdatedAt ? new Date(serverUpdatedAt).getTime() : 0;
      // 시계 어긋남(기기간) 보정 — 1 분 이내 동률은 로컬 우선 (사용자 작업 보호).
      const localIsNewer = localTs > serverTs + 60_000;
      if (localIsNewer) {
        try {
          const reparsed = InvitationContentSchema.parse(current.content);
          if (JSON.stringify(reparsed) !== JSON.stringify(current.content)) {
            useEditorStore.setState({ content: reparsed });
          }
          return;
        } catch {
          // 로컬 데이터가 스키마와 맞지 않으면 안전하게 서버 데이터로 폴백.
        }
      }
    }
    // 신규 청첩장 / 저장 완료 / 서버가 더 최신 → 모두 서버 데이터로 초기화.
    init(invitationId, meta, content);
  }, [invitationId, meta, content, init, serverUpdatedAt]);

  // 자동 저장 제거 — 사용자 의도와 무관하게 저장이 일어나는 문제 때문에 전부 빼고
  // "저장" 버튼 클릭 시에만 PATCH 가 발생하도록 한다. 미저장 변경은 beforeunload
  // 경고 + status 표시("저장 안 됨") 로 사용자에게 알림.

  // 보유 패키지 entitlement — AI/가족 탭 노출 분기 기준.
  // AI 이미지 탭은 ai_snap 미보유 사용자에게도 "무료 1회" 가 있어 항상 보이지만,
  // ai_video / family 같이 동작하는 기능 미구현 패키지는 잠금 해제 시에만 노출.
  const [entitlements, setEntitlements] = useState<{
    aiSnap: boolean;
    aiVideo: boolean;
    familyPack: boolean;
  } | null>(null);
  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const res = await fetch('/api/me/entitlements');
        if (!res.ok) return;
        const data = await res.json();
        if (canceled) return;
        setEntitlements({
          aiSnap: !!data.aiSnap,
          aiVideo: !!data.aiVideo,
          familyPack: !!data.familyPack,
        });
      } catch {
        // 401/네트워크 오류는 entitlements null 그대로 — 기본 동작 (AI 1회 무료) 유지.
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

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
            <div className="mx-auto flex max-w-2xl items-center gap-1 px-4 lg:max-w-none lg:px-3">
              <TabButton selected={tab === 'edit'} onClick={() => setTab('edit')}>
                기본 편집
              </TabButton>
              <TabButton selected={tab === 'ai'} onClick={() => setTab('ai')}>
                AI 이미지
                {entitlements?.aiSnap && <PackageBadge>스냅 ✓</PackageBadge>}
              </TabButton>
              {entitlements?.aiVideo && (
                <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                  AI 영상 잠금해제
                </span>
              )}
              {entitlements?.familyPack && (
                <span className="ml-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                  가족 패키지
                </span>
              )}
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

function PackageBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700 ring-1 ring-emerald-200">
      {children}
    </span>
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
