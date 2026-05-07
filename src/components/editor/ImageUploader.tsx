'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { nanoid } from '@/lib/utils/nanoid';
import { HeartClip } from '@/components/shared/HeartClip';

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
  /**
   * 액자프레임 변형(폴라로이드/하트/스크린) 미리보기 셰이프.
   * 설정 시 미리보기에 실제 프레임 모양(흰 테두리 + 기울임, 하트 클립 등) 을 적용해
   * 사용자가 잘릴 영역을 그대로 확인할 수 있게 한다.
   */
  frameVariant?: 'polaroid' | 'heart' | 'screen';
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
  frameVariant,
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
          <FramedPreview
            src={value}
            previewAspect={previewAspect}
            previewFit={previewFit}
            previewPosition={previewPosition}
            showWideAspectCropMask={showWideAspectCropMask}
            frameVariant={frameVariant}
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

// ─────────────────────────────────────────────────────────────
// FramedPreview — 미리보기 박스. 액자프레임 변형(폴라로이드/하트/스크린) 일 때
// 실제 슬라이드에서 보이는 프레임 모양을 그대로 렌더해 잘릴 영역을 시각화.
// 변형이 없으면 기존 사각형 미리보기 (포스터/일반) 와 동일하게 동작.
// ─────────────────────────────────────────────────────────────

interface FramedPreviewProps {
  src: string;
  previewAspect: string;
  previewFit: 'cover' | 'contain';
  previewPosition?: { x: number; y: number };
  showWideAspectCropMask: boolean;
  frameVariant?: 'polaroid' | 'heart' | 'screen';
}

function FramedPreview({
  src,
  previewAspect,
  previewFit,
  previewPosition,
  showWideAspectCropMask,
  frameVariant,
}: FramedPreviewProps) {
  const objectPos = previewPosition
    ? `${previewPosition.x}% ${previewPosition.y}%`
    : undefined;

  // 폴라로이드 — 흰 테두리 + 살짝 기울임. 사진 부분만 cover + position.
  if (frameVariant === 'polaroid') {
    return (
      <div className="flex w-full justify-center">
        <div className="rotate-[-3deg] bg-white p-1.5 pb-3 shadow-md">
          <div className="aspect-square w-full overflow-hidden bg-stone-100" style={{ width: '6.5rem' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt="업로드된 사진"
              className="h-full w-full object-cover"
              style={objectPos ? { objectPosition: objectPos } : undefined}
            />
          </div>
        </div>
      </div>
    );
  }

  // 하트 — 슬라이드(MainSlide) 와 동일한 HeartClip + 4:5 비율을 사용해
  // 미리보기/실제 슬라이드의 잘림 모양을 정확히 일치시킨다.
  if (frameVariant === 'heart') {
    return (
      <div className="flex w-full justify-center">
        <HeartClip
          style={{
            width: '8rem',
            aspectRatio: '4 / 5',
            backgroundColor: '#f5f5f4',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt="업로드된 사진"
            className="h-full w-full object-cover"
            style={objectPos ? { objectPosition: objectPos } : undefined}
          />
        </HeartClip>
      </div>
    );
  }

  // 스크린 — 정사각형 (또는 contain) + 테마 배경색을 카드 배경으로 깔아 letterbox 톤 시각화.
  if (frameVariant === 'screen') {
    return (
      <div
        className={`${previewAspect} relative w-full overflow-hidden rounded-md`}
        style={{ backgroundColor: 'var(--mw-bg, #f5f5f5)' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="업로드된 사진"
          className={`h-full w-full ${previewFit === 'contain' ? 'object-contain' : 'object-cover'}`}
          style={previewFit === 'cover' && objectPos ? { objectPosition: objectPos } : undefined}
        />
      </div>
    );
  }

  // 기본(포스터/일반) — 사각형 미리보기. 9:20 폰 좌우 회색 마스크 옵션 적용.
  return (
    <div
      className={`${previewAspect} relative w-full overflow-hidden rounded-md`}
      style={previewFit === 'contain' ? { backgroundColor: 'var(--mw-bg, #f5f5f5)' } : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="업로드된 사진"
        className={`h-full w-full ${previewFit === 'contain' ? 'object-contain' : 'object-cover'}`}
        style={previewFit === 'cover' && objectPos ? { objectPosition: objectPos } : undefined}
      />
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
  );
}
