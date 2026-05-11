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

type InputMode = 'selfies1' | 'selfies3' | 'couple';

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
const emptyFaceTriple = (): [FaceState, FaceState, FaceState] => [
  emptyFace(),
  emptyFace(),
  emptyFace(),
];

const ANGLE_LABELS = ['정면', '좌 45°', '우 45°'] as const;

interface AnchorInfo {
  imageUrl: string | null;
  sourceMode: string | null;
}

interface AnchorCandidate {
  templateId: string;
  requestId: string;
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
  // 입력 모드 — 셀카 1장씩 (디폴트) / 셀카 3장씩 (정면+좌45°+우45°) / 커플 사진.
  // 모드를 바꿔도 이미 업로드한 사진은 유지하고, 사용하지 않는 슬롯만 무시.
  const [mode, setMode] = useState<InputMode>('selfies1');

  // 신랑/신부 얼굴은 항상 3-슬롯 배열로 보관. 모드에 따라 보이는 갯수만 다름.
  const [groomFaces, setGroomFaces] = useState<[FaceState, FaceState, FaceState]>(emptyFaceTriple);
  const [brideFaces, setBrideFaces] = useState<[FaceState, FaceState, FaceState]>(emptyFaceTriple);
  const [couple, setCouple] = useState<FaceState>(emptyFace);
  const [groomBody, setGroomBody] = useState<BodyForm>({ heightCm: '', weightKg: '' });
  const [brideBody, setBrideBody] = useState<BodyForm>({ heightCm: '', weightKg: '' });

  // 앵커 상태
  const [anchor, setAnchor] = useState<AnchorInfo | null>(null);
  const [anchorBatch, setAnchorBatch] = useState<AnchorCandidate[] | null>(null);
  const [anchorStage, setAnchorStage] = useState<
    'idle' | 'submitting' | 'polling' | 'ready' | 'saving' | 'error'
  >('idle');
  const [anchorErr, setAnchorErr] = useState<string | null>(null);
  const [anchorFreeAvail, setAnchorFreeAvail] = useState<boolean>(true);
  const [snapBalance, setSnapBalance] = useState<number | null>(null);

  // 카탈로그 생성 상태
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [progressNote, setProgressNote] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  // 각 슬롯에 1개씩의 hidden file input — useRef 9개는 번거로워 click 핸들러 안에
  // 직접 input 생성/트리거 방식으로 변환. (groomFront / groomLeft / groomRight /
  // brideFront / brideLeft / brideRight / couple)
  const groomRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];
  const brideRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];
  const coupleRef = useRef<HTMLInputElement>(null);

  const isProgressing =
    stage === 'submitting' || stage === 'queued' || stage === 'in-progress' || stage === 'finalizing';
  const isAnchorBusy = anchorStage === 'submitting' || anchorStage === 'polling' || anchorStage === 'saving';

  // 초기 로드 — 현재 앵커 + 크레딧 잔액. cache: 'no-store' 가 핵심.
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
            sourceMode: (a.anchor.source_mode as string | null) ?? null,
          });
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

  // 셀카 슬롯 N개 (모드 기준).
  const numAngles = mode === 'selfies3' ? 3 : 1;

  const setGroomFaceAt = (idx: number, next: FaceState) => {
    setGroomFaces((cur) => {
      const arr = [...cur] as [FaceState, FaceState, FaceState];
      arr[idx] = next;
      return arr;
    });
  };
  const setBrideFaceAt = (idx: number, next: FaceState) => {
    setBrideFaces((cur) => {
      const arr = [...cur] as [FaceState, FaceState, FaceState];
      arr[idx] = next;
      return arr;
    });
  };

  const handleFaceUpload = async (
    slot: 'groom' | 'bride' | 'couple',
    idx: number,
    file: File,
  ) => {
    setErrorMsg(null);
    const v = validateImageFile(file);
    if (!v.ok) {
      setErrorMsg(v.message);
      return;
    }
    const pending: FaceState = { url: null, preview: URL.createObjectURL(v.file), uploading: true };
    if (slot === 'groom') setGroomFaceAt(idx, pending);
    else if (slot === 'bride') setBrideFaceAt(idx, pending);
    else setCouple(pending);

    const compressed = await compressImage(v.file);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setErrorMsg('로그인이 필요합니다.');
      if (slot === 'groom') setGroomFaceAt(idx, emptyFace());
      else if (slot === 'bride') setBrideFaceAt(idx, emptyFace());
      else setCouple(emptyFace());
      return;
    }

    const ext = compressed.name.split('.').pop()?.toLowerCase() || 'jpg';
    const subfolder =
      slot === 'couple' ? 'couple' : `${slot}-${idx === 0 ? 'frontal' : idx === 1 ? 'left45' : 'right45'}`;
    const path = `${user.id}/snap/${subfolder}-${nanoid(10)}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('private-uploads')
      .upload(path, compressed, { contentType: compressed.type, upsert: false });
    if (upErr) {
      setErrorMsg(`업로드 실패: ${upErr.message}`);
      if (slot === 'groom') setGroomFaceAt(idx, emptyFace());
      else if (slot === 'bride') setBrideFaceAt(idx, emptyFace());
      else setCouple(emptyFace());
      return;
    }

    const { data: signed, error: signErr } = await supabase.storage
      .from('private-uploads')
      .createSignedUrl(path, 60 * 60);
    if (signErr || !signed?.signedUrl) {
      setErrorMsg('업로드한 이미지를 읽을 수 없습니다.');
      if (slot === 'groom') setGroomFaceAt(idx, emptyFace());
      else if (slot === 'bride') setBrideFaceAt(idx, emptyFace());
      else setCouple(emptyFace());
      return;
    }

    const ready: FaceState = { url: signed.signedUrl, preview: signed.signedUrl, uploading: false };
    if (slot === 'groom') setGroomFaceAt(idx, ready);
    else if (slot === 'bride') setBrideFaceAt(idx, ready);
    else setCouple(ready);
  };

  // 모드에 맞는 입력이 모두 준비됐는지.
  const selfiesReady = (() => {
    for (let i = 0; i < numAngles; i += 1) {
      if (!groomFaces[i].url || !brideFaces[i].url) return false;
    }
    return true;
  })();
  const inputsReady = mode === 'couple' ? !!couple.url : selfiesReady;

  // 앵커 batch 생성 가능 여부 — 셀카 모드에서만, 입력 모두 준비됨.
  const canGenerateAnchor = mode !== 'couple' && inputsReady && !isAnchorBusy;

  // 카탈로그 생성 가능 여부:
  //  - couple 모드: couple.url + selectedId 만 있으면 OK (앵커 영향 없음)
  //  - selfies 모드: 앵커 있으면 selectedId 만, 없으면 selfies inputs 도 필요
  const canGenerateCatalog = (() => {
    if (!selectedId || isProgressing) return false;
    if (mode === 'couple') return !!couple.url;
    if (anchor?.imageUrl) return true;
    return selfiesReady;
  })();

  // 페이로드 추출 헬퍼.
  const collectGroomUrls = (): string[] =>
    groomFaces.slice(0, numAngles).map((f) => f.url).filter((u): u is string => !!u);
  const collectBrideUrls = (): string[] =>
    brideFaces.slice(0, numAngles).map((f) => f.url).filter((u): u is string => !!u);

  // ── 앵커 batch 4장 제출 ───────────────────────────────────
  const handleGenerateAnchorBatch = async () => {
    if (isAnchorBusy || mode === 'couple' || !inputsReady) return;
    setAnchorErr(null);
    setAnchorStage('submitting');

    const groomBodyValid = parseBody(groomBody);
    const brideBodyValid = parseBody(brideBody);

    const payload = {
      mode: 'selfies' as const,
      groomFaceUrls: collectGroomUrls(),
      brideFaceUrls: collectBrideUrls(),
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
        const base = (data?.error as string | undefined) ?? text.slice(0, 80) ?? `HTTP ${res.status}`;
        throw new Error(base);
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
      setAnchorFreeAvail(false);
      setAnchorStage('polling');
      void pollAnchorBatch(batch);
    } catch (e) {
      setAnchorErr(e instanceof Error ? e.message : '앵커 생성 실패');
      setAnchorStage('error');
    }
  };

  const pollAnchorBatch = async (batch: AnchorCandidate[]) => {
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
        const detail = data?.detail as string | undefined;
        const code = data?.code as string | undefined;
        throw new Error(detail ? `${base}\n원인: ${detail}${code ? ` (${code})` : ''}` : base);
      }
      const url = data?.url as string | undefined;
      if (!url) throw new Error('서버가 저장 URL을 돌려주지 않았습니다.');
      setAnchor({ imageUrl: url, sourceMode: 'selfies' });
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
      setAnchorFreeAvail(false);
    } catch {
      setAnchorErr('앵커 폐기에 실패했습니다.');
    }
  };

  // ── 카탈로그 생성 ────────────────────────────────────────
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
    if (!canGenerateCatalog) return;

    setStage('submitting');
    setErrorMsg(null);
    setResultUrl(null);
    setProgressNote('AI 작업을 큐에 제출하는 중...');

    const groomBodyValid = parseBody(groomBody);
    const brideBodyValid = parseBody(brideBody);

    // 모드별 페이로드:
    //  - couple: 명시적으로 mode='couple' 보내 서버가 앵커 무시하게.
    //  - selfies + 앵커 있음: mode='anchor' 로 서버가 앵커 reference 사용.
    //  - selfies + 앵커 없음: mode='selfies' + 셀카 url 배열.
    let payload: Record<string, unknown>;
    if (mode === 'couple') {
      payload = {
        mode: 'couple',
        couplePhotoUrl: couple.url,
        catalogId: selectedId,
        ...(groomBodyValid ? { groomBody: groomBodyValid } : {}),
        ...(brideBodyValid ? { brideBody: brideBodyValid } : {}),
      };
    } else if (anchor?.imageUrl) {
      payload = { mode: 'anchor', catalogId: selectedId };
    } else {
      payload = {
        mode: 'selfies',
        groomFaceUrls: collectGroomUrls(),
        brideFaceUrls: collectBrideUrls(),
        catalogId: selectedId,
        ...(groomBodyValid ? { groomBody: groomBodyValid } : {}),
        ...(brideBodyValid ? { brideBody: brideBodyValid } : {}),
      };
    }

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

  // 헬퍼
  const selectedCatalog = selectedId ? catalog.find((c) => c.id === selectedId) ?? null : null;

  // 셀카 모드 + 앵커 보유 = 사진 업로드/체형 입력 섹션 숨김 (이미 잠겨 있음).
  const showSelfieInputs = mode !== 'couple' && !anchor?.imageUrl;
  const showCoupleInputs = mode === 'couple';
  const showAnchorBuilder = mode !== 'couple' && !anchor?.imageUrl;

  // 카탈로그 생성 시 어떤 경로를 탈지 — UI 안내용.
  const pathHint = (() => {
    if (mode === 'couple') return '커플 사진 기반 (앵커 영향 없음)';
    if (anchor?.imageUrl) return '저장된 앵커 기반';
    return mode === 'selfies3' ? '셀카 3장씩 직결' : '셀카 1장씩 직결';
  })();

  return (
    <div className="mt-6 flex flex-col gap-6">
      {/* 0. 현재 상태 카드 — 크레딧 / 앵커 */}
      <StatusCard
        snapBalance={snapBalance}
        anchorUrl={anchor?.imageUrl ?? null}
        freeActivationAvailable={anchorFreeAvail}
        onDiscardAnchor={handleDiscardAnchor}
      />

      {/* 1. 입력 모드 + 업로드 */}
      <section className="rounded-md border border-[#E8DCC9] bg-white p-4">
        <h2 className="text-sm font-medium text-[#3D2E1F]">1. 사진 업로드</h2>
        <div
          role="tablist"
          aria-label="입력 방식"
          className="mt-3 inline-flex flex-wrap rounded-md border border-[#E8DCC9] bg-[#FAF7F2] p-0.5 text-xs"
        >
          <ModeToggleButton
            selected={mode === 'selfies1'}
            disabled={isProgressing || isAnchorBusy}
            onClick={() => setMode('selfies1')}
          >
            셀카 1장씩
          </ModeToggleButton>
          <ModeToggleButton
            selected={mode === 'selfies3'}
            disabled={isProgressing || isAnchorBusy}
            onClick={() => setMode('selfies3')}
          >
            셀카 3장씩 (정면+좌+우, 권장)
          </ModeToggleButton>
          <ModeToggleButton
            selected={mode === 'couple'}
            disabled={isProgressing || isAnchorBusy}
            onClick={() => setMode('couple')}
          >
            커플 사진 1장
          </ModeToggleButton>
        </div>

        {/* 모드별 안내 */}
        {mode === 'selfies1' && (
          <p className="mt-3 text-xs text-[#8B7355]">
            정면 클로즈업 사진을 한 장씩 올려주세요. 1장만 사용하므로 빠르고 간편한
            기본 옵션 — 측면/3-quarter 카탈로그 컷에서 정체성이 살짝 흔들릴 수 있어요.
          </p>
        )}
        {mode === 'selfies3' && (
          <p className="mt-3 text-xs text-[#8B7355]">
            정면 + 좌 45° + 우 45° 사진을 각 3장씩 올려주세요. 모델이 3D 얼굴을 더
            정확히 잡아 측면 컷에서도 정체성이 안정적입니다. <strong>권장 옵션</strong>.
          </p>
        )}
        {mode === 'couple' && (
          <p className="mt-3 text-xs text-[#8B7355]">
            두 사람이 함께 찍힌 정면 사진을 1장 올려주세요. <strong>커플 사진 모드는
            앵커 영향을 받지 않습니다</strong> — 사용자 포즈/체형/상호작용을 그대로
            유지하고 카탈로그의 의상·배경·조명만 입혀 드려요.
          </p>
        )}

        {/* 셀카 입력 영역 */}
        {showSelfieInputs && (
          <div className="mt-3 flex flex-col gap-4">
            <AngleRow
              personLabel="신랑 얼굴"
              numAngles={numAngles}
              faces={groomFaces}
              refs={groomRefs}
              disabled={isProgressing || isAnchorBusy}
            />
            <AngleRow
              personLabel="신부 얼굴"
              numAngles={numAngles}
              faces={brideFaces}
              refs={brideRefs}
              disabled={isProgressing || isAnchorBusy}
            />
            {/* hidden file inputs */}
            {([0, 1, 2] as const).map((idx) => (
              <input
                key={`groom-${idx}`}
                ref={groomRefs[idx]}
                type="file"
                accept={IMAGE_LIMITS.acceptMime.join(',')}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFaceUpload('groom', idx, f);
                  e.target.value = '';
                }}
              />
            ))}
            {([0, 1, 2] as const).map((idx) => (
              <input
                key={`bride-${idx}`}
                ref={brideRefs[idx]}
                type="file"
                accept={IMAGE_LIMITS.acceptMime.join(',')}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFaceUpload('bride', idx, f);
                  e.target.value = '';
                }}
              />
            ))}
          </div>
        )}

        {/* 셀카 모드 + 앵커 보유 = 잠긴 상태 안내 */}
        {mode !== 'couple' && anchor?.imageUrl && (
          <p className="mt-3 rounded-md border border-[#E8DCC9] bg-[#FAF7F2] p-3 text-xs text-[#5C4633]">
            ✓ 앵커가 저장되어 있어 사진을 다시 업로드할 필요가 없어요. 새로 만들려면
            위 상태 카드의 &ldquo;폐기&rdquo; 를 누르세요 (다음 batch 는 4 크레딧).
          </p>
        )}

        {/* 커플 입력 영역 */}
        {showCoupleInputs && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <FaceUploader
              label="커플 사진"
              face={couple}
              disabled={isProgressing || isAnchorBusy}
              onPick={() => coupleRef.current?.click()}
              wide
            />
            <input
              ref={coupleRef}
              type="file"
              accept={IMAGE_LIMITS.acceptMime.join(',')}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFaceUpload('couple', 0, f);
                e.target.value = '';
              }}
            />
          </div>
        )}
      </section>

      {/* 1-b. 키 / 몸무게 (선택) — 앵커 없거나 커플 모드일 때 노출 */}
      {(showSelfieInputs || showCoupleInputs) && (
        <section className="rounded-md border border-[#E8DCC9] bg-white p-4">
          <h2 className="text-sm font-medium text-[#3D2E1F]">
            1-1. 키 · 몸무게 <span className="text-[10px] text-[#8B7355]">(선택)</span>
          </h2>
          <p className="mt-1 text-xs text-[#8B7355]">
            전신 / 반신 컷의 비율을 맞추는 데 사용돼요. 키 {HEIGHT_RANGE.min}–
            {HEIGHT_RANGE.max}cm · 몸무게 {WEIGHT_RANGE.min}–{WEIGHT_RANGE.max}kg
            범위. 비워두면 카탈로그 기본 체형으로 합성됩니다.
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

      {/* 2. 앵커 만들기 — 셀카 모드 + 앵커 미보유에서만 */}
      {showAnchorBuilder && (
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
              disabled={!canGenerateAnchor}
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
                {mode === 'selfies3' ? '신랑/신부 각 3장씩 업로드' : '신랑/신부 각 1장씩 업로드'}
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
        <h2 className="text-sm font-medium text-[#3D2E1F]">카탈로그 컷 선택</h2>
        <p className="mt-1 text-xs text-[#8B7355]">
          마음에 드는 컷을 하나 골라주세요. 1장당 스냅 크레딧 1개가 차감됩니다.{' '}
          <span className="text-[10px] text-[#8B7355]">· 현재 경로: {pathHint}</span>
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
        <h2 className="text-sm font-medium text-[#3D2E1F]">생성</h2>
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
              {mode === 'couple' && !couple.url
                ? '커플 사진을 업로드하세요'
                : mode !== 'couple' && !anchor?.imageUrl && !selfiesReady
                  ? mode === 'selfies3'
                    ? '신랑/신부 각 3장씩 업로드'
                    : '신랑/신부 각 1장씩 업로드'
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

      {/* 5. 결과 — 비교 뷰. 업스케일은 얼굴 변형 문제로 제거. */}
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
              src={resultUrl}
              alt="생성된 웨딩스냅"
              hint="우리 얼굴로 합성됨"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
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

function AngleRow({
  personLabel,
  numAngles,
  faces,
  refs,
  disabled,
}: {
  personLabel: string;
  numAngles: number;
  faces: [FaceState, FaceState, FaceState];
  refs: Array<React.RefObject<HTMLInputElement>>;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-[#3D2E1F]">
        {personLabel}{' '}
        {numAngles > 1 && <span className="text-[10px] text-[#8B7355]">— {numAngles}각도</span>}
      </p>
      <div className={`grid gap-2 ${numAngles === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {Array.from({ length: numAngles }).map((_, idx) => (
          <FaceUploader
            key={idx}
            label={numAngles === 1 ? personLabel : ANGLE_LABELS[idx]}
            face={faces[idx]}
            disabled={disabled}
            onPick={() => refs[idx].current?.click()}
          />
        ))}
      </div>
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

      {anchorUrl && expanded && (
        <div className="flex flex-col gap-2">
          <div className="mx-auto w-full max-w-[280px] overflow-hidden rounded border border-[#D4C5B0] bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={anchorUrl} alt="저장된 앵커" className="block h-auto w-full object-contain" />
          </div>
          <p className="text-center text-[10px] text-[#8B7355]">
            저장된 앵커 · 셀카 모드 카탈로그 생성에 자동 적용됩니다 (커플 모드는 영향 없음)
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
