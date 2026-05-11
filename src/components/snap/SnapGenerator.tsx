'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { nanoid } from '@/lib/utils/nanoid';
import {
  IMAGE_LIMITS,
  compressImage,
  validateImageFile,
} from '@/lib/uploads';
import { Button } from '@/components/ui/button';
import type { SnapCatalogItem } from '@/lib/snap/catalog';
import { CatalogThumbnail } from '@/components/snap/CatalogThumbnail';
import { ANCHOR_TEMPLATES } from '@/lib/snap/anchor-templates';

// 폴링 — gpt-image-2 medium 은 보통 20–60초, high 는 30–90초.
const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 60;

type FaceSlot = 'groom' | 'bride' | 'couple';
type InputMode = 'selfies' | 'couple';

type Stage =
  | 'idle'
  | 'submitting'
  | 'queued'
  | 'in-progress'
  | 'finalizing'
  | 'done'
  | 'error';

interface FaceState {
  url: string | null;
  preview: string | null;
  uploading: boolean;
}

interface BodyForm {
  heightCm: string;
  weightKg: string;
}

const HEIGHT_RANGE = { min: 140, max: 210 };
const WEIGHT_RANGE = { min: 35, max: 150 };

const emptyFace = (): FaceState => ({ url: null, preview: null, uploading: false });

interface AnchorInfo {
  imageUrl: string | null;
  sourceMode: InputMode | null;
}

interface AnchorCandidate {
  templateId: string;
  requestId: string;
  /** fal CDN URL — short-lived, but enough for "pick within minutes" UX. */
  resultUrl: string | null;
  status: 'pending' | 'in-progress' | 'done' | 'error';
}

interface Props {
  catalog: SnapCatalogItem[];
}

function parseBody(b: BodyForm): { heightCm: number; weightKg: number } | null {
  const h = Number(b.heightCm);
  const w = Number(b.weightKg);
  if (!b.heightCm || !b.weightKg) return null;
  if (!Number.isFinite(h) || !Number.isFinite(w)) return null;
  if (h < HEIGHT_RANGE.min || h > HEIGHT_RANGE.max) return null;
  if (w < WEIGHT_RANGE.min || w > WEIGHT_RANGE.max) return null;
  return { heightCm: h, weightKg: w };
}

async function parseRes(res: Response) {
  const text = await res.text();
  try {
    return { data: JSON.parse(text) as Record<string, unknown>, text };
  } catch {
    return { data: null, text };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function SnapGenerator({ catalog }: Props) {
  const [mode, setMode] = useState<InputMode>('selfies');

  const [groom, setGroom] = useState<FaceState>(emptyFace);
  const [bride, setBride] = useState<FaceState>(emptyFace);
  const [couple, setCouple] = useState<FaceState>(emptyFace);
  const [groomBody, setGroomBody] = useState<BodyForm>({ heightCm: '', weightKg: '' });
  const [brideBody, setBrideBody] = useState<BodyForm>({ heightCm: '', weightKg: '' });

  // ── 앵커 상태 ─────────────────────────────────────────────
  const [anchor, setAnchor] = useState<AnchorInfo | null>(null);
  const [anchorBatch, setAnchorBatch] = useState<AnchorCandidate[] | null>(null);
  const [anchorStage, setAnchorStage] = useState<
    'idle' | 'submitting' | 'polling' | 'ready' | 'saving' | 'error'
  >('idle');
  const [anchorErr, setAnchorErr] = useState<string | null>(null);
  const [anchorFreeAvail, setAnchorFreeAvail] = useState<boolean>(true);
  const [snapBalance, setSnapBalance] = useState<number | null>(null);

  // ── 카탈로그 생성 상태 ────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [progressNote, setProgressNote] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  // ── 업스케일 상태 ────────────────────────────────────────
  const [upscaledUrl, setUpscaledUrl] = useState<string | null>(null);
  const [upscaling, setUpscaling] = useState(false);
  const [upscaleErr, setUpscaleErr] = useState<string | null>(null);

  const groomInputRef = useRef<HTMLInputElement>(null);
  const brideInputRef = useRef<HTMLInputElement>(null);
  const coupleInputRef = useRef<HTMLInputElement>(null);

  const isProgressing =
    stage === 'submitting' || stage === 'queued' || stage === 'in-progress' || stage === 'finalizing';
  const isAnchorBusy = anchorStage === 'submitting' || anchorStage === 'polling' || anchorStage === 'saving';

  // ── 초기 로드 — 현재 앵커 + 크레딧 잔액 ───────────────────
  // cache: 'no-store' 가 핵심 — 그렇지 않으면 브라우저가 첫 진입 응답("앵커
  // 없음") 을 캐시해서, 앵커 저장 후 뒤로가기/다시 진입 시에도 같은 응답을
  // 돌려주고 앵커가 사라진 것처럼 보인다.
  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const [a, e] = await Promise.all([
          fetch('/api/snap/anchor', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
          fetch('/api/me/entitlements', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
        ]);
        if (canceled) return;
        if (a?.anchor) {
          setAnchor({
            imageUrl: (a.anchor.image_url as string | null) ?? null,
            sourceMode: (a.anchor.source_mode as InputMode | null) ?? null,
          });
          // 저장된 체형 가이드가 있으면 폼에 미리 채워준다.
          if (a.anchor.groom_height_cm && a.anchor.groom_weight_kg) {
            setGroomBody({
              heightCm: String(a.anchor.groom_height_cm),
              weightKg: String(a.anchor.groom_weight_kg),
            });
          }
          if (a.anchor.bride_height_cm && a.anchor.bride_weight_kg) {
            setBrideBody({
              heightCm: String(a.anchor.bride_height_cm),
              weightKg: String(a.anchor.bride_weight_kg),
            });
          }
        }
        setAnchorFreeAvail(a?.freeActivationAvailable ?? !a?.anchor);
        if (typeof e?.snapCredits === 'number') setSnapBalance(e.snapCredits);
      } catch {
        // 비로그인 등 — 그대로 둠.
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

  const setFace = (slot: FaceSlot, next: FaceState) => {
    if (slot === 'groom') setGroom(next);
    else if (slot === 'bride') setBride(next);
    else setCouple(next);
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
      setFace(slot, emptyFace());
      return;
    }

    const ext = compressed.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${user.id}/snap/${slot}-${nanoid(10)}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('private-uploads')
      .upload(path, compressed, { contentType: compressed.type, upsert: false });
    if (upErr) {
      setErrorMsg(`업로드 실패: ${upErr.message}`);
      setFace(slot, emptyFace());
      return;
    }

    const { data: signed, error: signErr } = await supabase.storage
      .from('private-uploads')
      .createSignedUrl(path, 60 * 60);
    if (signErr || !signed?.signedUrl) {
      setErrorMsg('업로드한 이미지를 읽을 수 없습니다.');
      setFace(slot, emptyFace());
      return;
    }

    setFace(slot, { url: signed.signedUrl, preview: signed.signedUrl, uploading: false });
  };

  // ── 앵커 batch 4장 제출 ───────────────────────────────────
  const inputsReady = mode === 'selfies' ? !!groom.url && !!bride.url : !!couple.url;

  const handleGenerateAnchorBatch = async () => {
    if (isAnchorBusy) return;
    if (!inputsReady) {
      setAnchorErr(mode === 'selfies' ? '얼굴 사진을 모두 업로드하세요.' : '커플 사진을 업로드하세요.');
      return;
    }
    setAnchorErr(null);
    setAnchorStage('submitting');

    const groomBodyValid = parseBody(groomBody);
    const brideBodyValid = parseBody(brideBody);

    const payload =
      mode === 'couple'
        ? {
            mode: 'couple' as const,
            couplePhotoUrl: couple.url,
            ...(groomBodyValid ? { groomBody: groomBodyValid } : {}),
            ...(brideBodyValid ? { brideBody: brideBodyValid } : {}),
          }
        : {
            mode: 'selfies' as const,
            groomFaceUrl: groom.url,
            brideFaceUrl: bride.url,
            ...(groomBodyValid ? { groomBody: groomBodyValid } : {}),
            ...(brideBodyValid ? { brideBody: brideBodyValid } : {}),
          };

    try {
      const res = await fetch('/api/snap/anchor/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const { data, text } = await parseRes(res);
      if (!res.ok) {
        throw new Error((data?.error as string | undefined) ?? text.slice(0, 80) ?? `HTTP ${res.status}`);
      }
      const ids = data?.requestIds as Array<{ templateId: string; requestId: string }> | undefined;
      if (!ids?.length) throw new Error('서버가 요청 ID를 돌려주지 않았습니다.');
      const batch: AnchorCandidate[] = ids.map((x) => ({
        templateId: x.templateId,
        requestId: x.requestId,
        resultUrl: null,
        status: 'pending',
      }));
      setAnchorBatch(batch);
      setAnchorFreeAvail(false); // 무료 활성화는 한 번만.
      setAnchorStage('polling');
      void pollAnchorBatch(batch);
    } catch (e) {
      setAnchorErr(e instanceof Error ? e.message : '앵커 생성 실패');
      setAnchorStage('error');
    }
  };

  const pollAnchorBatch = async (batch: AnchorCandidate[]) => {
    // 모든 후보가 done 또는 error 가 될 때까지 5초 간격 폴링.
    let attempts = 0;
    const current = batch.slice();
    while (attempts < MAX_POLL_ATTEMPTS) {
      attempts += 1;
      const remaining = current.filter((c) => c.status === 'pending' || c.status === 'in-progress');
      if (remaining.length === 0) {
        setAnchorBatch(current);
        setAnchorStage('ready');
        return;
      }

      try {
        const statuses = await Promise.all(
          remaining.map(async (c) => {
            const res = await fetch(`/api/snap/status?id=${encodeURIComponent(c.requestId)}`);
            const { data } = await parseRes(res);
            return { id: c.requestId, data: data ?? {} };
          }),
        );
        let mutated = false;
        for (const s of statuses) {
          const idx = current.findIndex((c) => c.requestId === s.id);
          if (idx < 0) continue;
          const status = s.data?.status as string | undefined;
          if (status === 'COMPLETED') {
            const resultUrl = (s.data?.imageUrl as string | undefined) ?? null;
            current[idx] = { ...current[idx], status: 'done', resultUrl };
            mutated = true;
          } else if (status === 'FAILED') {
            current[idx] = { ...current[idx], status: 'error' };
            mutated = true;
          } else if (status === 'IN_QUEUE' || status === 'IN_PROGRESS') {
            if (current[idx].status !== 'in-progress') {
              current[idx] = { ...current[idx], status: 'in-progress' };
              mutated = true;
            }
          }
        }
        if (mutated) setAnchorBatch(current.slice());
      } catch {
        // 일시 오류 — 다음 라운드에 재시도.
      }

      await sleep(POLL_INTERVAL_MS);
    }
    setAnchorErr('앵커 생성이 너무 오래 걸려 중단했습니다.');
    setAnchorStage('error');
  };

  const handleSelectAnchor = async (candidate: AnchorCandidate) => {
    if (!candidate.requestId || candidate.status !== 'done' || isAnchorBusy) return;
    setAnchorStage('saving');
    setAnchorErr(null);
    try {
      const res = await fetch('/api/snap/anchor', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ requestId: candidate.requestId }),
      });
      const { data, text } = await parseRes(res);
      if (!res.ok) {
        const base = (data?.error as string | undefined) ?? text.slice(0, 80) ?? `HTTP ${res.status}`;
        // 서버가 PG 에러 디테일을 함께 돌려주면 사용자에게도 표시 (운영 중 마이그
        // 레이션 미적용 등을 빠르게 발견하기 위함).
        const detail = data?.detail as string | undefined;
        const code = data?.code as string | undefined;
        throw new Error(detail ? `${base}\n원인: ${detail}${code ? ` (${code})` : ''}` : base);
      }
      const url = data?.url as string | undefined;
      if (!url) throw new Error('서버가 저장 URL을 돌려주지 않았습니다.');
      setAnchor({ imageUrl: url, sourceMode: mode });
      setAnchorBatch(null);
      setAnchorStage('idle');
    } catch (e) {
      setAnchorErr(e instanceof Error ? e.message : '앵커 저장 실패');
      setAnchorStage('error');
    }
  };

  const handleDiscardAnchor = async () => {
    if (!confirm('현재 앵커를 폐기할까요? 다음 앵커 batch 는 4 스냅 크레딧이 필요합니다.')) return;
    try {
      await fetch('/api/snap/anchor', { method: 'DELETE' });
      setAnchor(null);
      setAnchorFreeAvail(false); // 폐기해도 무료 활성화는 부활하지 않음.
    } catch {
      setAnchorErr('앵커 폐기에 실패했습니다.');
    }
  };

  // ── 카탈로그 생성 ────────────────────────────────────────
  const canGenerateCatalog =
    !!selectedId &&
    !isProgressing &&
    // 앵커가 있으면 inputs 안 받아도 됨. 없으면 직결 모드 inputs 필요.
    (!!anchor?.imageUrl || inputsReady);

  const pollUntilDone = async (requestId: string, catalogId: string) => {
    let attempts = 0;
    while (attempts < MAX_POLL_ATTEMPTS) {
      attempts += 1;
      try {
        const res = await fetch(`/api/snap/status?id=${encodeURIComponent(requestId)}`);
        const { data, text } = await parseRes(res);
        if (!res.ok) {
          throw new Error((data?.error as string | undefined) ?? text.slice(0, 80) ?? `HTTP ${res.status}`);
        }
        const status = data?.status as string | undefined;
        const queuePosition = data?.queuePosition as number | undefined;
        if (status === 'COMPLETED') {
          await finalize(requestId, catalogId);
          return;
        }
        if (status === 'FAILED') throw new Error('AI 생성에 실패했습니다.');
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
    setErrorMsg('생성이 너무 오래 걸려 중단했습니다.');
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
      const { data, text } = await parseRes(res);
      if (!res.ok) {
        throw new Error((data?.error as string | undefined) ?? text.slice(0, 80) ?? `HTTP ${res.status}`);
      }
      setResultUrl((data?.url as string | undefined) ?? null);
      setStage('done');
      setProgressNote(null);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '결과 저장 실패');
      setStage('error');
    }
  };

  const handleGenerateCatalog = async () => {
    if (!selectedId) return;
    setStage('submitting');
    setErrorMsg(null);
    setResultUrl(null);
    setUpscaledUrl(null);
    setUpscaleErr(null);
    setProgressNote('AI 작업을 큐에 제출하는 중...');

    const groomBodyValid = parseBody(groomBody);
    const brideBodyValid = parseBody(brideBody);

    // 앵커가 있으면 anchor 모드, 없으면 사용자 입력 모드 그대로.
    const payload = anchor?.imageUrl
      ? { mode: 'anchor' as const, catalogId: selectedId }
      : mode === 'couple'
        ? {
            mode: 'couple' as const,
            couplePhotoUrl: couple.url,
            catalogId: selectedId,
            ...(groomBodyValid ? { groomBody: groomBodyValid } : {}),
            ...(brideBodyValid ? { brideBody: brideBodyValid } : {}),
          }
        : {
            mode: 'selfies' as const,
            groomFaceUrl: groom.url,
            brideFaceUrl: bride.url,
            catalogId: selectedId,
            ...(groomBodyValid ? { groomBody: groomBodyValid } : {}),
            ...(brideBodyValid ? { brideBody: brideBodyValid } : {}),
          };

    try {
      const res = await fetch('/api/snap/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const { data, text } = await parseRes(res);
      if (!res.ok) {
        if (data?.code === 'insufficient_credits') {
          setSnapBalance((data?.currentBalance as number | undefined) ?? 0);
        }
        throw new Error((data?.error as string | undefined) ?? text.slice(0, 80) ?? `HTTP ${res.status}`);
      }
      const requestId = data?.requestId as string | undefined;
      if (!requestId) throw new Error('서버가 요청 ID를 돌려주지 않았습니다.');
      if (typeof data?.balance === 'number') setSnapBalance(data.balance);

      setStage('queued');
      setProgressNote('대기열에서 기다리는 중...');
      void pollUntilDone(requestId, selectedId);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '생성 실패');
      setStage('error');
      setProgressNote(null);
    }
  };

  // ── 업스케일 ──────────────────────────────────────────────
  const handleUpscale = async () => {
    if (!resultUrl || upscaling) return;
    setUpscaling(true);
    setUpscaleErr(null);
    try {
      const res = await fetch('/api/snap/upscale', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ imageUrl: resultUrl }),
      });
      const { data, text } = await parseRes(res);
      if (!res.ok) {
        throw new Error((data?.error as string | undefined) ?? text.slice(0, 80) ?? `HTTP ${res.status}`);
      }
      setUpscaledUrl((data?.url as string | undefined) ?? null);
    } catch (e) {
      setUpscaleErr(e instanceof Error ? e.message : '고화질 변환 실패');
    } finally {
      setUpscaling(false);
    }
  };

  // ── 헬퍼 ─────────────────────────────────────────────────
  const selectedCatalog = selectedId ? catalog.find((c) => c.id === selectedId) ?? null : null;

  return (
    <div className="mt-6 flex flex-col gap-6">
      {/* 0. 현재 상태 카드 — 크레딧 / 앵커 */}
      <StatusCard
        snapBalance={snapBalance}
        anchorUrl={anchor?.imageUrl ?? null}
        freeActivationAvailable={anchorFreeAvail}
        onDiscardAnchor={handleDiscardAnchor}
      />

      {/* 1. 입력 모드 + 업로드 — 앵커가 없을 때만 노출. 앵커 있으면 사진은 다시 안 받아도 됨. */}
      {!anchor?.imageUrl && (
        <section className="rounded-md border border-[#E8DCC9] bg-white p-4">
          <h2 className="text-sm font-medium text-[#3D2E1F]">1. 사진 업로드</h2>

          <div
            role="tablist"
            aria-label="입력 방식"
            className="mt-3 inline-flex rounded-md border border-[#E8DCC9] bg-[#FAF7F2] p-0.5 text-xs"
          >
            <ModeToggleButton
              selected={mode === 'selfies'}
              disabled={isProgressing || isAnchorBusy}
              onClick={() => setMode('selfies')}
            >
              셀카 2장 (권장)
            </ModeToggleButton>
            <ModeToggleButton
              selected={mode === 'couple'}
              disabled={isProgressing || isAnchorBusy}
              onClick={() => setMode('couple')}
            >
              커플 사진 1장
            </ModeToggleButton>
          </div>

          {mode === 'selfies' ? (
            <>
              <p className="mt-3 text-xs text-[#8B7355]">
                정면 클로즈업 사진을 한 장씩 올려주세요. 얼굴이 또렷할수록 합성이 정확합니다.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <FaceUploader
                  label="신랑 얼굴"
                  face={groom}
                  disabled={isProgressing || isAnchorBusy}
                  onPick={() => groomInputRef.current?.click()}
                />
                <FaceUploader
                  label="신부 얼굴"
                  face={bride}
                  disabled={isProgressing || isAnchorBusy}
                  onPick={() => brideInputRef.current?.click()}
                />
              </div>
            </>
          ) : (
            <>
              <p className="mt-3 text-xs text-[#8B7355]">
                두 사람이 함께 찍힌 정면 사진을 1장 올려주세요. 포즈·체형은 그대로
                유지하고 카탈로그의 의상·배경·조명만 입혀 드려요.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <FaceUploader
                  label="커플 사진"
                  face={couple}
                  disabled={isProgressing || isAnchorBusy}
                  onPick={() => coupleInputRef.current?.click()}
                  wide
                />
              </div>
            </>
          )}

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
          <input
            ref={coupleInputRef}
            type="file"
            accept={IMAGE_LIMITS.acceptMime.join(',')}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFaceUpload('couple', f);
              e.target.value = '';
            }}
          />
        </section>
      )}

      {/* 1-b. 키 / 몸무게 (선택) */}
      {!anchor?.imageUrl && (
        <section className="rounded-md border border-[#E8DCC9] bg-white p-4">
          <h2 className="text-sm font-medium text-[#3D2E1F]">
            1-1. 키 · 몸무게 <span className="text-[10px] text-[#8B7355]">(선택)</span>
          </h2>
          <p className="mt-1 text-xs text-[#8B7355]">
            전신 / 반신 컷의 비율을 맞추는 데 사용돼요. 앵커를 만들 때 함께 저장되어
            카탈로그 모든 컷에 일관되게 적용됩니다. 비워두면 카탈로그 기본 체형으로.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <BodyFields
              label="신랑"
              value={groomBody}
              disabled={isProgressing || isAnchorBusy}
              onChange={setGroomBody}
            />
            <BodyFields
              label="신부"
              value={brideBody}
              disabled={isProgressing || isAnchorBusy}
              onChange={setBrideBody}
            />
          </div>
        </section>
      )}

      {/* 2. 앵커 — 만들기 / 선택 / 보유 표시 */}
      {!anchor?.imageUrl && (
        <section className="rounded-md border border-[#E8DCC9] bg-white p-4">
          <h2 className="text-sm font-medium text-[#3D2E1F]">2. 앵커 만들기</h2>
          <p className="mt-1 text-xs text-[#8B7355]">
            앵커는 카탈로그 50컷 사이에서 얼굴/체형이 흔들리지 않도록 잡아주는
            기준 이미지예요. 서로 다른 4가지 framing (클로즈업 · 반신 · 전신 ·
            3/4) 으로 후보를 만들고 가장 마음에 드는 1장을 고릅니다.
            {anchorFreeAvail ? (
              <>
                {' '}
                <span className="font-medium text-emerald-700">첫 batch 는 무료</span>
                예요.
              </>
            ) : (
              <>
                {' '}
                재생성에는 <span className="font-medium">4 스냅 크레딧</span>이 필요합니다.
              </>
            )}
          </p>

          <div className="mt-3 flex items-center gap-3">
            <Button
              type="button"
              onClick={() => void handleGenerateAnchorBatch()}
              disabled={isAnchorBusy || !inputsReady}
            >
              {anchorStage === 'submitting'
                ? '제출 중...'
                : anchorStage === 'polling'
                  ? '생성 중...'
                  : anchorStage === 'saving'
                    ? '저장 중...'
                    : anchorBatch
                      ? '다시 만들기 (4 크레딧)'
                      : anchorFreeAvail
                        ? '앵커 후보 만들기 (무료)'
                        : '앵커 후보 만들기 (4 크레딧)'}
            </Button>
            {!inputsReady && (
              <span className="text-xs text-[#8B7355]">
                {mode === 'selfies' ? '얼굴 사진을 모두 업로드하세요' : '커플 사진을 업로드하세요'}
              </span>
            )}
          </div>

          {anchorErr && (
            <p role="alert" className="mt-3 whitespace-pre-line text-xs text-red-600">
              {anchorErr}
            </p>
          )}

          {anchorBatch && (
            <div className="mt-4">
              <p className="text-xs text-[#5C4633]">
                마음에 드는 framing 을 골라 저장하세요. 저장한 앵커는 모든 카탈로그
                컷에 자동 적용됩니다.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {anchorBatch.map((c) => {
                  const tpl = ANCHOR_TEMPLATES.find((t) => t.id === c.templateId);
                  return (
                    <button
                      key={c.requestId}
                      type="button"
                      disabled={c.status !== 'done' || anchorStage === 'saving'}
                      onClick={() => void handleSelectAnchor(c)}
                      className={`flex flex-col overflow-hidden rounded-md border text-left transition-colors ${
                        c.status === 'done'
                          ? 'border-[#E8DCC9] hover:border-[#3D2E1F] hover:ring-2 hover:ring-[#3D2E1F]/20'
                          : 'border-[#E8DCC9] opacity-70'
                      }`}
                    >
                      <div className="grid aspect-[3/4] w-full place-items-center overflow-hidden bg-[#F5EDE0]">
                        {c.resultUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.resultUrl}
                            alt={tpl?.label ?? c.templateId}
                            className="block h-full w-full object-contain"
                          />
                        ) : c.status === 'error' ? (
                          <span className="text-[10px] text-red-600">실패</span>
                        ) : (
                          <span className="text-[10px] text-[#8B7355]">
                            {c.status === 'in-progress' ? '합성 중...' : '대기 중...'}
                          </span>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-medium text-[#3D2E1F]">{tpl?.label ?? c.templateId}</p>
                        <p className="mt-0.5 text-[10px] text-[#8B7355]">
                          {c.status === 'done' ? '눌러서 이 앵커로 저장' : '...'}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 3. 카탈로그 선택 */}
      <section className="rounded-md border border-[#E8DCC9] bg-white p-4">
        <h2 className="text-sm font-medium text-[#3D2E1F]">
          {anchor?.imageUrl ? '2. 카탈로그 컷 선택' : '3. 카탈로그 컷 선택'}
        </h2>
        <p className="mt-1 text-xs text-[#8B7355]">
          마음에 드는 컷을 하나 골라주세요. 1장당 스냅 크레딧 1개가 차감됩니다.
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
                <CatalogThumbnail src={item.image} alt={item.label} />
                <div className="p-2">
                  <p className="text-xs font-medium text-[#3D2E1F]">{item.label}</p>
                  <p className="mt-0.5 text-[10px] text-[#8B7355]">{item.hint}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 4. 생성 */}
      <section className="rounded-md border border-[#E8DCC9] bg-white p-4">
        <h2 className="text-sm font-medium text-[#3D2E1F]">
          {anchor?.imageUrl ? '3. 생성' : '4. 생성'}
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button type="button" onClick={() => void handleGenerateCatalog()} disabled={!canGenerateCatalog}>
            {stage === 'submitting'
              ? '제출 중...'
              : stage === 'queued'
                ? '대기 중...'
                : stage === 'in-progress'
                  ? 'AI 합성 중...'
                  : stage === 'finalizing'
                    ? '저장 중...'
                    : `생성하기 ${snapBalance !== null ? `(잔여 ${snapBalance})` : ''}`}
          </Button>
          {!canGenerateCatalog && stage === 'idle' && (
            <span className="text-xs text-[#8B7355]">
              {!anchor?.imageUrl && !inputsReady
                ? '사진을 업로드하세요'
                : !selectedId
                  ? '카탈로그 컷을 선택하세요'
                  : null}
            </span>
          )}
        </div>
        {progressNote && <p className="mt-3 text-xs text-[#5C4633]">{progressNote}</p>}
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

      {/* 5. 결과 — 비교 뷰 + 업스케일 */}
      {stage === 'done' && resultUrl && (
        <section className="rounded-md border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900 dark:bg-emerald-900/10">
          <h2 className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            ✨ 생성 완료
          </h2>
          <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-300/80">
            선택한 카탈로그와 생성 결과를 나란히 비교해보세요. 얼굴/체형 차이로
            일부 디테일은 다를 수 있어요.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <ComparePane
              caption="선택한 카탈로그"
              src={selectedCatalog?.image ?? null}
              alt={selectedCatalog?.label ?? '카탈로그'}
              hint={selectedCatalog?.label}
            />
            <ComparePane
              caption="생성 결과"
              src={upscaledUrl ?? resultUrl}
              alt="생성된 웨딩스냅"
              hint={upscaledUrl ? '고화질 (2x)' : '우리 얼굴로 합성됨'}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => window.open(upscaledUrl ?? resultUrl, '_blank', 'noopener')}
            >
              새 탭에서 열기
            </Button>
            {!upscaledUrl && (
              <Button type="button" size="sm" variant="outline" onClick={() => void handleUpscale()} disabled={upscaling}>
                {upscaling ? '고화질 변환 중...' : '고화질 다운로드 (무료, 5–15초)'}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setResultUrl(null);
                setSelectedId(null);
                setStage('idle');
                setUpscaledUrl(null);
                setUpscaleErr(null);
              }}
            >
              다른 컷 만들기
            </Button>
          </div>
          {upscaleErr && (
            <p role="alert" className="mt-2 text-xs text-red-600">
              {upscaleErr}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function StatusCard({
  snapBalance,
  anchorUrl,
  freeActivationAvailable,
  onDiscardAnchor,
}: {
  snapBalance: number | null;
  anchorUrl: string | null;
  freeActivationAvailable: boolean;
  onDiscardAnchor: () => void;
}) {
  // 인라인 큰 미리보기 토글 — 한 행짜리 status 안에 넣으면 답답해서 카드 아래로
  // 펼친다. 새 탭 열기 옵션도 같이 제공해 사용자가 원본 해상도로 비교 가능.
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex flex-col gap-3 rounded-md border border-[#E8DCC9] bg-[#FAF7F2] p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-[#5C4633]">
          <span className="rounded-full bg-white px-2 py-0.5 ring-1 ring-[#D4C5B0]">스냅 크레딧</span>
          <span className="font-semibold text-[#3D2E1F]">
            {snapBalance === null ? '…' : `${snapBalance} 개`}
          </span>
          {snapBalance !== null && snapBalance < 1 && (
            <a
              href="/mypage?tab=snap"
              className="text-[11px] text-[#8B7355] underline underline-offset-2 hover:text-[#3D2E1F]"
            >
              패키지 구매
            </a>
          )}
        </div>
        <div className="flex flex-1 items-center gap-2 text-xs text-[#5C4633]">
          <span className="rounded-full bg-white px-2 py-0.5 ring-1 ring-[#D4C5B0]">앵커</span>
          {anchorUrl ? (
            <>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                title={expanded ? '미리보기 접기' : '크게 보기'}
                className="inline-flex h-10 w-8 overflow-hidden rounded border border-[#D4C5B0] transition-transform hover:scale-105"
                aria-expanded={expanded}
                aria-label={expanded ? '앵커 미리보기 접기' : '앵커 크게 보기'}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={anchorUrl} alt="앵커" className="h-full w-full object-cover" />
              </button>
              <span className="font-medium text-emerald-700">저장됨</span>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="text-[11px] text-[#8B7355] underline underline-offset-2 hover:text-[#3D2E1F]"
              >
                {expanded ? '접기' : '크게 보기'}
              </button>
              <a
                href={anchorUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[#8B7355] underline underline-offset-2 hover:text-[#3D2E1F]"
              >
                새 탭
              </a>
              <button
                type="button"
                onClick={onDiscardAnchor}
                className="ml-auto text-[11px] text-[#8B7355] underline underline-offset-2 hover:text-red-600"
              >
                폐기
              </button>
            </>
          ) : (
            <span className="text-[#8B7355]">
              아직 없음
              {freeActivationAvailable && (
                <>
                  {' '}
                  · <span className="font-medium text-emerald-700">첫 batch 무료</span>
                </>
              )}
            </span>
          )}
        </div>
      </div>

      {/* 인라인 큰 미리보기 — 앵커 보유 + 펼침 상태일 때만. */}
      {anchorUrl && expanded && (
        <div className="flex flex-col gap-2">
          <div className="mx-auto w-full max-w-[280px] overflow-hidden rounded border border-[#D4C5B0] bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={anchorUrl} alt="저장된 앵커" className="block h-auto w-full object-contain" />
          </div>
          <p className="text-center text-[10px] text-[#8B7355]">
            저장된 앵커 · 모든 카탈로그 생성에 자동 적용됩니다
          </p>
        </div>
      )}
    </div>
  );
}

function ModeToggleButton({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      disabled={disabled}
      onClick={onClick}
      className={`rounded px-3 py-1.5 transition-colors ${
        selected
          ? 'bg-white font-medium text-[#3D2E1F] shadow-sm ring-1 ring-[#D4C5B0]'
          : 'text-[#8B7355] hover:text-[#3D2E1F]'
      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      {children}
    </button>
  );
}

function ComparePane({
  caption,
  src,
  alt,
  hint,
}: {
  caption: string;
  src: string | null;
  alt: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-[#5C4633]">{caption}</span>
      <div className="grid aspect-[3/4] w-full place-items-center overflow-hidden rounded border border-[#E8DCC9] bg-[#F5EDE0]">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} className="block h-full w-full object-contain" />
        ) : (
          <span className="text-xs text-[#8B7355]">이미지 없음</span>
        )}
      </div>
      {hint && <span className="text-[10px] text-[#8B7355]">{hint}</span>}
    </div>
  );
}

function BodyFields({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: BodyForm;
  disabled?: boolean;
  onChange: (next: BodyForm) => void;
}) {
  const heightNum = Number(value.heightCm);
  const weightNum = Number(value.weightKg);
  const heightOut =
    value.heightCm !== '' &&
    Number.isFinite(heightNum) &&
    (heightNum < HEIGHT_RANGE.min || heightNum > HEIGHT_RANGE.max);
  const weightOut =
    value.weightKg !== '' &&
    Number.isFinite(weightNum) &&
    (weightNum < WEIGHT_RANGE.min || weightNum > WEIGHT_RANGE.max);
  return (
    <div className="flex flex-col gap-2 rounded-md border border-[#E8DCC9] bg-[#FAF7F2] p-3">
      <span className="text-xs font-medium text-[#3D2E1F]">{label}</span>
      <label className="flex items-center gap-2 text-xs text-[#5C4633]">
        <span className="w-10 shrink-0">키</span>
        <input
          type="number"
          inputMode="numeric"
          min={HEIGHT_RANGE.min}
          max={HEIGHT_RANGE.max}
          step={1}
          placeholder="170"
          disabled={disabled}
          value={value.heightCm}
          onChange={(e) => onChange({ ...value, heightCm: e.target.value })}
          className={`w-full rounded border bg-white px-2 py-1.5 text-sm ${
            heightOut ? 'border-red-400' : 'border-[#D4C5B0]'
          }`}
        />
        <span className="text-[10px] text-[#8B7355]">cm</span>
      </label>
      <label className="flex items-center gap-2 text-xs text-[#5C4633]">
        <span className="w-10 shrink-0">몸무게</span>
        <input
          type="number"
          inputMode="numeric"
          min={WEIGHT_RANGE.min}
          max={WEIGHT_RANGE.max}
          step={1}
          placeholder="65"
          disabled={disabled}
          value={value.weightKg}
          onChange={(e) => onChange({ ...value, weightKg: e.target.value })}
          className={`w-full rounded border bg-white px-2 py-1.5 text-sm ${
            weightOut ? 'border-red-400' : 'border-[#D4C5B0]'
          }`}
        />
        <span className="text-[10px] text-[#8B7355]">kg</span>
      </label>
      {(heightOut || weightOut) && (
        <p className="text-[10px] text-red-600">입력 범위를 벗어났어요.</p>
      )}
    </div>
  );
}

function FaceUploader({
  label,
  face,
  disabled,
  onPick,
  wide,
}: {
  label: string;
  face: FaceState;
  disabled?: boolean;
  onPick: () => void;
  wide?: boolean;
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
      } ${disabled || face.uploading ? 'opacity-60' : ''} ${wide ? 'col-span-2' : ''}`}
    >
      <div
        className={`grid w-full place-items-center overflow-hidden rounded bg-[#F5EDE0] ${
          wide ? 'aspect-[4/3] max-w-[280px]' : 'aspect-square max-w-[140px]'
        }`}
      >
        {face.preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={face.preview} alt={label} className="block h-full w-full object-contain" />
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
