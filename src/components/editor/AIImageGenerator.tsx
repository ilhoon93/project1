'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FREE_TEMPLATES, TEMPLATE_KEYS, type TemplateKey } from '@/lib/fal/prompts';
import { useEditorStore } from '@/stores/editor';
import { Button } from '@/components/ui/button';
import { nanoid } from '@/lib/utils/nanoid';

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];

type Stage = 'idle' | 'uploading' | 'photo-ready' | 'generating' | 'done' | 'error';

interface Props {
  invitationId: string;
  /** Disable the generator (e.g. once free quota is used). */
  alreadyUsed: boolean;
}

export function AIImageGenerator({ invitationId, alreadyUsed }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [template, setTemplate] = useState<TemplateKey>('classic_chapel');

  const save = useEditorStore((s) => s.save);
  const patch = useEditorStore((s) => s.patchSection);
  const main = useEditorStore((s) => s.content?.main);

  if (alreadyUsed) {
    return (
      <div className="rounded-md border border-dashed bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
        무료 AI 이미지를 사용했습니다. 추가 이미지는 결제 후 이용 가능합니다.
      </div>
    );
  }

  const reset = () => {
    setStage('idle');
    setPhotoUrl(null);
    setErrorMsg(null);
  };

  const handleFile = async (file: File) => {
    setErrorMsg(null);
    if (!ACCEPT.includes(file.type)) {
      setErrorMsg('JPG, PNG, WEBP 형식만 지원됩니다.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setErrorMsg('이미지 크기는 8MB 이하여야 합니다.');
      return;
    }

    setStage('uploading');
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setErrorMsg('로그인이 필요합니다.');
      setStage('error');
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${user.id}/source-${nanoid(10)}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('private-uploads')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) {
      setErrorMsg(`업로드 실패: ${upErr.message}`);
      setStage('error');
      return;
    }

    // Signed URL so fal.ai (an external service) can fetch the private file.
    const { data: signed, error: signErr } = await supabase.storage
      .from('private-uploads')
      .createSignedUrl(path, 60 * 60); // 1 hour
    if (signErr || !signed?.signedUrl) {
      setErrorMsg('업로드한 이미지를 읽을 수 없습니다.');
      setStage('error');
      return;
    }

    setPhotoUrl(signed.signedUrl);
    setStage('photo-ready');
  };

  const handleGenerate = async () => {
    if (!photoUrl) return;
    setStage('generating');
    setErrorMsg(null);

    // Commit any pending edits before kicking off generation, so the
    // server's content merge sees the latest local state.
    await save();

    try {
      const res = await fetch('/api/ai/free-preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ invitationId, photoUrl, template }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      // Update local store; autosave will persist (server already did).
      if (main) patch('main', { ...main, heroImage: data.url, aiUsed: true });
      setStage('done');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '생성 실패');
      setStage('error');
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border border-dashed bg-muted/20 p-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">AI 메인 사진 만들기 (무료 1회)</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            인물 사진을 올리면 배경과 의상이 웨딩 스타일로 바뀝니다
          </p>
        </div>
      </div>

      {/* file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT.join(',')}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = ''; // allow re-picking same file
        }}
      />

      {(stage === 'idle' || stage === 'error') && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          className="self-start"
        >
          사진 선택하기
        </Button>
      )}

      {stage === 'uploading' && (
        <p className="text-xs text-muted-foreground">사진 업로드 중...</p>
      )}

      {(stage === 'photo-ready' || stage === 'generating') && photoUrl && (
        <div className="flex flex-col gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt="원본 사진" className="h-32 w-full rounded object-cover" />

          <div>
            <p className="mb-1.5 text-xs font-medium">스타일 선택</p>
            <div className="grid grid-cols-5 gap-1.5">
              {TEMPLATE_KEYS.map((key) => {
                const t = FREE_TEMPLATES[key];
                const active = template === key;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={stage === 'generating'}
                    onClick={() => setTemplate(key)}
                    className={`flex flex-col items-center gap-0.5 rounded-md border px-1.5 py-2 text-[11px] transition-colors ${
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-input bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <span className="text-base leading-none">{t.icon}</span>
                    <span className="leading-tight">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => void handleGenerate()}
              disabled={stage === 'generating'}
            >
              {stage === 'generating' ? 'AI 생성 중...' : '생성하기'}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={reset}>
              다시 선택
            </Button>
          </div>

          {stage === 'generating' && (
            <p className="text-xs text-muted-foreground">
              평균 15-30초 정도 걸립니다. 페이지를 닫지 마세요.
            </p>
          )}
        </div>
      )}

      {stage === 'done' && (
        <p className="text-xs text-emerald-600">
          ✨ 메인 이미지가 적용되었습니다. 미리보기에서 확인하세요.
        </p>
      )}

      {errorMsg && (
        <p role="alert" className="text-xs text-destructive">
          {errorMsg}
        </p>
      )}
    </div>
  );
}
