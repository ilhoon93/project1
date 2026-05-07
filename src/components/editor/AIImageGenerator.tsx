'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AI_CONCEPTS, CONCEPT_KEYS, type ConceptKey } from '@/lib/fal/concepts';
import { Button } from '@/components/ui/button';
import { nanoid } from '@/lib/utils/nanoid';

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];

type Stage =
  | 'loading-quota'
  | 'idle'
  | 'uploading'
  | 'photo-ready'
  | 'generating'
  | 'done'
  | 'quota-exhausted'
  | 'error';

interface QuotaInfo {
  used: boolean;
  lastUrl: string | null;
}

export function AIImageGenerator() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('loading-quota');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [concept, setConcept] = useState<ConceptKey>('studio');
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  // 진입 시 사용 잔여 + 마지막 결과 조회. 이미 사용했다면 결과만 보여주고 입력 폼은 잠금.
  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const res = await fetch('/api/ai/concept-generate');
        if (!res.ok) {
          if (!canceled) setStage('idle');
          return;
        }
        const data: QuotaInfo = await res.json();
        if (canceled) return;
        if (data.used) {
          setResultUrl(data.lastUrl);
          setStage('quota-exhausted');
        } else {
          setStage('idle');
        }
      } catch {
        if (!canceled) setStage('idle');
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

  const reset = () => {
    setStage('idle');
    setPhotoUrl(null);
    setErrorMsg(null);
    setResultUrl(null);
  };

  const handleFile = async (file: File) => {
    setErrorMsg(null);
    if (!ACCEPT.includes(file.type)) {
      setErrorMsg('JPG, PNG, WEBP 형식만 지원됩니다.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setErrorMsg('이미지 크기는 25MB 이하여야 합니다.');
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

    // fal.ai 가 외부에서 페치할 수 있도록 1시간 짜리 signed URL 발급.
    const { data: signed, error: signErr } = await supabase.storage
      .from('private-uploads')
      .createSignedUrl(path, 60 * 60);
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

    try {
      const res = await fetch('/api/ai/concept-generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ photoUrl, concept }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.code === 'quota_exhausted') {
          setResultUrl(null);
          setStage('quota-exhausted');
          return;
        }
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setResultUrl(data.url);
      setStage('done');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '생성 실패');
      setStage('error');
    }
  };

  const handleDownload = async (url: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `wedding-${concept}-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch {
      // 폴백 — 새 탭에서 열기.
      window.open(url, '_blank', 'noopener');
    }
  };

  if (stage === 'loading-quota') {
    return (
      <p className="text-xs text-muted-foreground">사용 정보를 불러오는 중...</p>
    );
  }

  // 이미 사용한 계정 — 결과(있으면) + 안내만 보여주고 입력 폼은 잠금.
  if (stage === 'quota-exhausted') {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-md border border-dashed bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
          AI 이미지 생성은 계정당 1회만 사용 가능합니다. 추가 생성은 결제 후 이용해주세요.
        </div>
        {resultUrl && (
          <div className="flex flex-col gap-2 rounded-md border bg-muted/20 p-3">
            <span className="text-xs font-medium text-muted-foreground">
              지난 번 생성된 이미지
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resultUrl}
              alt="이전 생성 결과"
              className="aspect-[3/4] w-full max-w-[260px] rounded object-cover"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void handleDownload(resultUrl)}
              className="self-start"
            >
              다운로드
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-dashed bg-muted/20 p-3">
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

      {(stage === 'idle' || stage === 'error') && !resultUrl && (
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
            <p className="mb-1.5 text-xs font-medium">컨셉 선택</p>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
              {CONCEPT_KEYS.map((key) => {
                const c = AI_CONCEPTS[key];
                const active = concept === key;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={stage === 'generating'}
                    onClick={() => setConcept(key)}
                    className={`flex flex-col items-center gap-0.5 rounded-md border px-1.5 py-2 text-[11px] leading-tight transition-colors ${
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-input bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <span className="text-base leading-none">{c.icon}</span>
                    <span>{c.label}</span>
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
              평균 20-40초 정도 걸립니다. 페이지를 닫지 마세요.
            </p>
          )}
        </div>
      )}

      {stage === 'done' && resultUrl && (
        <div className="flex flex-col gap-2 rounded-md border bg-emerald-50/40 p-3 dark:bg-emerald-900/10">
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
            ✨ 생성 완료
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resultUrl}
            alt="AI 생성 결과"
            className="aspect-[3/4] w-full max-w-[260px] rounded object-cover"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => void handleDownload(resultUrl)}
            >
              다운로드
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => window.open(resultUrl, '_blank', 'noopener')}
            >
              새 탭에서 열기
            </Button>
          </div>
        </div>
      )}

      {errorMsg && (
        <p role="alert" className="text-xs text-destructive">
          {errorMsg}
        </p>
      )}
    </div>
  );
}
