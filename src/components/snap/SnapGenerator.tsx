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
import {
  ANCHOR_TEMPLATES,
  type AnchorExpression,
  type AnchorFraming,
  type AnchorSlot,
} from '@/lib/snap/anchor-templates';

// 폴링 — gpt-image-2 medium 은 보통 20–60초, high 는 30–90초.
const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 60;

type InputMode = 'selfies1' | 'selfies3' | 'couple';

// 카탈로그 생성 stage — 제출 직후 사용자가 페이지를 벗어나도 되게 비동기 모드.
// 'submitted' 도달 후 SnapGenerator 는 더 이상 폴링하지 않음. 결과는 마이페이지
// 갤러리에서 자동 finalize 됨 (POST /api/snap/jobs/poll-pending).
type Stage = 'idle' | 'submitting' | 'submitted' | 'error';

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
  groomAnchorUrl: string | null;
  brideAnchorUrl: string | null;
  sourceMode: string | null;
}

/**
 * 라이브러리 앵커 — 과거에 만든 앵커 (snap_anchor_history). 카탈로그 생성 시
 * 현재 앵커 대신 골라 쓸 수 있다.
 */
interface LibraryAnchor {
  id: string;
  groomAnchorUrl: string;
  brideAnchorUrl: string;
  createdAt: string;
}

interface AnchorCandidate {
  slot: AnchorSlot;
  framing: AnchorFraming;
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
  const [mode, setMode] = useState<InputMode>('selfies1');

  // 신랑/신부 얼굴은 항상 3-슬롯 배열로 보관. 모드에 따라 보이는 갯수만 다름.
  const [groomFaces, setGroomFaces] = useState<[FaceState, FaceState, FaceState]>(emptyFaceTriple);
  const [brideFaces, setBrideFaces] = useState<[FaceState, FaceState, FaceState]>(emptyFaceTriple);
  const [couple, setCouple] = useState<FaceState>(emptyFace);
  const [groomBody, setGroomBody] = useState<BodyForm>({ heightCm: '', weightKg: '' });
  const [brideBody, setBrideBody] = useState<BodyForm>({ heightCm: '', weightKg: '' });

  // 앵커 상태 — solo anchor (groom + bride 각각).
  const [anchor, setAnchor] = useState<AnchorInfo | null>(null);
  const [anchorBatch, setAnchorBatch] = useState<AnchorCandidate[] | null>(null);
  const [anchorStage, setAnchorStage] = useState<
    'idle' | 'submitting' | 'polling' | 'ready' | 'saving' | 'error'
  >('idle');
  const [anchorErr, setAnchorErr] = useState<string | null>(null);
  const [anchorFreeAvail, setAnchorFreeAvail] = useState<boolean>(true);
  // 사용자가 batch 그리드에서 고른 후보들 (slot 별 1개씩).
  const [pendingGroomRequestId, setPendingGroomRequestId] = useState<string | null>(null);
  const [pendingBrideRequestId, setPendingBrideRequestId] = useState<string | null>(null);

  const [snapBalance, setSnapBalance] = useState<number | null>(null);

  // 앵커 생성 표정 옵션 — 3종: 차분한 자연 표정 / 약간 미소 / 환하게 웃는 미소.
  const [expression, setExpression] = useState<AnchorExpression>('neutral');

  // 무료 full-batch 잔량 (0~2). API 응답으로 채워짐. 화면 안내·버튼 활성에 사용.
  const [freeBatchesLeft, setFreeBatchesLeft] = useState<number>(2);

  // 앵커 라이브러리 — 과거 anchor (snap_anchor_history). 카탈로그 생성 시 선택지.
  const [library, setLibrary] = useState<LibraryAnchor[]>([]);
  // 카탈로그 생성에 쓸 앵커 — 'current' = snap_anchors 현재 앵커, UUID = 라이브러리.
  const [selectedAnchorId, setSelectedAnchorId] = useState<string>('current');

  // 카탈로그 다중 선택 — 한 번에 N개 제출 가능. 비동기 finalize 라 페이지 이탈 OK.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [stage, setStage] = useState<Stage>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // 다중 제출 결과 — 성공/실패 카운트 표시용.
  const [submitSummary, setSubmitSummary] = useState<{
    ok: number;
    failed: Array<{ catalogId: string; reason: string }>;
  } | null>(null);

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

  const isProgressing = stage === 'submitting';
  const isAnchorBusy = anchorStage === 'submitting' || anchorStage === 'polling' || anchorStage === 'saving';

  // 앵커가 "완전히" 저장됐는지 — 신랑/신부 둘 다 set.
  const hasFullAnchor = !!anchor?.groomAnchorUrl && !!anchor?.brideAnchorUrl;

  // 초기 로드.
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
            groomAnchorUrl: (a.anchor.groom_anchor_url as string | null) ?? null,
            brideAnchorUrl: (a.anchor.bride_anchor_url as string | null) ?? null,
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
        if (typeof a?.freeBatchesLeft === 'number') {
          setFreeBatchesLeft(a.freeBatchesLeft);
        }
        // 라이브러리 — 과거 완성 앵커들 (양쪽 URL 모두 있는 것만).
        if (Array.isArray(a?.library)) {
          const lib: LibraryAnchor[] = a.library
            .filter(
              (e: Record<string, unknown>) => !!e.groom_anchor_url && !!e.bride_anchor_url,
            )
            .map((e: Record<string, unknown>) => ({
              id: e.id as string,
              groomAnchorUrl: e.groom_anchor_url as string,
              brideAnchorUrl: e.bride_anchor_url as string,
              createdAt: (e.anchor_created_at as string) ?? (e.discarded_at as string) ?? '',
            }));
          setLibrary(lib);
          // 현재 앵커가 없는데 라이브러리가 있으면 기본 선택을 첫 라이브러리로.
          const hasCurrent = !!a.anchor?.groom_anchor_url && !!a.anchor?.bride_anchor_url;
          if (!hasCurrent && lib.length > 0) {
            setSelectedAnchorId(lib[0].id);
          }
        }
        if (typeof e?.snapCredits === 'number') setSnapBalance(e.snapCredits);
      } catch {
        // 비로그인 등 — 그대로.
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

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

  // 셀카 입력 ready — 각 slot 의 첫 N장 모두 url 채워짐.
  const selfiesReady = (() => {
    for (let i = 0; i < numAngles; i += 1) {
      if (!groomFaces[i].url || !brideFaces[i].url) return false;
    }
    return true;
  })();
  const inputsReady = mode === 'couple' ? !!couple.url : selfiesReady;

  const collectGroomUrls = (): string[] =>
    groomFaces.slice(0, numAngles).map((f) => f.url).filter((u): u is string => !!u);
  const collectBrideUrls = (): string[] =>
    brideFaces.slice(0, numAngles).map((f) => f.url).filter((u): u is string => !!u);

  // ── 앵커 batch 4장 (2 groom + 2 bride) 제출 ───────────────
  // slot 별 셀카 준비 상태 — 부분 재생성 가능 여부.
  const groomSelfiesReady = (() => {
    for (let i = 0; i < numAngles; i += 1) {
      if (!groomFaces[i].url) return false;
    }
    return true;
  })();
  const brideSelfiesReady = (() => {
    for (let i = 0; i < numAngles; i += 1) {
      if (!brideFaces[i].url) return false;
    }
    return true;
  })();

  const canGenerateAnchor = mode !== 'couple' && inputsReady && !isAnchorBusy;
  const canRegenGroomOnly = mode !== 'couple' && groomSelfiesReady && !isAnchorBusy;
  const canRegenBrideOnly = mode !== 'couple' && brideSelfiesReady && !isAnchorBusy;

  // slots 인자로 부분 재생성 (groom only / bride only / both) 도 지원.
  const handleGenerateAnchorBatch = async (slots: AnchorSlot[] = ['groom', 'bride']) => {
    if (mode === 'couple' || isAnchorBusy) return;
    // 슬롯별 입력 검증.
    if (slots.includes('groom') && !groomSelfiesReady) {
      setAnchorErr('신랑 셀카를 모두 업로드해주세요.');
      return;
    }
    if (slots.includes('bride') && !brideSelfiesReady) {
      setAnchorErr('신부 셀카를 모두 업로드해주세요.');
      return;
    }
    setAnchorErr(null);
    setAnchorStage('submitting');
    setPendingGroomRequestId(null);
    setPendingBrideRequestId(null);

    const groomBodyValid = parseBody(groomBody);
    const brideBodyValid = parseBody(brideBody);

    const payload: Record<string, unknown> = {
      mode: 'selfies' as const,
      slots,
      expression,
      ...(slots.includes('groom') ? { groomFaceUrls: collectGroomUrls() } : {}),
      ...(slots.includes('bride') ? { brideFaceUrls: collectBrideUrls() } : {}),
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
      const ids = data?.requestIds as
        | Array<{ slot: AnchorSlot; framing: AnchorFraming; requestId: string }>
        | undefined;
      if (!ids?.length) throw new Error('서버가 요청 ID를 돌려주지 않았습니다.');
      const batch: AnchorCandidate[] = ids.map((x) => ({
        slot: x.slot,
        framing: x.framing,
        requestId: x.requestId,
        resultUrl: null,
        status: 'pending',
      }));
      setAnchorBatch(batch);
      // 응답에 freeBatchesLeft 가 오면 그 값으로, 아니면 한 번 사용했다 가정해 -1.
      if (typeof data?.freeBatchesLeft === 'number') {
        setFreeBatchesLeft(data.freeBatchesLeft);
        setAnchorFreeAvail(data.freeBatchesLeft > 0);
      } else {
        setFreeBatchesLeft((n) => Math.max(0, n - 1));
        setAnchorFreeAvail((avail) => avail && freeBatchesLeft - 1 > 0);
      }
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
            const url = (s.data?.imageUrl as string | undefined) ?? null;
            current[idx] = { ...current[idx], status: 'done', resultUrl: url };
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

  // 사용자가 슬롯별로 후보를 토글. 둘 다 선택돼야 "저장" 활성화.
  const selectCandidate = (c: AnchorCandidate) => {
    if (c.status !== 'done') return;
    if (c.slot === 'groom') setPendingGroomRequestId(c.requestId);
    else setPendingBrideRequestId(c.requestId);
  };

  // 현재 batch 에 포함된 slots — 부분 재생성 시 한 slot 만 있을 수 있음.
  const batchSlots = anchorBatch
    ? Array.from(new Set(anchorBatch.map((c) => c.slot)))
    : [];
  const groomNeeded = batchSlots.includes('groom');
  const brideNeeded = batchSlots.includes('bride');
  const canSaveAnchor =
    !!anchorBatch &&
    (groomNeeded ? !!pendingGroomRequestId : true) &&
    (brideNeeded ? !!pendingBrideRequestId : true) &&
    anchorStage !== 'saving';

  const handleSaveAnchor = async () => {
    if (!canSaveAnchor) return;
    setAnchorStage('saving');
    setAnchorErr(null);
    try {
      const res = await fetch('/api/snap/anchor', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          groomRequestId: pendingGroomRequestId,
          brideRequestId: pendingBrideRequestId,
        }),
      });
      const { data, text } = await parseRes(res);
      if (!res.ok) {
        const base = (data?.error as string | undefined) ?? text.slice(0, 80) ?? `HTTP ${res.status}`;
        const detail = data?.detail as string | undefined;
        const code = data?.code as string | undefined;
        throw new Error(detail ? `${base}\n원인: ${detail}${code ? ` (${code})` : ''}` : base);
      }
      const groomUrl = data?.groomAnchorUrl as string | undefined;
      const brideUrl = data?.brideAnchorUrl as string | undefined;
      setAnchor({
        groomAnchorUrl: groomUrl ?? null,
        brideAnchorUrl: brideUrl ?? null,
        sourceMode: 'selfies',
      });
      setAnchorBatch(null);
      setPendingGroomRequestId(null);
      setPendingBrideRequestId(null);
      setAnchorStage('idle');
    } catch (e) {
      setAnchorErr(e instanceof Error ? e.message : '앵커 저장 실패');
      setAnchorStage('error');
    }
  };

  const handleDiscardAnchor = async () => {
    const willBeFree = freeBatchesLeft > 0;
    const msg = willBeFree
      ? `현재 앵커를 폐기할까요? 무료 batch ${freeBatchesLeft}회가 남아 있어요.`
      : '현재 앵커를 폐기할까요? 다음 앵커 batch 는 4 스냅 크레딧이 필요합니다.';
    if (!confirm(msg)) return;
    try {
      await fetch('/api/snap/anchor', { method: 'DELETE' });
      setAnchor(null);
      setAnchorFreeAvail(false);
    } catch {
      setAnchorErr('앵커 폐기에 실패했습니다.');
    }
  };

  // ── 카탈로그 생성 ────────────────────────────────────────
  // 카탈로그 필터링: couple 모드에서는 solo 카탈로그 숨김.
  const visibleCatalog = catalog.filter((c) => {
    if (mode === 'couple') return c.personality === 'together';
    return true;
  });

  // 한 카탈로그가 현재 입력 (mode + anchor) 으로 생성 가능한지 판정.
  // 다중 선택 UI 가 개별 카탈로그 자체의 enable/disable 판단에 사용.
  const isCatalogGeneratable = (item: SnapCatalogItem): boolean => {
    if (mode === 'couple') return !!couple.url && item.personality === 'together';
    // selfies 모드 — personality 별 slot 검증.
    if (item.personality === 'together') {
      return !!anchor?.groomAnchorUrl && !!anchor?.brideAnchorUrl;
    }
    if (item.personality === 'groom-solo') return !!anchor?.groomAnchorUrl;
    if (item.personality === 'bride-solo') return !!anchor?.brideAnchorUrl;
    return false;
  };

  // 선택된 카탈로그 목록 (실제 객체) — 다중 선택 후 제출 시 사용.
  const selectedCatalogs = Array.from(selectedIds)
    .map((id) => catalog.find((c) => c.id === id))
    .filter((c): c is SnapCatalogItem => !!c);

  // 한 번에 제출 가능 여부 — 1개 이상 선택 + 모두 generatable + 진행 중 아님.
  const canGenerateCatalog =
    selectedCatalogs.length > 0 &&
    !isProgressing &&
    selectedCatalogs.every(isCatalogGeneratable);

  const toggleCatalogSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // submit-and-go: 선택된 N개 카탈로그를 fal 큐에 병렬 제출. 폴링은 마이페이지가
  // 담당. 사용자는 페이지 자유 이탈 가능. 부분 실패 시 성공/실패 카운트 표시.
  const handleGenerateCatalog = async () => {
    if (!canGenerateCatalog) return;

    setStage('submitting');
    setErrorMsg(null);
    setSubmitSummary(null);

    const groomBodyValid = parseBody(groomBody);
    const brideBodyValid = parseBody(brideBody);

    const buildPayload = (item: SnapCatalogItem): Record<string, unknown> => {
      if (mode === 'couple') {
        return {
          mode: 'couple',
          couplePhotoUrl: couple.url,
          catalogId: item.id,
          ...(groomBodyValid ? { groomBody: groomBodyValid } : {}),
          ...(brideBodyValid ? { brideBody: brideBodyValid } : {}),
        };
      }
      // anchorId — 'current' (default, snap_anchors) 또는 라이브러리 UUID.
      return { mode: 'anchor', catalogId: item.id, anchorId: selectedAnchorId };
    };

    // 병렬 제출 — 각각 독립. 부분 실패 케이스를 위해 Promise.allSettled.
    const results = await Promise.allSettled(
      selectedCatalogs.map(async (item) => {
        const res = await fetch('/api/snap/generate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(buildPayload(item)),
        });
        const { data, text } = await parseRes(res);
        if (!res.ok) {
          if (data?.code === 'insufficient_credits') {
            setSnapBalance((data?.currentBalance as number | undefined) ?? 0);
          }
          throw new Error(
            (data?.error as string | undefined) ?? text.slice(0, 80) ?? `HTTP ${res.status}`,
          );
        }
        if (typeof data?.balance === 'number') setSnapBalance(data.balance);
        return { catalogId: item.id };
      }),
    );

    const ok: string[] = [];
    const failed: Array<{ catalogId: string; reason: string }> = [];
    results.forEach((r, i) => {
      const item = selectedCatalogs[i];
      if (r.status === 'fulfilled') ok.push(item.id);
      else
        failed.push({
          catalogId: item.id,
          reason: r.reason instanceof Error ? r.reason.message : '제출 실패',
        });
    });

    setSubmitSummary({ ok: ok.length, failed });
    // 성공한 카탈로그는 선택 해제 (실패한 건 재시도 위해 유지).
    setSelectedIds(new Set(failed.map((f) => f.catalogId)));
    setStage('submitted');
  };

  // ── 헬퍼 / 표시용 ───────────────────────────────────────
  // 셀카 모드 = 항상 입력 + 앵커 빌더 노출. 앵커 이미 저장됐어도 부분 재생성
  // 가능해야 하므로 hide 하지 않음.
  const showSelfieInputs = mode !== 'couple';
  const showCoupleInputs = mode === 'couple';
  const showAnchorBuilder = mode !== 'couple';

  const pathHint = (() => {
    if (mode === 'couple') return '커플 사진 기반 (앵커 영향 없음)';
    if (selectedCatalogs.length === 0) return '카탈로그를 선택하면 경로가 표시돼요';
    const kinds = new Set(selectedCatalogs.map((c) => c.personality));
    if (kinds.size > 1) return '여러 경로 혼합 (함께 / 단독)';
    const k = selectedCatalogs[0].personality;
    if (k === 'groom-solo') return '신랑 앵커 단독 컷';
    if (k === 'bride-solo') return '신부 앵커 단독 컷';
    return '신랑·신부 앵커 합성';
  })();

  return (
    <div className="mt-6 flex flex-col gap-6">
      {/* 0. 현재 상태 카드 — 크레딧 + 신랑/신부 앵커 썸네일 */}
      <StatusCard
        snapBalance={snapBalance}
        groomAnchorUrl={anchor?.groomAnchorUrl ?? null}
        brideAnchorUrl={anchor?.brideAnchorUrl ?? null}
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

        {mode === 'selfies1' && (
          <p className="mt-3 text-xs text-[#8B7355]">
            정면 클로즈업 사진을 한 장씩 올려주세요. 빠르고 간편한 기본 옵션.
          </p>
        )}
        {mode === 'selfies3' && (
          <p className="mt-3 text-xs text-[#8B7355]">
            정면 + 좌 45° + 우 45° 사진을 각 3장씩 올려주세요. 모델이 3D 얼굴을 더
            정확히 잡아 측면 컷에서도 정체성이 안정적입니다. <strong>권장</strong>.
          </p>
        )}
        {mode === 'couple' && (
          <p className="mt-3 text-xs text-[#8B7355]">
            두 사람이 함께 찍힌 정면 사진을 1장 올려주세요. <strong>커플 사진
            모드는 앵커 영향을 받지 않습니다</strong> — 사용자 포즈/체형/상호작용을
            그대로 유지. 단독 카탈로그는 숨겨집니다.
          </p>
        )}

        {/* 셀카 거리 가이드 — 광각 왜곡(볼록렌즈 효과) 회피 안내.
            너무 가까이서 찍은 셀카는 코·얼굴 가운데가 부풀고 옆얼굴이 작아 보여,
            앵커 → 카탈로그 합성 결과의 비율이 어색해진다. */}
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-[11px] text-[#5C4633]">
          <p className="font-semibold text-amber-800">
            📸 좋은 결과를 위한 사진 가이드
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            <li>
              <strong>가까이서 찍은 셀카는 피해주세요.</strong> 휴대폰 전면 카메라는
              광각이라 얼굴 가운데(코)가 부풀고 비율이 어색해집니다.
            </li>
            <li>
              <strong>팔을 끝까지 뻗어서</strong> 찍거나 (최소), <strong>다른 사람이
              1.5~2m 거리</strong>에서 찍어주면 가장 좋아요.
            </li>
            <li>
              <strong>증명사진 · 프로필 사진 · 인물 사진</strong>도 매우 좋습니다.
              꼭 셀카일 필요 없어요.
            </li>
            <li>
              밝은 곳에서 얼굴이 또렷하게 보이도록. 강한 보정 필터·선글라스·마스크는
              피해주세요.
            </li>
          </ul>
        </div>

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

        {mode !== 'couple' && hasFullAnchor && (
          <p className="mt-3 rounded-md border border-[#E8DCC9] bg-[#FAF7F2] p-3 text-xs text-[#5C4633]">
            ✓ 신랑/신부 앵커가 저장되어 있어요. 카탈로그를 바로 선택할 수 있고,
            얼굴이 마음에 안 들면 아래에서 셀카를 다시 업로드해 신랑/신부
            슬롯별로 부분 재생성도 가능합니다.
          </p>
        )}

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

      {/* 1-b. 키 / 몸무게 */}
      {(showSelfieInputs || showCoupleInputs) && (
        <section className="rounded-md border border-[#E8DCC9] bg-white p-4">
          <h2 className="text-sm font-medium text-[#3D2E1F]">
            1-1. 키 · 몸무게 <span className="text-[10px] text-[#8B7355]">(선택)</span>
          </h2>
          <p className="mt-1 text-xs text-[#8B7355]">
            전신 / 반신 컷의 비율을 맞추는 데 사용돼요. 키 {HEIGHT_RANGE.min}–
            {HEIGHT_RANGE.max}cm · 몸무게 {WEIGHT_RANGE.min}–{WEIGHT_RANGE.max}kg.
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

      {/* 2. 앵커 만들기 — 셀카 모드 + 미완성 앵커일 때만 */}
      {showAnchorBuilder && (
        <section className="rounded-md border border-[#E8DCC9] bg-white p-4">
          <h2 className="text-sm font-medium text-[#3D2E1F]">2. 앵커 만들기</h2>
          <p className="mt-1 text-xs text-[#8B7355]">
            한 번에 신랑 단독 2장 + 신부 단독 2장 (클로즈업 / 반신) 을 만들어
            드려요. 각 row 에서 마음에 드는 컷을 1장씩 골라 저장하면 모든 카탈로그
            (함께 컷 / 단독 컷) 에 적용됩니다.
            {freeBatchesLeft > 0 ? (
              <>
                {' '}
                <span className="font-medium text-emerald-700">
                  무료 {freeBatchesLeft}회 남음
                </span>
                {' '}(첫 생성 + 재생성 1회까지 무료).
              </>
            ) : (
              <>
                {' '}
                재생성에는 <span className="font-medium">4 스냅 크레딧</span>이 필요합니다.
              </>
            )}
          </p>

          {/* 표정 옵션 — 3종 (차분한 자연 표정 / 약간 미소 / 환하게 웃는 미소) */}
          <div className="mt-3 flex flex-col gap-1.5 text-xs text-[#5C4633]">
            <span className="font-medium">표정</span>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: 'neutral', label: '차분한 자연', hint: '미소 강제 안 함' },
                { v: 'slight', label: '약간 미소', hint: '입꼬리 살짝' },
                { v: 'bright', label: '환하게 웃는', hint: '치아 약간 + 눈웃음' },
              ] as const).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setExpression(opt.v)}
                  disabled={isAnchorBusy}
                  aria-pressed={expression === opt.v}
                  className={`flex flex-col items-center gap-0.5 rounded-md border px-2 py-1.5 text-[11px] transition-colors disabled:opacity-50 ${
                    expression === opt.v
                      ? 'border-[#3D2E1F] bg-[#3D2E1F] text-white'
                      : 'border-[#D4C5B0] bg-white text-[#3D2E1F] hover:bg-[#F5EDE0]'
                  }`}
                >
                  <span className="font-medium">{opt.label}</span>
                  <span
                    className={`text-[10px] ${
                      expression === opt.v ? 'opacity-80' : 'text-[#8B7355]'
                    }`}
                  >
                    {opt.hint}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            {anchorFreeAvail ? (
              // 첫 batch — 전체 무료 1 button.
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  onClick={() => void handleGenerateAnchorBatch(['groom', 'bride'])}
                  disabled={!canGenerateAnchor}
                >
                  {anchorStage === 'submitting'
                    ? '제출 중...'
                    : anchorStage === 'polling'
                      ? '생성 중...'
                      : anchorStage === 'saving'
                        ? '저장 중...'
                        : '앵커 후보 만들기 (무료)'}
                </Button>
                {!inputsReady && (
                  <span className="text-xs text-[#8B7355]">
                    {mode === 'selfies3' ? '신랑/신부 각 3장씩 업로드' : '신랑/신부 각 1장씩 업로드'}
                  </span>
                )}
              </div>
            ) : (
              // 두 번째 batch 부터 — 부분 재생성 3 button.
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleGenerateAnchorBatch(['groom'])}
                  disabled={!canRegenGroomOnly}
                >
                  {anchorStage === 'submitting' || anchorStage === 'polling'
                    ? '생성 중...'
                    : '신랑만 재생성 (2 크레딧)'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleGenerateAnchorBatch(['bride'])}
                  disabled={!canRegenBrideOnly}
                >
                  {anchorStage === 'submitting' || anchorStage === 'polling'
                    ? '생성 중...'
                    : '신부만 재생성 (2 크레딧)'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleGenerateAnchorBatch(['groom', 'bride'])}
                  disabled={!canGenerateAnchor}
                >
                  {anchorStage === 'submitting' || anchorStage === 'polling'
                    ? '생성 중...'
                    : '둘 다 재생성 (4 크레딧)'}
                </Button>
                {!groomSelfiesReady && !brideSelfiesReady && (
                  <span className="text-xs text-[#8B7355]">셀카를 업로드하세요</span>
                )}
              </div>
            )}
          </div>

          {anchorErr && (
            <p role="alert" className="mt-3 whitespace-pre-line text-xs text-red-600">
              {anchorErr}
            </p>
          )}

          {anchorBatch && (
            <div className="mt-4 flex flex-col gap-4">
              <p className="text-xs text-[#5C4633]">
                {groomNeeded && brideNeeded
                  ? '신랑 / 신부 각 row 에서 마음에 드는 컷을 1장씩 선택한 뒤 아래 "앵커 저장" 을 누르세요.'
                  : groomNeeded
                    ? '신랑 컷 하나를 선택한 뒤 "앵커 저장" 을 누르세요. 신부 앵커는 그대로 유지됩니다.'
                    : '신부 컷 하나를 선택한 뒤 "앵커 저장" 을 누르세요. 신랑 앵커는 그대로 유지됩니다.'}
              </p>
              {groomNeeded && (
                <AnchorRowGrid
                  slot="groom"
                  label="신랑"
                  candidates={anchorBatch.filter((c) => c.slot === 'groom')}
                  selectedRequestId={pendingGroomRequestId}
                  onSelect={selectCandidate}
                  disabled={anchorStage === 'saving'}
                />
              )}
              {brideNeeded && (
                <AnchorRowGrid
                  slot="bride"
                  label="신부"
                  candidates={anchorBatch.filter((c) => c.slot === 'bride')}
                  selectedRequestId={pendingBrideRequestId}
                  onSelect={selectCandidate}
                  disabled={anchorStage === 'saving'}
                />
              )}
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleSaveAnchor()}
                  disabled={!canSaveAnchor}
                >
                  {anchorStage === 'saving' ? '저장 중...' : '앵커 저장'}
                </Button>
                {!canSaveAnchor && anchorStage !== 'saving' && (
                  <span className="text-xs text-[#8B7355]">
                    {!pendingGroomRequestId && !pendingBrideRequestId
                      ? '신랑/신부 각 1장씩 선택해주세요'
                      : !pendingGroomRequestId
                        ? '신랑 컷을 선택해주세요'
                        : '신부 컷을 선택해주세요'}
                  </span>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 3-a. 앵커 선택 — selfies 모드 + (현재 앵커 또는 라이브러리) 가 있을 때.
              카탈로그 생성에 어떤 앵커를 적용할지 사용자가 고를 수 있다. */}
      {mode !== 'couple' &&
        (!!anchor?.groomAnchorUrl || !!anchor?.brideAnchorUrl || library.length > 0) && (
          <section className="rounded-md border border-[#E8DCC9] bg-white p-4">
            <h2 className="text-sm font-medium text-[#3D2E1F]">사용할 앵커 선택</h2>
            <p className="mt-1 text-xs text-[#8B7355]">
              과거에 만든 앵커도 골라 쓸 수 있어요. 카탈로그 생성에 적용됩니다.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {/* 현재 앵커 카드 */}
              {(anchor?.groomAnchorUrl || anchor?.brideAnchorUrl) && (
                <button
                  type="button"
                  onClick={() => setSelectedAnchorId('current')}
                  aria-pressed={selectedAnchorId === 'current'}
                  className={`relative flex flex-col gap-1 rounded-md border p-2 text-left transition-colors ${
                    selectedAnchorId === 'current'
                      ? 'border-[#3D2E1F] ring-2 ring-[#3D2E1F]/30'
                      : 'border-[#E8DCC9] hover:border-[#8B7355]'
                  }`}
                >
                  <div className="grid grid-cols-2 gap-1">
                    <AnchorTinyThumb url={anchor.groomAnchorUrl} />
                    <AnchorTinyThumb url={anchor.brideAnchorUrl} />
                  </div>
                  <span className="text-[11px] font-medium text-[#3D2E1F]">현재 앵커</span>
                  <span className="text-[10px] text-[#8B7355]">최근 저장</span>
                </button>
              )}
              {/* 라이브러리 (과거) */}
              {library.map((lib) => (
                <button
                  key={lib.id}
                  type="button"
                  onClick={() => setSelectedAnchorId(lib.id)}
                  aria-pressed={selectedAnchorId === lib.id}
                  className={`relative flex flex-col gap-1 rounded-md border p-2 text-left transition-colors ${
                    selectedAnchorId === lib.id
                      ? 'border-[#3D2E1F] ring-2 ring-[#3D2E1F]/30'
                      : 'border-[#E8DCC9] hover:border-[#8B7355]'
                  }`}
                >
                  <div className="grid grid-cols-2 gap-1">
                    <AnchorTinyThumb url={lib.groomAnchorUrl} />
                    <AnchorTinyThumb url={lib.brideAnchorUrl} />
                  </div>
                  <span className="text-[11px] font-medium text-[#3D2E1F]">라이브러리</span>
                  <span className="text-[10px] text-[#8B7355]">
                    {formatLibraryDate(lib.createdAt)}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

      {/* 3. 카탈로그 선택 — 다중 선택 가능 */}
      <section className="rounded-md border border-[#E8DCC9] bg-white p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium text-[#3D2E1F]">카탈로그 컷 선택</h2>
          {selectedIds.size > 0 && (
            <span className="text-[11px] text-[#5C4633]">
              {selectedIds.size}개 선택 · {selectedIds.size} 스냅 크레딧 차감
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-[#8B7355]">
          여러 컷을 선택해 한 번에 만들 수 있어요. 1장당 스냅 크레딧 1개 차감.{' '}
          <span className="text-[10px] text-[#8B7355]">· 현재 경로: {pathHint}</span>
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {visibleCatalog.map((item) => {
            const selected = selectedIds.has(item.id);
            const enabled = isCatalogGeneratable(item);
            const dim = isProgressing || !enabled;
            return (
              <button
                key={item.id}
                type="button"
                disabled={isProgressing || !enabled}
                onClick={() => toggleCatalogSelection(item.id)}
                aria-pressed={selected}
                title={!enabled ? '이 컷을 만들려면 필요한 앵커 / 입력이 부족해요' : undefined}
                className={`relative flex flex-col overflow-hidden rounded-md border text-left transition-colors ${
                  selected
                    ? 'border-[#3D2E1F] ring-2 ring-[#3D2E1F]/30'
                    : 'border-[#E8DCC9] hover:border-[#8B7355]'
                } ${dim ? 'opacity-50' : ''}`}
              >
                {/* 우상단 체크 인디케이터 — 좌상단 PersonalityBadge 와 겹치지 않도록 우측에 배치.
                    배경 이미지의 명도와 무관하게 보이도록 흰 테두리 + 그림자 + 반투명 배경 적용.
                    선택 시: 채워진 다크 박스 + 흰 ✓.  미선택 시: 반투명 다크 박스 + 흰 테두리. */}
                <span
                  className={`pointer-events-none absolute right-2 top-2 z-20 grid h-6 w-6 place-items-center rounded-full border-2 text-[13px] font-bold leading-none shadow-md backdrop-blur-sm transition-all ${
                    selected
                      ? 'border-white bg-[#3D2E1F] text-white scale-110'
                      : 'border-white/90 bg-black/35 text-white/0'
                  }`}
                  aria-hidden
                >
                  ✓
                </span>
                <CatalogThumbnail src={item.image} alt={item.label} />
                <PersonalityBadge personality={item.personality} />
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
              ? `제출 중... (${selectedIds.size}개)`
              : selectedIds.size === 0
                ? `생성하기 ${snapBalance !== null ? `(잔여 ${snapBalance})` : ''}`
                : `${selectedIds.size}개 동시 생성 (${selectedIds.size} 크레딧${snapBalance !== null ? ` · 잔여 ${snapBalance}` : ''})`}
          </Button>
          {!canGenerateCatalog && stage !== 'submitting' && (
            <GenerateHint
              mode={mode}
              hasFullAnchor={hasFullAnchor}
              anchor={anchor}
              selectedCount={selectedIds.size}
              couplePresent={!!couple.url}
            />
          )}
          {selectedIds.size > 0 && stage !== 'submitting' && (
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-[11px] text-[#8B7355] underline underline-offset-2 hover:text-[#3D2E1F]"
            >
              선택 모두 해제
            </button>
          )}
        </div>
        <p className="mt-2 text-[11px] text-[#8B7355]">
          제출 후 화면을 떠나도 생성은 백그라운드에서 계속 진행됩니다. 결과는
          <a href="/mypage?tab=snap" className="ml-1 underline underline-offset-2">
            마이페이지 &gt; AI 웨딩스냅
          </a>{' '}
          탭에서 확인할 수 있어요.
        </p>
        {errorMsg && (
          <p
            role="alert"
            className="mt-3 whitespace-pre-line text-xs text-red-600"
          >
            {errorMsg}
          </p>
        )}
      </section>

      {/* 5. 제출 완료 배너 — 비동기 모드 안내 + 다중 제출 결과 */}
      {stage === 'submitted' && submitSummary && (
        <section
          className={`rounded-md border p-4 ${
            submitSummary.failed.length === 0
              ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-900/10'
              : 'border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-900/10'
          }`}
        >
          <h2
            className={`text-sm font-medium ${
              submitSummary.failed.length === 0
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-amber-800 dark:text-amber-200'
            }`}
          >
            {submitSummary.failed.length === 0
              ? `✨ ${submitSummary.ok}개 작업 모두 시작되었어요`
              : `⚠️ ${submitSummary.ok}개 시작 · ${submitSummary.failed.length}개 실패`}
          </h2>
          <p className="mt-1 text-xs text-[#5C4633]">
            평균 20–60초 후에 완성됩니다. 화면을 떠나도 생성은 계속 진행되며, 결과는
            마이페이지에서 모아 볼 수 있어요.
          </p>
          {submitSummary.failed.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 text-[11px] text-amber-900 dark:text-amber-200">
              {submitSummary.failed.map((f) => {
                const item = catalog.find((c) => c.id === f.catalogId);
                return (
                  <li key={f.catalogId}>
                    · {item?.label ?? f.catalogId}: {f.reason}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <a href="/mypage?tab=snap">마이페이지에서 결과 보기</a>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setStage('idle');
                setSubmitSummary(null);
                setErrorMsg(null);
              }}
            >
              다른 컷도 만들기
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function GenerateHint({
  mode,
  hasFullAnchor,
  anchor,
  selectedCount,
  couplePresent,
}: {
  mode: InputMode;
  hasFullAnchor: boolean;
  anchor: AnchorInfo | null;
  selectedCount: number;
  couplePresent: boolean;
}) {
  let text = '';
  if (selectedCount === 0) text = '카탈로그 컷을 1개 이상 선택하세요';
  else if (mode === 'couple') {
    if (!couplePresent) text = '커플 사진을 업로드하세요';
    else text = '커플 모드는 "함께" 컷만 선택 가능합니다';
  } else if (!hasFullAnchor) {
    if (!anchor?.groomAnchorUrl && !anchor?.brideAnchorUrl) text = '앵커를 먼저 만들어 주세요';
    else text = '선택한 컷 중 필요한 앵커가 부족한 컷이 있어요';
  }
  if (!text) return null;
  return <span className="text-xs text-[#8B7355]">{text}</span>;
}

function AnchorRowGrid({
  slot,
  label,
  candidates,
  selectedRequestId,
  onSelect,
  disabled,
}: {
  slot: AnchorSlot;
  label: string;
  candidates: AnchorCandidate[];
  selectedRequestId: string | null;
  onSelect: (c: AnchorCandidate) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-[#3D2E1F]">
        {label} <span className="text-[10px] text-[#8B7355]">({slot === 'groom' ? '신랑' : '신부'} 단독 2 컷)</span>
      </p>
      <div className="grid grid-cols-2 gap-3">
        {candidates.map((c) => {
          const tpl = ANCHOR_TEMPLATES.find((t) => t.slot === c.slot && t.framing === c.framing);
          const isSelected = selectedRequestId === c.requestId;
          return (
            <button
              key={c.requestId}
              type="button"
              disabled={disabled || c.status !== 'done'}
              onClick={() => onSelect(c)}
              className={`flex flex-col overflow-hidden rounded-md border text-left transition-colors ${
                isSelected
                  ? 'border-[#3D2E1F] ring-2 ring-[#3D2E1F]/30'
                  : c.status === 'done'
                    ? 'border-[#E8DCC9] hover:border-[#8B7355]'
                    : 'border-[#E8DCC9] opacity-70'
              }`}
            >
              <div className="grid aspect-[3/4] w-full place-items-center overflow-hidden bg-[#F5EDE0]">
                {c.resultUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.resultUrl}
                    alt={tpl?.label ?? c.framing}
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
                <p className="text-xs font-medium text-[#3D2E1F]">
                  {c.framing === 'closeup' ? '클로즈업' : '반신'}
                </p>
                <p className="mt-0.5 text-[10px] text-[#8B7355]">
                  {isSelected ? '✓ 선택됨' : c.status === 'done' ? '눌러서 선택' : '...'}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PersonalityBadge({ personality }: { personality: SnapCatalogItem['personality'] }) {
  const config = {
    together: { label: '함께', color: 'bg-[#3D2E1F]/85' },
    'groom-solo': { label: '신랑 단독', color: 'bg-blue-600/85' },
    'bride-solo': { label: '신부 단독', color: 'bg-pink-600/85' },
  }[personality];
  return (
    <span
      className={`absolute left-1 top-1 rounded px-1.5 py-0.5 text-[9px] font-medium text-white ${config.color}`}
    >
      {config.label}
    </span>
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
  groomAnchorUrl,
  brideAnchorUrl,
  freeActivationAvailable,
  onDiscardAnchor,
}: {
  snapBalance: number | null;
  groomAnchorUrl: string | null;
  brideAnchorUrl: string | null;
  freeActivationAvailable: boolean;
  onDiscardAnchor: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasAny = !!groomAnchorUrl || !!brideAnchorUrl;
  const hasBoth = !!groomAnchorUrl && !!brideAnchorUrl;

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
          {hasAny ? (
            <>
              <AnchorThumb url={groomAnchorUrl} label="신랑" onToggle={() => setExpanded((v) => !v)} />
              <AnchorThumb url={brideAnchorUrl} label="신부" onToggle={() => setExpanded((v) => !v)} />
              <span className={`font-medium ${hasBoth ? 'text-emerald-700' : 'text-amber-700'}`}>
                {hasBoth ? '완료' : '부분 저장'}
              </span>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="text-[11px] text-[#8B7355] underline underline-offset-2 hover:text-[#3D2E1F]"
              >
                {expanded ? '접기' : '크게 보기'}
              </button>
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

      {hasAny && expanded && (
        <div className="grid grid-cols-2 gap-3">
          <AnchorBigPreview url={groomAnchorUrl} label="신랑 앵커" />
          <AnchorBigPreview url={brideAnchorUrl} label="신부 앵커" />
        </div>
      )}
    </div>
  );
}

/** 라이브러리 picker 카드 안의 작은 thumbnail. 클릭 동작은 부모 button 이 처리. */
function AnchorTinyThumb({ url }: { url: string | null }) {
  if (!url) {
    return (
      <div className="grid aspect-[3/4] w-full place-items-center rounded border border-dashed border-[#D4C5B0] bg-[#F5EDE0] text-[9px] text-[#8B7355]">
        없음
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded border border-[#D4C5B0]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="block aspect-[3/4] w-full object-cover" />
    </div>
  );
}

/** 라이브러리 라벨용 — anchor_created_at 또는 discarded_at 을 짧게 표시. */
function formatLibraryDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function AnchorThumb({
  url,
  label,
  onToggle,
}: {
  url: string | null;
  label: string;
  onToggle: () => void;
}) {
  if (!url) {
    return (
      <span className="inline-flex h-10 w-8 items-center justify-center rounded border border-dashed border-[#D4C5B0] text-[9px] text-[#8B7355]">
        {label} X
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      title={`${label} 앵커 크게 보기`}
      className="inline-flex h-10 w-8 overflow-hidden rounded border border-[#D4C5B0] transition-transform hover:scale-105"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={label} className="h-full w-full object-cover" />
    </button>
  );
}

function AnchorBigPreview({ url, label }: { url: string | null; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[11px] font-medium text-[#5C4633]">{label}</p>
      <div className="grid aspect-[3/4] w-full place-items-center overflow-hidden rounded border border-[#D4C5B0] bg-white">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="block h-full w-full object-contain" />
        ) : (
          <span className="text-xs text-[#8B7355]">미선택</span>
        )}
      </div>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-center text-[10px] text-[#8B7355] underline underline-offset-2 hover:text-[#3D2E1F]"
        >
          새 탭에서 원본
        </a>
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
        className={`relative grid w-full place-items-center overflow-hidden rounded bg-[#F5EDE0] ${
          wide ? 'aspect-[4/3] max-w-[280px]' : 'aspect-square max-w-[140px]'
        }`}
      >
        {face.preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={face.preview} alt={label} className="block h-full w-full object-contain" />
            {/* 업로드 후에도 흐릿한 가이드 — 얼굴 위치 / 크기 점검용 */}
            <UploadGuideOverlay wide={wide} opacity={0.25} />
          </>
        ) : (
          <>
            <UploadGuideOverlay wide={wide} opacity={0.6} />
            <span className="absolute text-2xl text-[#8B7355]">＋</span>
          </>
        )}
      </div>
      <span className="text-xs font-medium text-[#3D2E1F]">
        {face.uploading ? '업로드 중...' : face.preview ? `${label} ✓ 변경` : `${label} 업로드`}
      </span>
    </button>
  );
}

/**
 * 업로드 박스 안에 그리는 얼굴 / 어깨 가이드 오버레이.
 *
 * 사용자가 적정 거리·구도로 사진을 찍도록 유도 — 얼굴은 위쪽 가운데 원 안에,
 * 어깨는 아래 좌우 V 라인 안에 들어오게 안내. 업로드 전엔 진한 라인 (opacity
 * 0.6), 업로드 후엔 흐린 가이드 (0.25) 로 검토용 표시 유지.
 *
 * SVG 정규화 좌표계 (0~100 × 0~100) — wide 박스 / 정사각형 모두 동일 비율로 그려짐.
 */
function UploadGuideOverlay({
  wide = false,
  opacity = 0.6,
}: {
  wide?: boolean;
  opacity?: number;
}) {
  // 얼굴 원 위치: 상단 ~28% 중심, 반지름 ~22%. 어깨 V 라인: 얼굴 아래에서 시작해 박스 좌우 하단까지.
  // wide 박스(4:3) 일 때는 viewBox 비율을 맞춰 정사각형 가이드를 가운데 정렬.
  const viewBox = wide ? '0 0 133 100' : '0 0 100 100';
  const cx = wide ? 66.5 : 50;
  const faceCy = 32;
  const faceR = 20;
  // 어깨: 얼굴 하단에서 시작해 박스 좌우 70% 폭으로 벌어지며 박스 바닥까지.
  const shoulderTopY = faceCy + faceR + 4; // 얼굴 아래 살짝 띄움
  const shoulderHalfWidth = wide ? 50 : 38; // 박스에 따른 절반 폭
  const bottomY = 100;
  const shoulderPath = wide
    ? `M ${cx - shoulderHalfWidth} ${bottomY} Q ${cx - 22} ${shoulderTopY + 6} ${cx} ${shoulderTopY} Q ${cx + 22} ${shoulderTopY + 6} ${cx + shoulderHalfWidth} ${bottomY}`
    : `M ${cx - shoulderHalfWidth} ${bottomY} Q ${cx - 20} ${shoulderTopY + 6} ${cx} ${shoulderTopY} Q ${cx + 20} ${shoulderTopY + 6} ${cx + shoulderHalfWidth} ${bottomY}`;

  return (
    <svg
      aria-hidden
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ opacity }}
    >
      <g fill="none" stroke="#8B7355" strokeWidth="0.8" strokeDasharray="2 1.6" strokeLinecap="round">
        {/* 얼굴 가이드 원 */}
        <circle cx={cx} cy={faceCy} r={faceR} />
        {/* 어깨 가이드 곡선 */}
        <path d={shoulderPath} />
      </g>
    </svg>
  );
}
