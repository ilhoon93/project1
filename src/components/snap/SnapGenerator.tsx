'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { nanoid } from '@/lib/utils/nanoid';
import {
  IMAGE_LIMITS,
  compressImage,
  validateImageFile,
} from '@/lib/uploads';
import { Button } from '@/components/ui/button';
import type { SnapCatalogItem } from '@/lib/snap/catalog';

// 폴링 — gpt-image-2 medium 은 보통 20–60초.
const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 60;

type FaceSlot = 'groom' | 'bride';

type Stage =
  | 'idle'
  | 'submitting'
  | 'queued'
  | 'in-progress'
  | 'finalizing'
  | 'done'
  | 'error';

interface FaceState {
  /** signed URL on private-uploads — fal 가 fetch 가능 */
  url: string | null;
  /** 미리보기용 (브라우저 ObjectURL 또는 동일 signed URL) */
  preview: string | null;
  /** 업로드 진행 중 표시 */
  uploading: boolean;
}

interface Props {
  catalog: SnapCatalogItem[];
}

export function SnapGenerator({ catalog }: Props) {
  const [groom, setGroom] = useState<FaceState>({ url: null, preview: null, uploading: false });
  const [bride, setBride] = useState<FaceState>({ url: null, preview: null, uploading: false });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [progressNote, setProgressNote] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const groomInputRef = useRef<HTMLInputElement>(null);
  const brideInputRef = useRef<HTMLInputElement>(null);

  const setFace = (slot: FaceSlot, next: FaceState) => {
    if (slot === 'groom') setGroom(next);
    else setBride(next);
  };

  const handleFaceUpload = async (slot: FaceSlot, file: File) => {
    setErrorMsg(null);
    const v = validateImageFile(file);
    if (!v.ok) {
      setErrorMsg(v.message);
      return;
    }

    setFace(slot, { url: null, preview: URL.createObjectURL(v.file), uploading: true });

    const compressed = await compressImage(v.file);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setErrorMsg('로그인이 필요합니다.');
      setFace(slot, { url: null, preview: null, uploading: false });
      return;
    }

    const ext = compressed.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${user.id}/snap/${slot}-${nanoid(10)}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('private-uploads')
      .upload(path, compressed, { contentType: compressed.type, upsert: false });
    if (upErr) {
      setErrorMsg(`업로드 실패: ${upErr.message}`);
      setFace(slot, { url: null, preview: null, uploading: false });
      return;
    }

    const { data: signed, error: signErr } = await supabase.storage
      .from('private-uploads')
      .createSignedUrl(path, 60 * 60);
    if (signErr || !signed?.signedUrl) {
      setErrorMsg('업로드한 이미지를 읽을 수 없습니다.');
      setFace(slot, { url: null, preview: null, uploading: false });
      return;
    }

    setFace(slot, { url: signed.signedUrl, preview: signed.signedUrl, uploading: false });
  };

  const canGenerate =
    !!groom.url && !!bride.url && !!selectedId && stage !== 'submitting' && stage !== 'queued' && stage !== 'in-progress' && stage !== 'finalizing';

  const parseResOrText = async (res: Response) => {
    const bodyText = await res.text();
    try {
      return { data: JSON.parse(bodyText) as Record<string, unknown>, bodyText };
    } catch {
      return { data: null, bodyText };
    }
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const pollUntilDone = async (requestId: string, catalogId: string) => {
    let attempts = 0;
    while (attempts < MAX_POLL_ATTEMPTS) {
      attempts += 1;
      try {
        const res = await fetch(`/api/snap/status?id=${encodeURIComponent(requestId)}`);
        const { data, bodyText } = await parseResOrText(res);
        if (!res.ok) {
          throw new Error(
            (data?.error as string | undefined) ?? bodyText.slice(0, 80) ?? `HTTP ${res.status}`,
          );
        }
        const status = data?.status as string | undefined;
        const queuePosition = data?.queuePosition as number | undefined;
        if (status === 'COMPLETED') {
          await finalize(requestId, catalogId);
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
          setProgressNote(`AI 가 합성하는 중... (${attempts * 5}초 경과)`);
        }
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : '상태 조회 실패');
        setStage('error');
        return;
      }
      await sleep(POLL_INTERVAL_MS);
    }
    setErrorMsg('생성이 너무 오래 걸려 중단했습니다. 잠시 후 다시 시도해주세요.');
    setStage('error');
  };

  const finalize = async (requestId: string, catalogId: string) => {
    setStage('finalizing');
    setProgressNote('결과 저장 중...');
    try {
      const res = await fetch('/api/snap/finalize', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ requestId, catalogId }),
      });
      const { data, bodyText } = await parseResOrText(res);
      if (!res.ok) {
        throw new Error(
          (data?.error as string | undefined) ?? bodyText.slice(0, 80) ?? `HTTP ${res.status}`,
        );
      }
      const url = (data?.url as string | undefined) ?? null;
      setResultUrl(url);
      setStage('done');
      setProgressNote(null);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '결과 저장 실패');
      setStage('error');
    }
  };

  const handleGenerate = async () => {
    if (!groom.url || !bride.url || !selectedId) return;
    setStage('submitting');
    setErrorMsg(null);
    setResultUrl(null);
    setProgressNote('AI 작업을 큐에 제출하는 중...');

    try {
      const res = await fetch('/api/snap/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          groomFaceUrl: groom.url,
          brideFaceUrl: bride.url,
          catalogId: selectedId,
        }),
      });
      const { data, bodyText } = await parseResOrText(res);
      if (!res.ok) {
        throw new Error(
          (data?.error as string | undefined) ?? bodyText.slice(0, 80) ?? `HTTP ${res.status}`,
        );
      }
      const requestId = data?.requestId as string | undefined;
      if (!requestId) throw new Error('서버가 요청 ID를 돌려주지 않았습니다.');

      setStage('queued');
      setProgressNote('대기열에서 기다리는 중...');
      void pollUntilDone(requestId, selectedId);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '생성 실패');
      setStage('error');
      setProgressNote(null);
    }
  };

  const isProgressing =
    stage === 'submitting' || stage === 'queued' || stage === 'in-progress' || stage === 'finalizing';

  return (
    <div className="mt-6 flex flex-col gap-6">
      {/* 1. 신랑 / 신부 얼굴 업로드 */}
      <section className="rounded-md border border-[#E8DCC9] bg-white p-4">
        <h2 className="text-sm font-medium text-[#3D2E1F]">1. 신랑·신부 얼굴 업로드</h2>
        <p className="mt-1 text-xs text-[#8B7355]">
          정면 클로즈업 사진을 한 장씩 올려주세요. 얼굴이 또렷할수록 합성이 정확합니다.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <FaceUploader
            label="신랑 얼굴"
            face={groom}
            disabled={isProgressing}
            onPick={() => groomInputRef.current?.click()}
          />
          <FaceUploader
            label="신부 얼굴"
            face={bride}
            disabled={isProgressing}
            onPick={() => brideInputRef.current?.click()}
          />
        </div>
        <input
          ref={groomInputRef}
          type="file"
          accept={IMAGE_LIMITS.acceptMime.join(',')}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFaceUpload('groom', f);
            e.target.value = '';
          }}
        />
        <input
          ref={brideInputRef}
          type="file"
          accept={IMAGE_LIMITS.acceptMime.join(',')}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFaceUpload('bride', f);
            e.target.value = '';
          }}
        />
      </section>

      {/* 2. 카탈로그 선택 */}
      <section className="rounded-md border border-[#E8DCC9] bg-white p-4">
        <h2 className="text-sm font-medium text-[#3D2E1F]">2. 카탈로그 컷 선택</h2>
        <p className="mt-1 text-xs text-[#8B7355]">
          MVP — 1장씩 시험 생성합니다. 마음에 드는 컷을 하나 골라주세요.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {catalog.map((item) => {
            const selected = selectedId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={isProgressing}
                onClick={() => setSelectedId(item.id)}
                aria-pressed={selected}
                className={`flex flex-col overflow-hidden rounded-md border text-left transition-colors ${
                  selected
                    ? 'border-[#3D2E1F] ring-2 ring-[#3D2E1F]/30'
                    : 'border-[#E8DCC9] hover:border-[#8B7355]'
                } ${isProgressing ? 'opacity-60' : ''}`}
              >
                <div className="grid aspect-[3/4] w-full place-items-center bg-[#F5EDE0]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image}
                    alt={item.label}
                    className="block h-full w-full object-contain"
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      const fb = target.nextElementSibling as HTMLElement | null;
                      if (fb) fb.style.display = 'flex';
                    }}
                  />
                  <div
                    className="hidden h-full w-full flex-col items-center justify-center px-2 text-center text-[10px] text-[#8B7355]"
                    style={{ display: 'none' }}
                  >
                    <span className="mb-1">📷</span>
                    <span className="font-mono">{item.image}</span>
                  </div>
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium text-[#3D2E1F]">{item.label}</p>
                  <p className="mt-0.5 text-[10px] text-[#8B7355]">{item.hint}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. 생성 */}
      <section className="rounded-md border border-[#E8DCC9] bg-white p-4">
        <h2 className="text-sm font-medium text-[#3D2E1F]">3. 생성</h2>
        <div className="mt-3 flex items-center gap-3">
          <Button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={!canGenerate}
          >
            {stage === 'submitting'
              ? '제출 중...'
              : stage === 'queued'
                ? '대기 중...'
                : stage === 'in-progress'
                  ? 'AI 합성 중...'
                  : stage === 'finalizing'
                    ? '저장 중...'
                    : '생성하기'}
          </Button>
          {!canGenerate && stage === 'idle' && (
            <span className="text-xs text-[#8B7355]">
              {!groom.url || !bride.url ? '얼굴 사진을 모두 업로드하세요' : '카탈로그 컷을 선택하세요'}
            </span>
          )}
        </div>
        {progressNote && (
          <p className="mt-3 text-xs text-[#5C4633]">{progressNote}</p>
        )}
        {isProgressing && (
          <p className="mt-1 text-[11px] text-[#8B7355]">
            평균 20–60초 정도 걸립니다. 페이지를 닫으면 작업 결과를 받지 못해요.
          </p>
        )}
        {errorMsg && (
          <p role="alert" className="mt-3 text-xs text-red-600">
            {errorMsg}
          </p>
        )}
      </section>

      {/* 4. 결과 */}
      {stage === 'done' && resultUrl && (
        <section className="rounded-md border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900 dark:bg-emerald-900/10">
          <h2 className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            ✨ 생성 완료
          </h2>
          <div className="mt-3 grid aspect-[3/4] w-full max-w-[320px] place-items-center overflow-hidden rounded bg-[#F5EDE0]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resultUrl}
              alt="생성된 웨딩스냅"
              className="block h-full w-full object-contain"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => window.open(resultUrl, '_blank', 'noopener')}
            >
              새 탭에서 열기
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setResultUrl(null);
                setSelectedId(null);
                setStage('idle');
              }}
            >
              다른 컷 만들기
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function FaceUploader({
  label,
  face,
  disabled,
  onPick,
}: {
  label: string;
  face: FaceState;
  disabled?: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled || face.uploading}
      onClick={onPick}
      className={`flex flex-col items-center gap-2 rounded-md border border-dashed p-3 transition-colors ${
        face.preview
          ? 'border-[#8B7355] bg-[#F5EDE0]'
          : 'border-[#E8DCC9] bg-white hover:bg-[#FAF7F2]'
      } ${disabled || face.uploading ? 'opacity-60' : ''}`}
    >
      <div className="grid aspect-square w-full max-w-[140px] place-items-center overflow-hidden rounded bg-[#F5EDE0]">
        {face.preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={face.preview}
            alt={label}
            className="block h-full w-full object-contain"
          />
        ) : (
          <span className="text-2xl text-[#8B7355]">＋</span>
        )}
      </div>
      <span className="text-xs font-medium text-[#3D2E1F]">
        {face.uploading ? '업로드 중...' : face.preview ? `${label} ✓ 변경` : `${label} 업로드`}
      </span>
    </button>
  );
}
