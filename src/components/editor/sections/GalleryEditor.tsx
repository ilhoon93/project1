'use client';

import { useRef, useState } from 'react';
import { useEditorStore } from '@/stores/editor';
import { createClient } from '@/lib/supabase/client';
import { nanoid } from '@/lib/utils/nanoid';
import { GALLERY_LAYOUTS } from '@/types/invitation';
import { SectionEditor, type SectionDragProps } from '../SectionEditor';
import { Button } from '@/components/ui/button';
import {
  IMAGE_LIMITS,
  compressImage,
  validateImageFile,
} from '@/lib/uploads';

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

  if (!gallery || !invitationId) return null;

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

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= gallery.images.length) return;
    const list = [...gallery.images];
    [list[i], list[j]] = [list[j], list[i]];
    patch('gallery', { ...gallery, images: list });
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

        {gallery.images.length > 0 && (
          <ul className="grid grid-cols-3 gap-2">
            {gallery.images.map((url, i) => (
              <li
                key={`${url}-${i}`}
                className="relative aspect-square overflow-hidden rounded-md"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                <div className="absolute right-1 top-1 flex gap-1">
                  <button
                    type="button"
                    aria-label="앞으로"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    className="grid h-6 w-6 place-items-center rounded-full bg-black/60 text-xs text-white disabled:opacity-30"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    aria-label="뒤로"
                    disabled={i === gallery.images.length - 1}
                    onClick={() => move(i, 1)}
                    className="grid h-6 w-6 place-items-center rounded-full bg-black/60 text-xs text-white disabled:opacity-30"
                  >
                    ›
                  </button>
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    aria-label="삭제"
                    className="grid h-6 w-6 place-items-center rounded-full bg-black/60 text-xs text-white"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SectionEditor>
  );
}
