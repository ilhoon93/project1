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
              <EditorActions invitationId={invitationId} />
            </div>
          </div>

          <main className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 py-6 pb-32 lg:max-w-none lg:px-0 lg:py-4">
            <ThemeEditor />
            <SectionList />
          </main>
        </div>
      </div>
    </div>
  );
}

/**
 * 섹션 카드 목록 — 저장된 pageOrder 순서대로 렌더하고, 카드를 드래그앤드롭으로
 * 재배치한다. 메인은 항상 맨 위, 엔딩은 항상 맨 아래로 고정하며 그 사이 섹션만
 * 순서를 바꿀 수 있다. (카드가 닫혀 있을 때만 드래그 가능 — SectionEditor 처리.)
 */
function SectionList() {
  const theme = useEditorStore((s) => s.content?.theme);
  const patch = useEditorStore((s) => s.patchSection);
  const [dragKey, setDragKey] = useState<SectionKey | null>(null);
  const [overKey, setOverKey] = useState<SectionKey | null>(null);

  const order = theme ? reconcilePageOrder(theme.pageOrder) : [];
  // 메인 고정 최상단 · 엔딩 고정 최하단. 그 사이만 이동 대상.
  const movable = order.filter((k) => !FIXED_SECTIONS.has(k));

  // window 포인터 리스너는 안정적인 함수로 한 번만 붙이므로, 최신 순서/패치를
  // ref 로 들고 있어 stale closure 없이 드롭 시점의 값으로 재배치한다.
  const reorderRef = useRef<(from: SectionKey, to: SectionKey) => void>(() => {});
  reorderRef.current = (from, to) => {
    if (from === to || !theme || FIXED_SECTIONS.has(from) || FIXED_SECTIONS.has(to)) return;
    const next = [...movable];
    const fi = next.indexOf(from);
    if (fi < 0) return;
    next.splice(fi, 1);
    const ti = next.indexOf(to);
    if (ti < 0) return;
    next.splice(ti, 0, from);
    patch('theme', { ...theme, pageOrder: ['main', ...next, 'closing'] });
  };

  const dragKeyRef = useRef<SectionKey | null>(null);

  // 화면 좌표 아래에 있는 (이동 가능한) 섹션 키. 고정 섹션/카드 밖은 null.
  const sectionAtPoint = (x: number, y: number): SectionKey | null => {
    const el = document.elementFromPoint(x, y);
    const card = el?.closest('[data-section-key]');
    const key = (card?.getAttribute('data-section-key') as SectionKey | null) ?? null;
    return key && !FIXED_SECTIONS.has(key) ? key : null;
  };

  const handleMove = useCallback((e: globalThis.PointerEvent) => {
    if (!dragKeyRef.current) return;
    setOverKey(sectionAtPoint(e.clientX, e.clientY));
  }, []);

  const handleUp = useCallback(
    (e: globalThis.PointerEvent) => {
      const from = dragKeyRef.current;
      if (from) {
        const to = sectionAtPoint(e.clientX, e.clientY);
        if (to) reorderRef.current(from, to);
      }
      dragKeyRef.current = null;
      setDragKey(null);
      setOverKey(null);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    },
    [handleMove],
  );

  const startDrag = useCallback(
    (key: SectionKey) => {
      dragKeyRef.current = key;
      setDragKey(key);
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
      window.addEventListener('pointercancel', handleUp);
    },
    [handleMove, handleUp],
  );

  // 드래그 도중 언마운트되면 리스너 정리.
  useEffect(
    () => () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    },
    [handleMove, handleUp],
  );

  if (!theme) return null;

  const rendered: SectionKey[] = ['main', ...movable, 'closing'];

  return (
    <>
      {rendered.map((key) => {
        const Editor = SECTION_EDITORS[key];
        const fixed = FIXED_SECTIONS.has(key);
        return (
          <Editor
            key={key}
            drag={{
              enabled: !fixed,
              sectionKey: key,
              dragging: dragKey === key,
              dragOver: overKey === key && dragKey !== null && dragKey !== key,
              onDragStart: () => startDrag(key),
            }}
          />
        );
      })}
    </>
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

