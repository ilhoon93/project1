'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { GripVertical } from 'lucide-react';
import { useEditorStore } from '@/stores/editor';
import { createClient } from '@/lib/supabase/client';
import { nanoid } from '@/lib/utils/nanoid';
import { GALLERY_LAYOUTS, type GalleryImageFit } from '@/types/invitation';
import { SectionEditor, type SectionDragProps } from '../SectionEditor';
import { SectionHeaderFields } from './SectionHeaderFields';
import { Button } from '@/components/ui/button';
import {
  IMAGE_LIMITS,
  compressImage,
  validateImageFile,
} from '@/lib/uploads';

const IMAGE_FIT_OPTIONS: { key: GalleryImageFit; name: string; hint: string }[] = [
  { key: 'cover', name: '채우기', hint: '가득 채움(잘림)' },
  { key: 'contain', name: '전체보기', hint: '잘림 없이' },
];

const LAYOUT_LABEL: Record<(typeof GALLERY_LAYOUTS)[number], { name: string; hint: string }> = {
  grid: { name: '그리드', hint: '바둑판 형태' },
  slide: { name: '슬라이드', hint: '가로 스크롤' },
};

export function GalleryEditor({ drag }: { drag?: SectionDragProps }) {
  const gallery = useEditorStore((s) => s.content?.gallery);
  const invitationId = useEditorStore((s) => s.invitationId);
  const patch = useEditorStore((s) => s.patchSection);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── 사진 드래그앤드롭 재정렬 (마우스·터치 공통, 포인터 이벤트) ─────────────
  // 섹션 카드 재배치와 같은 철학: 원본은 자리에서 흐려지고, 포인터를 따라다니는
  // 클론이 떠 있으며, 드롭 대상 타일은 링으로 강조. 실제 순서 변경은 드롭 시점에
  // 한 번만 commit 해 드래그 중 레이아웃이 흔들리지 않게 한다.
  const gridRef = useRef<HTMLUListElement>(null);
  const cloneRef = useRef<HTMLDivElement | null>(null);
  const dragMetaRef = useRef<{
    from: number;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
    startLeft: number;
    startTop: number;
  } | null>(null);
  const overIndexRef = useRef<number | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  // 드롭 시점의 최신 이미지/patch 를 stale closure 없이 참조 (window 리스너는
  // 안정적인 함수라 한 번만 붙는다).
  const reorderRef = useRef<(from: number, to: number) => void>(() => {});
  reorderRef.current = (from, to) => {
    const cur = useEditorStore.getState().content?.gallery;
    if (!cur) return;
    if (from === to || from < 0 || to < 0) return;
    if (from >= cur.images.length || to >= cur.images.length) return;
    const list = [...cur.images];
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    patch('gallery', { ...cur, images: list });
  };

  // 포인터가 얹힌 타일 인덱스(여백이면 중심이 가장 가까운 타일).
  const computeOver = useCallback((x: number, y: number): number | null => {
    const root = gridRef.current;
    if (!root) return null;
    const tiles = Array.from(root.querySelectorAll<HTMLElement>('[data-tile]'));
    if (tiles.length === 0) return null;
    for (let i = 0; i < tiles.length; i++) {
      const r = tiles[i].getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
    }
    let best: number | null = null;
    let bestD = Infinity;
    for (let i = 0; i < tiles.length; i++) {
      const r = tiles[i].getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const d = (x - cx) ** 2 + (y - cy) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }, []);

  const handleMove = useCallback(
    (e: globalThis.PointerEvent) => {
      const meta = dragMetaRef.current;
      if (!meta) return;
      if (cloneRef.current) {
        cloneRef.current.style.transform = `translate(${e.clientX - meta.offsetX}px, ${
          e.clientY - meta.offsetY
        }px)`;
      }
      const idx = computeOver(e.clientX, e.clientY);
      if (idx !== overIndexRef.current) {
        overIndexRef.current = idx;
        setOverIndex(idx);
      }
    },
    [computeOver],
  );

  const handleUp = useCallback(
    (e: globalThis.PointerEvent) => {
      const meta = dragMetaRef.current;
      if (meta) {
        const idx = computeOver(e.clientX, e.clientY);
        if (idx !== null) reorderRef.current(meta.from, idx);
      }
      dragMetaRef.current = null;
      overIndexRef.current = null;
      setDragFrom(null);
      setOverIndex(null);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    },
    [computeOver, handleMove],
  );

  const startDrag = useCallback(
    (index: number, el: HTMLElement, clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect();
      dragMetaRef.current = {
        from: index,
        offsetX: clientX - rect.left,
        offsetY: clientY - rect.top,
        width: rect.width,
        height: rect.height,
        startLeft: rect.left,
        startTop: rect.top,
      };
      overIndexRef.current = index;
      setDragFrom(index);
      setOverIndex(index);
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
      window.addEventListener('pointercancel', handleUp);
    },
    [handleMove, handleUp],
  );

  // 클론 첫 렌더 위치를 즉시 세팅해 깜빡임 방지 — 이후 pointermove 가 직접 갱신.
  const cloneCallbackRef = useCallback((node: HTMLDivElement | null) => {
    cloneRef.current = node;
    const meta = dragMetaRef.current;
    if (node && meta) {
      node.style.transform = `translate(${meta.startLeft}px, ${meta.startTop}px)`;
    }
  }, []);

  // 드래그 도중 언마운트되면 리스너 정리.
  useEffect(
    () => () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    },
    [handleMove, handleUp],
  );

  if (!gallery || !invitationId) return null;

  const handleGripDown = (index: number) => (e: ReactPointerEvent) => {
    // 마우스는 좌클릭만. 터치/펜은 그대로 시작.
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    const tile = (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-tile]');
    if (tile) startDrag(index, tile, e.clientX, e.clientY);
  };

  const handleFiles = async (files: FileList) => {
    setErrorMsg(null);
    const remaining = 20 - gallery.images.length;
    if (remaining <= 0) {
      setErrorMsg('이미지는 최대 20장까지 업로드 가능합니다.');
      return;
    }
    const valid: File[] = [];
    for (const f of Array.from(files).slice(0, remaining)) {
      const v = validateImageFile(f);
      if (!v.ok) {
        setErrorMsg(v.message);
        return;
      }
      valid.push(v.file);
    }

    setBusy({ done: 0, total: valid.length });
    const supabase = createClient();
    const uploaded: string[] = [];
    try {
      for (let i = 0; i < valid.length; i++) {
        const file = await compressImage(valid[i]);
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const path = `invitations/${invitationId}/gallery/${nanoid(10)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('public-images')
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) {
          setErrorMsg(`업로드 실패: ${upErr.message}`);
          break;
        }
        const { data } = supabase.storage.from('public-images').getPublicUrl(path);
        if (data?.publicUrl) uploaded.push(data.publicUrl);
        setBusy({ done: i + 1, total: valid.length });
      }
      if (uploaded.length > 0) {
        patch('gallery', { ...gallery, images: [...gallery.images, ...uploaded] });
      }
    } finally {
      setBusy(null);
    }
  };

  const removeAt = (i: number) => {
    const next = gallery.images.filter((_, idx) => idx !== i);
    patch('gallery', { ...gallery, images: next });
  };

  return (
    <SectionEditor
      drag={drag}
      title="갤러리"
      description="둘이 함께한 사진들 (최대 20장)"
      toggle={{
        enabled: gallery.enabled,
        onChange: (next) => patch('gallery', { ...gallery, enabled: next }),
      }}
    >
      <div className="flex flex-col gap-4">
        <SectionHeaderFields sectionKey="gallery" />
        {/* 레이아웃 선택 */}
        <div className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-foreground">레이아웃</span>
          <div className="grid grid-cols-2 gap-2">
            {GALLERY_LAYOUTS.map((key) => {
              const selected = gallery.layout === key;
              const meta = LAYOUT_LABEL[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => patch('gallery', { ...gallery, layout: key })}
                  aria-pressed={selected}
                  className={`flex flex-col items-center gap-1 rounded-md border px-3 py-3 text-xs transition-colors ${
                    selected
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-input bg-background text-foreground hover:bg-muted'
                  }`}
                >
                  <span className="font-medium">{meta.name}</span>
                  <span className={selected ? 'opacity-80' : 'text-muted-foreground'}>
                    {meta.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 사진 표시 방식 — 갤러리 전체 일괄 적용 */}
        <div className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-foreground">사진 표시 방식</span>
          <div className="grid grid-cols-2 gap-2">
            {IMAGE_FIT_OPTIONS.map(({ key, name, hint }) => {
              const selected = (gallery.imageFit ?? 'cover') === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => patch('gallery', { ...gallery, imageFit: key })}
                  aria-pressed={selected}
                  className={`flex flex-col items-center gap-1 rounded-md border px-3 py-3 text-xs transition-colors ${
                    selected
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-input bg-background text-foreground hover:bg-muted'
                  }`}
                >
                  <span className="font-medium">{name}</span>
                  <span className={selected ? 'opacity-80' : 'text-muted-foreground'}>
                    {hint}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">
            전체보기는 사진을 잘리지 않게 보여주고, 남는 여백은 같은 사진의 흐린 배경으로
            채웁니다.
          </p>
        </div>

        {/* 확대 보기 — 전체화면에서 핀치 줌/더블탭으로 더 크게 볼 수 있게 */}
        <div className="flex items-start justify-between gap-3 rounded-md border bg-background p-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">사진 확대 보기</span>
            <span className="text-[11px] text-muted-foreground">
              전체화면에서 ＋ 버튼·손가락(핀치)·더블탭으로 사진을 더 크게 볼 수 있어요.
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={gallery.allowZoom ?? false}
            aria-label="사진 확대 보기 사용 여부"
            onClick={() => patch('gallery', { ...gallery, allowZoom: !(gallery.allowZoom ?? false) })}
            className={`mt-0.5 inline-flex h-5 w-9 shrink-0 items-center overflow-hidden rounded-full p-0.5 transition-colors ${
              (gallery.allowZoom ?? false) ? 'bg-primary' : 'bg-muted-foreground/30'
            }`}
          >
            <span
              className={`block h-4 w-4 rounded-full bg-background shadow-sm transition-transform ${
                (gallery.allowZoom ?? false) ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* 업로더 */}
        <input
          ref={inputRef}
          type="file"
          accept={IMAGE_LIMITS.acceptMime.join(',')}
          multiple
          className="hidden"
          onChange={(e) => {
            const fs = e.target.files;
            if (fs && fs.length > 0) void handleFiles(fs);
            e.target.value = '';
          }}
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!!busy || gallery.images.length >= 20}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? `압축·업로드 중 (${busy.done}/${busy.total})` : '사진 추가'}
          </Button>
          <span className="text-xs text-muted-foreground">
            {gallery.images.length} / 20
          </span>
        </div>

        <p className="text-xs text-muted-foreground">
          {IMAGE_LIMITS.acceptExtLabel}, 한 장당 최대 {IMAGE_LIMITS.maxInputBytes / 1024 / 1024}MB · 자동 압축
        </p>

        {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}

        {gallery.images.length > 1 && (
          <p className="text-xs text-muted-foreground">
            좌측 상단 손잡이를 잡고 드래그해 순서를 바꿀 수 있어요.
          </p>
        )}

        {gallery.images.length > 0 && (
          <ul ref={gridRef} className="grid grid-cols-3 gap-2">
            {gallery.images.map((url, i) => {
              const isDragging = dragFrom === i;
              const isOver =
                dragFrom !== null && overIndex === i && overIndex !== dragFrom;
              return (
                <li
                  key={`${url}-${i}`}
                  data-tile
                  className={`relative aspect-square overflow-hidden rounded-md transition-[opacity,box-shadow] ${
                    isDragging ? 'opacity-30' : ''
                  } ${isOver ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    draggable={false}
                    className="h-full w-full object-cover"
                  />
                  {/* 드래그 손잡이 (좌상단) — touch-none 으로 터치 스크롤과 충돌 방지 */}
                  {gallery.images.length > 1 && (
                    <button
                      type="button"
                      aria-label={`${i + 1}번째 사진 순서 변경 손잡이 — 드래그하세요`}
                      title="드래그해서 순서 변경"
                      onPointerDown={handleGripDown(i)}
                      className="absolute left-1 top-1 grid h-6 w-6 touch-none cursor-grab place-items-center rounded-full bg-black/60 text-white active:cursor-grabbing"
                    >
                      <GripVertical size={14} />
                    </button>
                  )}
                  {/* 삭제 (우상단) */}
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    aria-label="삭제"
                    className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-xs text-white"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* 포인터를 따라 떠다니는 사진 클론 — 원본은 자리에서 흐려진 placeholder 로 남는다. */}
        {dragFrom !== null && gallery.images[dragFrom] && (
          <div
            ref={cloneCallbackRef}
            aria-hidden
            className="pointer-events-none fixed left-0 top-0 z-50 overflow-hidden rounded-md opacity-95 shadow-xl ring-2 ring-primary"
            style={{
              width: dragMetaRef.current?.width,
              height: dragMetaRef.current?.height,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={gallery.images[dragFrom]}
              alt=""
              draggable={false}
              className="h-full w-full object-cover"
            />
          </div>
        )}
      </div>
    </SectionEditor>
  );
}
