'use client';

import { useRef, useState } from 'react';
import { useEditorStore } from '@/stores/editor';
import { createClient } from '@/lib/supabase/client';
import { nanoid } from '@/lib/utils/nanoid';
import { SectionEditor } from '../SectionEditor';
import { TextField } from '../form-fields';
import { Button } from '@/components/ui/button';
import { VIDEO_LIMITS, validateVideoFile } from '@/lib/uploads';

function isYouTubeUrl(url: string) {
  return /(?:youtube\.com|youtu\.be)/i.test(url);
}

export function VideoEditor() {
  const video = useEditorStore((s) => s.content?.video);
  const invitationId = useEditorStore((s) => s.invitationId);
  const patch = useEditorStore((s) => s.patchSection);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  if (!video || !invitationId) return null;

  const handleFile = async (input: File) => {
    setErrorMsg(null);
    setBusy(true);
    try {
      const v = await validateVideoFile(input);
      if (!v.ok) {
        setErrorMsg(v.message);
        return;
      }
      const file = v.file;
      const supabase = createClient();
      const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
      const path = `invitations/${invitationId}/video/${nanoid(10)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('public-images')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        setErrorMsg(`업로드 실패: ${upErr.message}`);
        return;
      }
      const { data } = supabase.storage.from('public-images').getPublicUrl(path);
      if (data?.publicUrl) {
        patch('video', { ...video, url: data.publicUrl });
      }
    } finally {
      setBusy(false);
    }
  };

  const sourceLabel = video.url
    ? isYouTubeUrl(video.url)
      ? '유튜브 링크'
      : '업로드된 영상'
    : null;

  return (
    <SectionEditor
      title="영상"
      description="유튜브 링크 또는 영상 파일 업로드"
      toggle={{
        enabled: video.enabled,
        onChange: (next) => patch('video', { ...video, enabled: next }),
      }}
    >
      <div className="flex flex-col gap-3">
        <TextField
          label="영상 제목"
          value={video.title}
          maxLength={50}
          placeholder="저희 결혼 이야기"
          onChange={(e) => patch('video', { ...video, title: e.target.value })}
        />

        <TextField
          label="유튜브 / Vimeo URL"
          type="url"
          value={video.url ?? ''}
          placeholder="https://youtu.be/..."
          onChange={(e) => patch('video', { ...video, url: e.target.value || null })}
          hint="유튜브 URL을 붙여넣으면 자동으로 임베드됩니다"
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">또는 직접 업로드</span>
          <input
            ref={inputRef}
            type="file"
            accept={VIDEO_LIMITS.acceptMime.join(',')}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = '';
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="self-start"
          >
            {busy ? '업로드 중...' : '영상 파일 선택'}
          </Button>
          <p className="text-xs text-muted-foreground">
            {VIDEO_LIMITS.acceptExtLabel}, 최대 {VIDEO_LIMITS.maxBytes / 1024 / 1024}MB · {VIDEO_LIMITS.maxDurationSec}초 이내 · 원본 화질 그대로 업로드
          </p>
        </div>

        {video.url && (
          <p className="text-xs text-muted-foreground">
            현재 등록: <span className="font-medium">{sourceLabel}</span>{' '}
            <button
              type="button"
              onClick={() => patch('video', { ...video, url: null })}
              className="ml-1 text-destructive hover:underline"
            >
              제거
            </button>
          </p>
        )}

        {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}
      </div>
    </SectionEditor>
  );
}
