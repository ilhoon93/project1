'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { nanoid } from '@/lib/utils/nanoid';

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];

interface Props {
  /** Current image URL (already uploaded). Null/empty means no image yet. */
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  invitationId: string;
  /** Folder prefix below `invitations/{invitationId}/` (e.g. "main", "story-2"). */
  folder: string;
  /** Tailwind aspect class for the preview, defaults to a 3:4 portrait. */
  previewAspect?: string;
  /** Whether the preview crops to fill the frame (cover) or shows the full image (contain). */
  previewFit?: 'cover' | 'contain';
  /** When previewFit='cover', selects which portion of the image is centered (0–100). */
  previewPosition?: { x: number; y: number };
  /**
   * 9:16 미리보기 위에 좌우 ~9% 회색 마스크를 덮어
   * 9:20 비율 폰에서 잘릴 수 있는 영역을 시각적으로 보여준다.
   * 메인 포스터처럼 풀스크린 표시되는 경우에만 의미가 있다.
   */
  showWideAspectCropMask?: boolean;
  label?: string;
}

/**
 * Plain image uploader: pick a file → push to the `public-images` bucket under
 * `invitations/{invitationId}/{folder}/...` → return the public URL via onChange.
 */
export function ImageUploader({
  value,
  onChange,
  invitationId,
  folder,
  previewAspect = 'aspect-[3/4]',
  previewFit = 'cover',
  previewPosition,
  showWideAspectCropMask = false,
  label = '사진 업로드',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setErrorMsg(null);
    if (!ACCEPT.includes(file.type)) {
      setErrorMsg('JPG, PNG, WEBP 형식만 지원됩니다.');
      setStage('error');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setErrorMsg('이미지 크기는 25MB 이하여야 합니다.');
      setStage('error');
      return;
    }

    setStage('uploading');
    const supabase = createClient();
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    // path convention enforced by RLS: invitations/{invitationId}/<rest>
    const path = `invitations/${invitationId}/${folder}/${nanoid(10)}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('public-images')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) {
      setErrorMsg(`업로드 실패: ${upErr.message}`);
      setStage('error');
      return;
    }

    const { data } = supabase.storage.from('public-images').getPublicUrl(path);
    if (!data?.publicUrl) {
      setErrorMsg('업로드 후 URL을 받을 수 없습니다.');
      setStage('error');
      return;
    }

    onChange(data.publicUrl);
    setStage('idle');
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT.join(',')}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = '';
        }}
      />

      {value ? (
        <div className="flex flex-col gap-2">
          {/* contain: 잘림 없이 전체를 보여주고 남는 영역은 배경색(--mw-bg)으로 채움.
              cover: 프레임을 채우되 previewPosition 으로 보일 영역을 선택. */}
          <div
            className={`${previewAspect} relative w-full overflow-hidden rounded-md`}
            style={
              previewFit === 'contain'
                ? { backgroundColor: 'var(--mw-bg, #f5f5f5)' }
                : undefined
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="업로드된 사진"
              className={`h-full w-full ${
                previewFit === 'contain' ? 'object-contain' : 'object-cover'
              }`}
              style={
                previewFit === 'cover' && previewPosition
                  ? { objectPosition: `${previewPosition.x}% ${previewPosition.y}%` }
                  : undefined
              }
            />
            {/* 9:20 비율 폰에서 좌우가 잘릴 수 있는 영역 — 평평한 회색 오버레이.
                실제 크롭 비율: 9:16 이미지 → 9:20 뷰포트 cover 시 좌우 약 7% 씩.
                (다양한 모던 폰 9:18~9:20.5 분포의 중간값을 살짝 보수적으로 잡음.) */}
            {showWideAspectCropMask && (
              <>
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-0 w-[7%] bg-neutral-500/55"
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 right-0 w-[7%] bg-neutral-500/55"
                />
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={stage === 'uploading'}
              onClick={() => inputRef.current?.click()}
            >
              {stage === 'uploading' ? '업로드 중...' : '다시 선택'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(null)}
            >
              제거
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={stage === 'uploading'}
          onClick={() => inputRef.current?.click()}
          className="self-start"
        >
          {stage === 'uploading' ? '업로드 중...' : label}
        </Button>
      )}

      {errorMsg && (
        <p role="alert" className="text-xs text-destructive">
          {errorMsg}
        </p>
      )}
    </div>
  );
}
