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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="업로드된 사진"
            className={`${previewAspect} w-full rounded-md object-cover`}
          />
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
