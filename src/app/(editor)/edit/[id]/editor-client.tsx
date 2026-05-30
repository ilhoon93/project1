'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEditorStore } from '@/stores/editor';
import { InvitationContentSchema, type InvitationContent } from '@/types/invitation';
import { Button } from '@/components/ui/button';
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
  // 정책 (사용자 요청 — "저장된 게 있으면 무조건 그걸 우선"):
  //   1) 같은 청첩장 + 미저장 편집(unsaved=true) → 로컬 보존 (작업 중 손실 방지).
  //   2) 그 외 모든 경우(다른 청첩장 / 미저장 없음 / 신규) → 서버 데이터로 초기화.
  //
  // 즉, 로컬 캐시는 "지금 편집 중인" 변경분 보호 용도로만 쓴다. 저장 완료 후엔
  // 항상 서버에 저장된 본이 진실이다. Router Cache 의 stale RSC 문제는
  // EditorToolbar 가 save 직후 router.refresh() 를 호출해 따로 해결한다.
  //
  // 로컬 content 는 현재 스키마로 한 번 reparse 해 신규 필드도 기본값으로 채운다.
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const current = useEditorStore.getState();
    const sameInvitation =
      current.invitationId === invitationId && !!current.content;

    // (1) 미저장 편집이 있는 경우에만 로컬 보존.
    if (sameInvitation && current.unsaved && current.content) {
      if (keepLocalContent(current.content)) return;
    }

    // (2) 그 외 — 서버 데이터로 무조건 초기화 (로컬 캐시 덮어쓰기).
    init(invitationId, meta, content, serverUpdatedAt);
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
    <div className="text-[var(--wd-ink)]">
      {/* lg 이상에서는 좌측 실시간 미리보기 + 우측 컨트롤 2단 분할.
          미만은 기존 단일 컬럼 그대로. 상단바는 (editor)/layout 의 sticky 헤더가
          마케팅과 동일한 톤으로 처리.
          우측 컨트롤 컬럼 폭을 560 → 720px 로 확대 (xl 이상은 800px) — 콤보박스/
          토글 행이 더 여유 있게 들어가고 좌측 미리보기와의 비율도 자연스럽다. */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,720px)] lg:gap-8 lg:px-8 lg:py-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,800px)] xl:gap-10 xl:px-12">
        {/* ── 좌측: 실시간 미리보기 (lg+ 전용) ───────────────────── */}
        <aside className="hidden lg:flex lg:sticky lg:top-[calc(57px+1.5rem)] lg:h-[calc(100vh-57px-3rem)] lg:items-center lg:justify-center">
          <EditorLivePreview invitationId={invitationId} />
        </aside>

        {/* ── 우측 (mobile: 단일 컬럼): 탭 + 에디터 컨트롤 ─────── */}
        <div className="flex min-w-0 flex-col">
          <div className="sticky top-[57px] z-10 -mx-0 border-b border-[var(--wd-line)] bg-[var(--wd-paper)]/85 backdrop-blur lg:top-0 lg:rounded-md lg:border lg:border-[var(--wd-line)] lg:bg-[var(--wd-paper)]">
            <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-3 lg:max-w-none">
              {/* 좌측: 탭 + (entitlement 배지) */}
              <div className="flex min-w-0 items-center gap-1">
                <TabButton selected={tab === 'edit'} onClick={() => setTab('edit')}>
                  기본 편집
                </TabButton>
                <TabButton selected={tab === 'ai'} onClick={() => setTab('ai')}>
                  AI 이미지
                  {entitlements?.aiSnap && <PackageBadge>스냅 ✓</PackageBadge>}
                </TabButton>
                {entitlements?.aiVideo && (
                  <span className="ml-2 hidden rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200 sm:inline-block">
                    AI 영상 잠금해제
                  </span>
                )}
                {entitlements?.familyPack && (
                  <span className="ml-1 hidden rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200 sm:inline-block">
                    가족 패키지
                  </span>
                )}
              </div>

              {/* 우측: 저장 상태 + 저장 / 미리보기 액션 */}
              <EditorActions invitationId={invitationId} />
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

/**
 * 로컬 content 를 현재 스키마로 reparse 해서 신규 필드 기본값을 채운 뒤 store 에
 * 반영. 스키마와 안 맞으면 false 를 돌려 호출 측이 서버 데이터로 폴백하게 한다.
 */
function keepLocalContent(content: InvitationContent): boolean {
  try {
    const reparsed = InvitationContentSchema.parse(content);
    if (JSON.stringify(reparsed) !== JSON.stringify(content)) {
      useEditorStore.setState({ content: reparsed });
    }
    return true;
  } catch {
    return false;
  }
}

function PackageBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700 ring-1 ring-emerald-200">
      {children}
    </span>
  );
}

const STATUS_LABEL = {
  idle: '',
  dirty: '저장 안 됨',
  saving: '저장 중...',
  saved: '저장됨',
  error: '저장 실패',
} as const;

const STATUS_COLOR = {
  idle: 'text-[var(--wd-mute)]',
  dirty: 'text-amber-600',
  saving: 'text-[var(--wd-mute)]',
  saved: 'text-emerald-600',
  error: 'text-red-600',
} as const;

/**
 * 탭 strip 우측에 정렬되는 에디터 액션 — 상태 / 저장 / 미리보기.
 * 기존 EditorToolbar 의 로직(저장 race, preview 캐시 무효화) 그대로 이식.
 */
function EditorActions({ invitationId }: { invitationId: string }) {
  const status = useEditorStore((s) => s.status);
  const save = useEditorStore((s) => s.save);
  const lastError = useEditorStore((s) => s.lastError);
  const router = useRouter();
  const [navigating, setNavigating] = useState(false);

  const handlePreview = async () => {
    if (navigating) return;
    if (status === 'dirty') {
      const ok = window.confirm(
        '저장하지 않은 변경사항이 있어요. 미리보기에는 저장된 내용만 반영됩니다. 그래도 미리보기로 이동할까요?',
      );
      if (!ok) return;
    }
    setNavigating(true);
    while (useEditorStore.getState().status === 'saving') {
      await new Promise((r) => setTimeout(r, 50));
    }
    router.refresh();
    router.push(`/preview/${invitationId}?t=${Date.now()}`);
  };

  return (
    <div className="flex flex-shrink-0 items-center gap-2">
      <span
        className={`hidden text-[11px] sm:inline-block ${STATUS_COLOR[status]}`}
        title={lastError ?? undefined}
      >
        {STATUS_LABEL[status]}
      </span>
      <Button
        variant="default"
        size="sm"
        onClick={async () => {
          await save();
          if (useEditorStore.getState().status === 'saved') {
            router.refresh();
          }
        }}
        disabled={status === 'saving' || status === 'idle' || status === 'saved'}
      >
        저장
      </Button>
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
          ? 'font-medium text-[var(--wd-ink)]'
          : 'text-[var(--wd-mute)] hover:text-[var(--wd-ink)]'
      }`}
    >
      {children}
      {selected && (
        <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[var(--wd-coral)]" />
      )}
    </button>
  );
}
