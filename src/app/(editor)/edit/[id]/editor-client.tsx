'use client';

import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { useRouter } from 'next/navigation';
import { useEditorStore } from '@/stores/editor';
import { InvitationContentSchema, type InvitationContent } from '@/types/invitation';
import { reconcilePageOrder, type SectionKey } from '@/lib/theme';
import { Button } from '@/components/ui/button';
import type { SectionDragProps } from '@/components/editor/SectionEditor';
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
import { EditorMobilePreview } from '@/components/editor/EditorMobilePreview';

type SectionEditorComponent = ComponentType<{ drag?: SectionDragProps }>;

const SECTION_EDITORS: Record<SectionKey, SectionEditorComponent> = {
  main: MainEditor,
  basic: BasicInfoEditor,
  story: StoryEditor,
  gallery: GalleryEditor,
  video: VideoEditor,
  quiz: QuizEditor,
  vote: VoteEditor,
  guestbook: GuestbookEditor,
  account: AccountEditor,
  closing: ClosingEditor,
};

// 메인/엔딩은 위치 고정 — 드래그앤드롭으로 옮길 수 없다.
const FIXED_SECTIONS: ReadonlySet<SectionKey> = new Set<SectionKey>(['main', 'closing']);

interface Props {
  invitationId: string;
  meta: { groomName: string; brideName: string; weddingDate: string | null };
  content: InvitationContent;
  /** 서버 invitations.updated_at — 로컬 lastEditedAt 와 비교해 어느 쪽이 최신인지 판정. */
  serverUpdatedAt: string | null;
}

export function EditorClient({
  invitationId,
  meta,
  content,
  serverUpdatedAt,
}: Props) {
  const init = useEditorStore((s) => s.init);
  const status = useEditorStore((s) => s.status);

  // Hydrate the store with server-provided data on first mount.
  //
  // 정책 (사용자 요청 — "저장된 게 있으면 무조건 그걸 우선"):
  //   1) 같은 청첩장 + 미저장 편집(unsaved=true) → 로컬 보존 (작업 중 손실 방지).
  //   2) 그 외 모든 경우(다른 청첩장 / 미저장 없음 / 신규) → 서버 데이터로 초기화.
  //
  // 즉, 로컬 캐시는 "지금 편집 중인" 변경분 보호 용도로만 쓴다. 저장 완료 후엔
  // 항상 서버에 저장된 본이 진실이다. Router Cache 의 stale RSC 문제는
  // EditorActions 가 save 직후 router.refresh() 를 호출해 따로 해결한다.
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
          마케팅과 동일한 톤으로 처리. */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,720px)] lg:gap-8 lg:px-8 lg:py-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,800px)] xl:gap-10 xl:px-12">
        {/* ── 좌측: 실시간 미리보기 (lg+ 전용) ───────────────────── */}
        <aside className="hidden lg:flex lg:sticky lg:top-[calc(57px+1.5rem)] lg:h-[calc(100vh-57px-3rem)] lg:items-center lg:justify-center">
          <EditorLivePreview invitationId={invitationId} />
        </aside>

        {/* ── 우측 (mobile: 단일 컬럼): "기본 편집" 단일 모드 헤더 + 컨트롤 ─── */}
        <div className="flex min-w-0 flex-col">
          {/* AI 이미지 탭 제거 — 좌측에 라벨, 우측에 액션(저장/미리보기) 만. */}
          <div className="sticky top-[57px] z-10 -mx-0 border-b border-[var(--wd-line)] bg-[var(--wd-paper)]/85 backdrop-blur lg:top-0 lg:rounded-md lg:border lg:border-[var(--wd-line)] lg:bg-[var(--wd-paper)]">
            <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-3 py-2 lg:max-w-none">
              <span className="text-sm font-medium text-[var(--wd-ink)]">기본 편집</span>
              <EditorActions />
            </div>
          </div>

          <main className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 py-6 pb-32 lg:max-w-none lg:px-0 lg:py-4">
            <ThemeEditor />
            <SectionList />
          </main>
        </div>
      </div>

      {/* 모바일/태블릿 전용 실시간 미리보기 (플로팅 버튼 + 전체화면 오버레이).
          데스크톱은 좌측 고정 패널이 담당하므로 컴포넌트 내부에서 lg:hidden 처리. */}
      <EditorMobilePreview invitationId={invitationId} />
    </div>
  );
}

/**
 * 섹션 카드 목록 — 저장된 pageOrder 순서대로 렌더하고, 카드를 드래그앤드롭으로
 * 재배치한다. 메인은 항상 맨 위, 엔딩은 항상 맨 아래로 고정하며 그 사이 섹션만
 * 순서를 바꿀 수 있다. (카드가 닫혀 있을 때만 드래그 가능 — SectionEditor 처리.)
 */
/** 드래그 중 화면에 떠서 포인터를 따라다니는 카드 클론의 상태. */
interface DragState {
  from: SectionKey;
  /** 포인터를 잡은 지점의 카드 내부 오프셋 — 클론이 손가락에 붙어 움직이도록. */
  offsetX: number;
  offsetY: number;
  width: number;
  /** 원본 카드의 outerHTML 스냅샷 — 그대로 떠 있는 클론으로 렌더. */
  html: string;
  /** 클론 첫 렌더 시 깜빡임 방지를 위한 초기 위치. */
  startLeft: number;
  startTop: number;
}

function SectionList() {
  const theme = useEditorStore((s) => s.content?.theme);
  const patch = useEditorStore((s) => s.patchSection);
  const [dragKey, setDragKey] = useState<SectionKey | null>(null);
  // 드래그 중인 카드가 들어갈 위치 표시줄의 화면 좌표. null=드래그 안 함/표시 안 함.
  const [indicator, setIndicator] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );

  const order = theme ? reconcilePageOrder(theme.pageOrder) : [];
  // 메인 고정 최상단 · 엔딩 고정 최하단. 그 사이만 이동 대상.
  const movable = order.filter((k) => !FIXED_SECTIONS.has(k));

  // window 포인터 리스너는 안정적인 함수로 한 번만 붙이므로, 최신 순서/패치를
  // ref 로 들고 있어 stale closure 없이 드롭 시점의 값으로 동작한다.
  const reorderRef = useRef<(from: SectionKey, index: number) => void>(() => {});
  reorderRef.current = (from, index) => {
    if (!theme) return;
    const cur = [...movable];
    const fromIdx = cur.indexOf(from);
    if (fromIdx < 0) return;
    cur.splice(fromIdx, 1);
    // 앞쪽 항목을 빼냈으면 목표 인덱스가 하나 당겨진다.
    let target = fromIdx < index ? index - 1 : index;
    target = Math.max(0, Math.min(cur.length, target));
    cur.splice(target, 0, from);
    const nextOrder: SectionKey[] = ['main', ...cur, 'closing'];
    if (nextOrder.join() === order.join()) return; // 제자리 드롭 — 변경 없음.
    patch('theme', { ...theme, pageOrder: nextOrder });
  };

  const dragRef = useRef<DragState | null>(null);
  const cloneRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const insertIndexRef = useRef<number | null>(null);

  // 클론 transform 은 style prop 이 아니라 ref 로 직접 제어한다(매 re-render 마다
  // React 가 style prop 값으로 되돌리는 것을 피함). 첫 마운트 시 콜백 ref 가
  // 시작 위치를 한 번 세팅 → 깜빡임 없음. 이후 pointermove 가 직접 갱신.
  const cloneCallbackRef = useCallback((node: HTMLDivElement | null) => {
    cloneRef.current = node;
    const st = dragRef.current;
    if (node && st) {
      node.style.transform = `translate(${st.startLeft}px, ${st.startTop}px)`;
    }
  }, []);

  // 포인터 Y 가 떨어질 movable 인덱스와, 그 자리에 그릴 표시줄의 화면 좌표를 함께
  // 계산. 표시줄은 fixed 로 띄워(레이아웃에 영향 X) 카드가 밀리며 인덱스가 떨리는
  // 현상을 막는다. main/closing 은 data-section-key 가 없어 자동 제외된다.
  const computePlacement = useCallback(
    (y: number): { idx: number; top: number; left: number; width: number } | null => {
      const root = listRef.current;
      if (!root) return null;
      const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-section-key]'));
      if (cards.length === 0) return null;
      const rects = cards.map((c) => c.getBoundingClientRect());
      let idx = rects.length;
      for (let i = 0; i < rects.length; i++) {
        if (y < rects[i].top + rects[i].height / 2) {
          idx = i;
          break;
        }
      }
      const { left, width } = rects[0];
      let top: number;
      if (idx === 0) top = rects[0].top - 6;
      else if (idx === rects.length) top = rects[rects.length - 1].bottom + 6;
      else top = (rects[idx - 1].bottom + rects[idx].top) / 2;
      return { idx, top, left, width };
    },
    [],
  );

  const updateIndicator = useCallback(
    (y: number) => {
      const p = computePlacement(y);
      if (!p) return;
      // 인덱스가 바뀔 때만 표시줄 위치 갱신(레이아웃 불변이라 같은 인덱스면 위치도 동일).
      if (p.idx !== insertIndexRef.current) {
        insertIndexRef.current = p.idx;
        setIndicator({ top: p.top, left: p.left, width: p.width });
      }
    },
    [computePlacement],
  );

  const handleMove = useCallback(
    (e: globalThis.PointerEvent) => {
      const st = dragRef.current;
      if (!st) return;
      if (cloneRef.current) {
        cloneRef.current.style.transform = `translate(${e.clientX - st.offsetX}px, ${
          e.clientY - st.offsetY
        }px)`;
      }
      updateIndicator(e.clientY);
    },
    [updateIndicator],
  );

  const cleanupListeners = useCallback(
    (move: typeof handleMove, up: (e: globalThis.PointerEvent) => void) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    },
    [],
  );

  const handleUp = useCallback(
    (e: globalThis.PointerEvent) => {
      const st = dragRef.current;
      if (st) {
        const p = computePlacement(e.clientY);
        if (p) reorderRef.current(st.from, p.idx);
      }
      dragRef.current = null;
      insertIndexRef.current = null;
      setDragKey(null);
      setIndicator(null);
      cleanupListeners(handleMove, handleUp);
    },
    [handleMove, computePlacement, cleanupListeners],
  );

  const startDrag = useCallback(
    (key: SectionKey, clientX: number, clientY: number) => {
      const el = listRef.current?.querySelector<HTMLElement>(
        `[data-section-key="${key}"]`,
      );
      if (!el) return;
      const rect = el.getBoundingClientRect();
      dragRef.current = {
        from: key,
        offsetX: clientX - rect.left,
        offsetY: clientY - rect.top,
        width: rect.width,
        html: el.outerHTML,
        startLeft: rect.left,
        startTop: rect.top,
      };
      setDragKey(key);
      updateIndicator(clientY);
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
      window.addEventListener('pointercancel', handleUp);
    },
    [handleMove, handleUp, updateIndicator],
  );

  // 드래그 도중 언마운트되면 리스너 정리.
  useEffect(() => () => cleanupListeners(handleMove, handleUp), [handleMove, handleUp, cleanupListeners]);

  if (!theme) return null;

  const renderSection = (key: SectionKey) => {
    const Editor = SECTION_EDITORS[key];
    const fixed = FIXED_SECTIONS.has(key);
    return (
      <Editor
        key={key}
        drag={{
          enabled: !fixed,
          sectionKey: key,
          dragging: dragKey === key,
          onDragStart: (x, y) => startDrag(key, x, y),
        }}
      />
    );
  };

  const drag = dragRef.current;

  return (
    <>
      {/* display:contents — 래퍼가 박스를 만들지 않아 카드들이 부모 flex 의 gap 을
          그대로 받는다. 동시에 querySelector 범위를 카드 목록으로 한정해 클론을 제외. */}
      <div ref={listRef} className="contents">
        {renderSection('main')}
        {movable.map((key) => renderSection(key))}
        {renderSection('closing')}
      </div>

      {/* 들어갈 위치 표시줄 — fixed 로 띄워 카드 레이아웃을 건드리지 않는다(떨림 방지). */}
      {dragKey && indicator && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-40 -translate-y-1/2"
          style={{ top: indicator.top, left: indicator.left, width: indicator.width }}
        >
          <DropLine />
        </div>
      )}

      {/* 포인터를 따라 떠다니는 카드 클론 — 원본은 자리에서 흐려진 placeholder 로 남는다. */}
      {dragKey && drag && (
        <div
          ref={cloneCallbackRef}
          aria-hidden
          className="pointer-events-none fixed left-0 top-0 z-50 rotate-1 opacity-95 drop-shadow-xl"
          style={{ width: drag.width }}
          dangerouslySetInnerHTML={{ __html: drag.html }}
        />
      )}
    </>
  );
}

/** 카드가 들어갈 위치를 보여주는 가로 인디케이터 라인(좌측 점 + 바). */
function DropLine() {
  return (
    <div className="relative h-0.5 rounded-full bg-primary">
      <span className="absolute -left-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-primary shadow-sm" />
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
function EditorActions() {
  const status = useEditorStore((s) => s.status);
  const save = useEditorStore((s) => s.save);
  const lastError = useEditorStore((s) => s.lastError);
  const router = useRouter();

  // 모바일 미리보기는 EditorMobilePreview 의 플로팅 버튼 + 실시간 오버레이가
  // 담당한다 (저장본으로 이동하던 기존 버튼을 대체 — 편집 중 변경분을 즉시 확인).

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
    </div>
  );
}

