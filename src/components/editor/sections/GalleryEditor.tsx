'use client';

import { useState } from 'react';
import { useEditorStore } from '@/stores/editor';
import { SectionEditor } from '../SectionEditor';
import { TextField } from '../form-fields';
import { Button } from '@/components/ui/button';

export function GalleryEditor() {
  const gallery = useEditorStore((s) => s.content?.gallery);
  const patch = useEditorStore((s) => s.patchSection);
  const [draftUrl, setDraftUrl] = useState('');

  if (!gallery) return null;

  const addImage = () => {
    const url = draftUrl.trim();
    if (!url) return;
    if (gallery.images.length >= 20) return;
    try {
      new URL(url);
    } catch {
      return;
    }
    patch('gallery', { ...gallery, images: [...gallery.images, url] });
    setDraftUrl('');
  };

  const removeAt = (i: number) => {
    const next = gallery.images.filter((_, idx) => idx !== i);
    patch('gallery', { ...gallery, images: next });
  };

  return (
    <SectionEditor
      title="갤러리"
      description="둘이 함께한 사진들 (최대 20장)"
      toggle={{
        enabled: gallery.enabled,
        onChange: (next) => patch('gallery', { ...gallery, enabled: next }),
      }}
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          이미지 업로드 UI는 다음 단계에서 추가됩니다. 지금은 외부 이미지 URL로 미리 채워둘
          수 있습니다.
        </p>

        <div className="flex gap-2">
          <TextField
            label=""
            value={draftUrl}
            placeholder="https://example.com/photo.jpg"
            onChange={(e) => setDraftUrl(e.target.value)}
            className="flex-1"
          />
          <Button
            type="button"
            onClick={addImage}
            disabled={gallery.images.length >= 20}
            className="self-end"
          >
            추가
          </Button>
        </div>

        {gallery.images.length > 0 && (
          <ul className="grid grid-cols-3 gap-2">
            {gallery.images.map((url, i) => (
              <li key={`${url}-${i}`} className="relative aspect-square overflow-hidden rounded-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  aria-label="이미지 삭제"
                  className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-xs text-white"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SectionEditor>
  );
}
