'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AI_CONCEPTS, CONCEPT_KEYS, type ConceptKey } from '@/lib/fal/concepts';
import { Button } from '@/components/ui/button';
import { nanoid } from '@/lib/utils/nanoid';
import {
  IMAGE_LIMITS,
  compressImage,
  validateImageFile,
} from '@/lib/uploads';

// 폴링 주기/한도 — openai/gpt-image-2 는 보통 20–60초. 5초 간격 × 최대 60회(=5분) 면 안전.
const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 60;

// 진행 중 직전 사용한 requestId 를 sessionStorage 에 저장 — 페이지 새로고침 후에도
// 폴링을 이어 받아 결과를 가져갈 수 있게 한다 (계정당 1회 한도라 실수로 새로고침 시 손해 방지).
const ACTIVE_REQUEST_KEY = 'mw_ai_active_request';

type Stage =
  | 'loading-quota'
  | 'idle'
  | 'uploading'
  | 'photo-ready'
  | 'submitting'
  | 'queued'
  | 'in-progress'
  | 'finalizing'
  | 'done'
  | 'quota-exhausted'
  | 'error';

interface QuotaInfo {
  used: boolean;
  lastUrl: string | null;
}

interface ActiveRequestInfo {
  requestId: string;
  concept: ConceptKey;
}

export function AIImageGenerator() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('loading-quota');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [concept, setConcept] = useState<ConceptKey>('studio');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [progressNote, setProgressNote] = useState<string | null>(null);

  // 진입 시 사용 잔여 + 마지막 결과 조회. 또한 진행 중이던 requestId 가 있으면 폴링 재개.
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
          return;
        }
        // 진행 중이던 작업이 sessionStorage 에 있으면 폴링 재개.
        const activeRaw = safeGet(sessionStorage, ACTIVE_REQUEST_KEY);
        if (activeRaw) {
          try {
            const active = JSON.parse(activeRaw) as ActiveRequestInfo;
            if (active.requestId && active.concept) {
              setConcept(active.concept);
              setStage('in-progress');
              setProgressNote('이전에 진행 중이던 작업을 이어서 가져오는 중...');
              void pollUntilDone(active.requestId, active.concept);
              return;
            }
          } catch {
            safeRemove(sessionStorage, ACTIVE_REQUEST_KEY);
          }
        }
        setStage('idle');
      } catch {
        if (!canceled) setStage('idle');
      }
    })();
    return () => {
      canceled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = () => {
    setStage('idle');
    setPhotoUrl(null);
    setErrorMsg(null);
    setResultUrl(null);
    setProgressNote(null);
    safeRemove(sessionStorage, ACTIVE_REQUEST_KEY);
  };

  const handleFile = async (input: File) => {
    setErrorMsg(null);
    const v = validateImageFile(input);
    if (!v.ok) {
      setErrorMsg(v.message);
      return;
    }

    setStage('uploading');
    const file = await compressImage(v.file);
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

  // 안전한 JSON 파싱 — 서버가 평문으로 응답해도(예: 타임아웃) 사용자에게는 친절한 메시지.
  const parseResOrText = async (res: Response): Promise<{ data: unknown; bodyText: string }> => {
    const bodyText = await res.text();
    try {
      return { data: JSON.parse(bodyText), bodyText };
    } catch {
      return { data: null, bodyText };
    }
  };

  const pollUntilDone = async (requestId: string, currentConcept: ConceptKey) => {
    let attempts = 0;
    while (attempts < MAX_POLL_ATTEMPTS) {
      attempts += 1;
      try {
        const res = await fetch(`/api/ai/concept-status?id=${encodeURIComponent(requestId)}`);
        const { data, bodyText } = await parseResOrText(res);
        if (!res.ok) {
          throw new Error(
            (data as { error?: string } | null)?.error ?? bodyText.slice(0, 80) ?? `HTTP ${res.status}`,
          );
        }
        const status = (data as { status?: string; queuePosition?: number } | null)?.status;
        const queuePosition = (data as { queuePosition?: number } | null)?.queuePosition;
        if (status === 'COMPLETED') {
          await finalize(requestId, currentConcept);
          return;
        }
        if (status === 'FAILED') {
          throw new Error('AI 생성에 실패했습니다.');
        }
        if (status === 'IN_QUEUE') {
          setStage('queued');
          setProgressNote(
            queuePosition && queuePosition > 0
              ? `대기열 ${queuePosition}번째에서 기다리는 중...`
              : '대기열에서 기다리는 중...',
          );
        } else {
          setStage('in-progress');
          setProgressNote(`AI 가 이미지를 만드는 중... (${attempts * 5}초 경과)`);
        }
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : '상태 조회 실패');
        setStage('error');
        safeRemove(sessionStorage, ACTIVE_REQUEST_KEY);
        return;
      }
      await sleep(POLL_INTERVAL_MS);
    }
    setErrorMsg('생성이 너무 오래 걸려 중단했습니다. 잠시 후 다시 시도해주세요.');
    setStage('error');
    safeRemove(sessionStorage, ACTIVE_REQUEST_KEY);
  };

  const finalize = async (requestId: string, currentConcept: ConceptKey) => {
    setStage('finalizing');
    setProgressNote('결과 저장 중...');
    try {
      const res = await fetch('/api/ai/concept-finalize', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ requestId, concept: currentConcept }),
      });
      const { data, bodyText } = await parseResOrText(res);
      if (!res.ok) {
        const code = (data as { code?: string } | null)?.code;
        if (code === 'quota_exhausted') {
          setStage('quota-exhausted');
          setProgressNote(null);
          safeRemove(sessionStorage, ACTIVE_REQUEST_KEY);
          return;
        }
        throw new Error(
          (data as { error?: string } | null)?.error ?? bodyText.slice(0, 80) ?? `HTTP ${res.status}`,
        );
      }
      const url = (data as { url?: string } | null)?.url ?? null;
      setResultUrl(url);
      setStage('done');
      setProgressNote(null);
      safeRemove(sessionStorage, ACTIVE_REQUEST_KEY);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '결과 저장 실패');
      setStage('error');
      safeRemove(sessionStorage, ACTIVE_REQUEST_KEY);
    }
  };

  const handleGenerate = async () => {
    if (!photoUrl) return;
    setStage('submitting');
    setErrorMsg(null);
    setProgressNote('AI 작업을 큐에 제출하는 중...');

    try {
      const res = await fetch('/api/ai/concept-generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ photoUrl, concept }),
      });
      const { data, bodyText } = await parseResOrText(res);
      if (!res.ok) {
        const code = (data as { code?: string } | null)?.code;
        if (code === 'quota_exhausted') {
          setStage('quota-exhausted');
          setProgressNote(null);
          return;
        }
        throw new Error(
          (data as { error?: string } | null)?.error ?? bodyText.slice(0, 80) ?? `HTTP ${res.status}`,
        );
      }
      const requestId = (data as { requestId?: string } | null)?.requestId;
      if (!requestId) throw new Error('서버가 요청 ID를 돌려주지 않았습니다.');

      // 새로고침 복구용으로 sessionStorage 에 저장.
      safeSet(sessionStorage, ACTIVE_REQUEST_KEY, JSON.stringify({ requestId, concept }));

      setStage('queued');
      setProgressNote('대기열에서 기다리는 중...');
      void pollUntilDone(requestId, concept);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '생성 실패');
      setStage('error');
      setProgressNote(null);
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
      window.open(url, '_blank', 'noopener');
    }
  };

  if (stage === 'loading-quota') {
    return <p className="text-xs text-muted-foreground">사용 정보를 불러오는 중...</p>;
  }

  if (stage === 'quota-exhausted') {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-md border border-dashed bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
          AI 이미지 생성은 계정당 1회만 사용 가능합니다. 추가 생성은 결제 후 이용해주세요.
        </div>
        {resultUrl && (
          <div className="flex flex-col gap-2 rounded-md border bg-muted/20 p-3">
            <span className="text-xs font-medium text-muted-foreground">지난 번 생성된 이미지</span>
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

  const isProgressing =
    stage === 'submitting' || stage === 'queued' || stage === 'in-progress' || stage === 'finalizing';

  return (
    <div className="flex flex-col gap-3 rounded-md border border-dashed bg-muted/20 p-3">
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_LIMITS.acceptMime.join(',')}
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

      {(stage === 'photo-ready' || isProgressing) && photoUrl && (
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
                    disabled={isProgressing}
                    onClick={() => setConcept(key)}
                    className={`flex flex-col items-center gap-0.5 rounded-md border px-1.5 py-2 text-[11px] leading-tight transition-colors ${
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-input bg-background text-muted-foreground hover:bg-muted'
                    } ${isProgressing ? 'opacity-60' : ''}`}
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
              disabled={isProgressing}
            >
              {stage === 'submitting'
                ? '제출 중...'
                : stage === 'queued'
                  ? '대기 중...'
                  : stage === 'in-progress'
                    ? 'AI 생성 중...'
                    : stage === 'finalizing'
                      ? '저장 중...'
                      : '생성하기'}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={isProgressing}>
              다시 선택
            </Button>
          </div>

          {progressNote && (
            <p className="text-xs text-muted-foreground">{progressNote}</p>
          )}
          {isProgressing && (
            <p className="text-[11px] text-muted-foreground">
              평균 20–60초 정도 걸립니다. 페이지를 닫아도 사용량은 결과 저장 시점에만 차감되니 안심하세요.
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
            <Button type="button" size="sm" onClick={() => void handleDownload(resultUrl)}>
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

// ─────────────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function safeGet(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value);
  } catch {
    /* ignore */
  }
}
function safeRemove(storage: Storage, key: string) {
  try {
    storage.removeItem(key);
  } catch {
    /* ignore */
  }
}
