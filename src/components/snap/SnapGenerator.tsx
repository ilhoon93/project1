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
import { catalogExampleImage } from '@/lib/snap/catalog';
import { detectFaces, type FaceMeta } from '@/lib/snap/face-detect';
import { CatalogCard } from '@/components/snap/CatalogCard';
import { StepIndicator, type SnapStep } from '@/components/snap/StepIndicator';
import {
  CatalogFilterBar,
  EMPTY_CATALOG_FILTER,
  applyCatalogFilter,
  type CatalogFilterState,
} from '@/components/snap/CatalogFilterBar';
import { scoreCompatibility } from '@/lib/snap/catalog-compatibility';
import { ConsentModal } from '@/components/snap/ConsentModal';
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
 * 라이브러리 앵커 (slot 단위) — 과거에 만든 앵커들의 신랑 또는 신부 slot 만.
 * 한 history row 가 양쪽 slot 모두 채워져 있으면 groomLibrary / brideLibrary 양쪽에
 * 같은 id 로 동시에 나타나며, 사용자는 신랑/신부를 다른 row 의 slot 으로 조합 가능.
 *
 * 백엔드 (/api/snap/anchor GET) 가 row 를 slot 별로 분리해서 반환.
 */
interface LibraryAnchorSlot {
  id: string;
  anchorUrl: string;
  selfieUrl: string | null;
  heightCm: number | null;
  weightKg: number | null;
  sourceMode: string;
  anchorCreatedAt: string | null;
  discardedAt: string;
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
  // 커플 사진 face 메타 — 업로드 직후 client-side MediaPipe 로 측정.
  // null = 미측정 / 측정 실패. 호환성 점수 계산에서 fallback 처리.
  const [coupleFaceMeta, setCoupleFaceMeta] = useState<FaceMeta | null>(null);
  const [coupleFaceMetaStatus, setCoupleFaceMetaStatus] = useState<
    'idle' | 'measuring' | 'ready' | 'error'
  >('idle');
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

  // 앵커 라이브러리 — slot 단위. groomLibrary / brideLibrary 각각 자기 slot 만의 카드.
  // 한 history row 가 양쪽 slot 다 있으면 양쪽에 같은 id 로 노출 가능.
  const [groomLibrary, setGroomLibrary] = useState<LibraryAnchorSlot[]>([]);
  const [brideLibrary, setBrideLibrary] = useState<LibraryAnchorSlot[]>([]);
  // 카탈로그 생성에 쓸 앵커 — slot 별 분리.
  //   'current' = snap_anchors 의 해당 slot
  //   UUID      = snap_anchor_history 의 그 row 의 해당 slot
  // 신랑은 row A, 신부는 row B 로 조합 가능.
  const [selectedGroomAnchorId, setSelectedGroomAnchorId] = useState<string>('current');
  const [selectedBrideAnchorId, setSelectedBrideAnchorId] = useState<string>('current');

  // 카탈로그 다중 선택 — 한 번에 N개 제출 가능. 비동기 finalize 라 페이지 이탈 OK.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // 카탈로그 검색 필터 — personality / backdrop(스튜디오·야외) / framing(클로즈업·반신·전신).
  // 비어 있으면 전체 노출. 랜딩 미리보기와 동일한 컴포넌트(CatalogFilterBar) 사용.
  const [catalogFilter, setCatalogFilter] =
    useState<CatalogFilterState>(EMPTY_CATALOG_FILTER);
  // 카탈로그 합성 방식 — 'strict' (마스터 컷 참조, 포즈 재현 강함)
  //                  / 'prompt-only' (마스터 안 쓰고 텍스트로만 scene 지시, 얼굴 보존 강함).
  // 이번 batch 의 모든 선택 카탈로그에 동일하게 적용.
  const [imageReference, setImageReference] = useState<'strict' | 'prompt-only'>('strict');
  // 자동 모드 추천 banner 닫힘 여부. 사용자가 "유지" 누르면 같은 batch 동안 다시 안 뜸.
  // 다음 batch (제출 후 다시 선택) 에는 false 로 리셋.
  const [modeRecommendDismissed, setModeRecommendDismissed] = useState<boolean>(false);
  // 동의 게이트 — null = 로딩 중, true = 미동의(모달 표시), false = 동의 완료.
  // 진입 시 /api/snap/consent GET 으로 상태 조회 후 결정.
  const [needsConsent, setNeedsConsent] = useState<boolean | null>(null);
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
  // 앵커 분기 모드 — hasFullAnchor 일 때만 의미:
  //   false (default) = "기존 앵커 사용" — 사진/키몸무게/앵커 만들기 섹션 collapse
  //   true            = "앵커 새로 만들기" — 모든 입력 섹션 노출
  // hasFullAnchor 가 false 면 무조건 true 처럼 동작 (재방문 첫 사용자가 아니라 신규).
  // 실제 섹션 노출은 showSelfieInputs / showAnchorBuilder 가 이 값 + mode 를 결합해 판단.
  const [anchorRecreateMode, setAnchorRecreateMode] = useState<boolean>(false);

  // 초기 로드.
  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const [a, e, c] = await Promise.all([
          fetch('/api/snap/anchor', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
          fetch('/api/me/entitlements', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
          fetch('/api/snap/consent', { cache: 'no-store' }).then((r) =>
            r.ok ? r.json() : null,
          ),
        ]);
        if (!canceled) {
          setNeedsConsent(c ? !c.hasConsent : true);
        }
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
        // 라이브러리 — slot 단위. 백엔드가 groomLibrary / brideLibrary 분리 응답.
        const parseSlotLibrary = (raw: unknown): LibraryAnchorSlot[] => {
          if (!Array.isArray(raw)) return [];
          return raw.map((e: Record<string, unknown>) => ({
            id: e.id as string,
            anchorUrl: e.anchorUrl as string,
            selfieUrl: (e.selfieUrl as string | null) ?? null,
            heightCm: (e.heightCm as number | null) ?? null,
            weightKg: (e.weightKg as number | null) ?? null,
            sourceMode: (e.sourceMode as string) ?? 'selfies',
            anchorCreatedAt: (e.anchorCreatedAt as string | null) ?? null,
            discardedAt: (e.discardedAt as string) ?? '',
          }));
        };
        const gLib = parseSlotLibrary(a?.groomLibrary);
        const bLib = parseSlotLibrary(a?.brideLibrary);
        setGroomLibrary(gLib);
        setBrideLibrary(bLib);
        // 각 slot 의 현재 앵커가 없는데 라이브러리가 있으면 그쪽 첫 항목 자동 선택.
        const hasCurrentGroom = !!a?.anchor?.groom_anchor_url;
        const hasCurrentBride = !!a?.anchor?.bride_anchor_url;
        if (!hasCurrentGroom && gLib.length > 0) setSelectedGroomAnchorId(gLib[0].id);
        if (!hasCurrentBride && bLib.length > 0) setSelectedBrideAnchorId(bLib[0].id);
        if (typeof e?.snapCredits === 'number') setSnapBalance(e.snapCredits);
      } catch {
        // 비로그인 등 — 그대로.
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

  // 커플 사진 업로드 → MediaPipe 로 face count + 얼굴 크기 비율 자동 측정.
  // preview (Object URL 또는 signed URL) 이 있을 때 한 번만 실행. 모드가 couple 아니면 skip.
  useEffect(() => {
    if (mode !== 'couple') {
      setCoupleFaceMeta(null);
      setCoupleFaceMetaStatus('idle');
      return;
    }
    if (!couple.preview) {
      setCoupleFaceMeta(null);
      setCoupleFaceMetaStatus('idle');
      return;
    }
    let canceled = false;
    setCoupleFaceMetaStatus('measuring');
    detectFaces(couple.preview)
      .then((meta) => {
        if (canceled) return;
        setCoupleFaceMeta(meta);
        setCoupleFaceMetaStatus('ready');
      })
      .catch(() => {
        if (canceled) return;
        // 모델 로드 실패 / 이미지 로드 실패 — 측정 없이 진행 (호환성은 default safe 로 fallback).
        setCoupleFaceMeta(null);
        setCoupleFaceMetaStatus('error');
      });
    return () => {
      canceled = true;
    };
  }, [mode, couple.preview]);

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

  // 라이브러리 항목의 한 slot 을 영구 삭제 (slot 단위).
  //   - 현재 active 앵커는 다음 batch 저장 시 POST /api/snap/anchor 가 자동으로
  //     history 에 archive → 따로 "현재 앵커 폐기" UX 필요 없음.
  //   - history row 의 반대쪽 slot 이 NULL 인 경우 백엔드가 row 자체를 삭제.
  //   - 삭제 후 그 항목이 선택돼 있었다면 selection 을 'current' 로 되돌려
  //     상단 status card 가 stale URL 을 가리키지 않게.
  const handleDiscardLibrarySlot = async (id: string, slot: 'groom' | 'bride') => {
    const label = slot === 'groom' ? '신랑' : '신부';
    if (!confirm(`이 라이브러리 ${label} 앵커를 영구 삭제할까요?`)) return;
    try {
      const res = await fetch(
        `/api/snap/anchor/history?id=${encodeURIComponent(id)}&slot=${slot}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error('delete failed');
      if (slot === 'groom') {
        setGroomLibrary((prev) => prev.filter((l) => l.id !== id));
        if (selectedGroomAnchorId === id) setSelectedGroomAnchorId('current');
      } else {
        setBrideLibrary((prev) => prev.filter((l) => l.id !== id));
        if (selectedBrideAnchorId === id) setSelectedBrideAnchorId('current');
      }
    } catch {
      setAnchorErr('라이브러리 삭제에 실패했습니다.');
    }
  };

  // ── 카탈로그 생성 ────────────────────────────────────────
  // 카탈로그 필터링 2단계:
  //   1. mode-based — couple 모드에서는 solo 카탈로그는 의미 없어 숨김.
  //   2. user-driven — picker 위에 chip 필터(personality/backdrop/framing) 적용.
  const modeFilteredCatalog = catalog.filter((c) => {
    if (mode === 'couple') return c.personality === 'together';
    return true;
  });
  const visibleCatalog = applyCatalogFilter(modeFilteredCatalog, catalogFilter);

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
          imageReference,
          ...(groomBodyValid ? { groomBody: groomBodyValid } : {}),
          ...(brideBodyValid ? { brideBody: brideBodyValid } : {}),
        };
      }
      // groomAnchorId / brideAnchorId — slot 별로 'current' 또는 라이브러리 UUID.
      //   personality 가 solo 면 반대쪽 slot 값은 백엔드에서 무시.
      // imageReference — strict (마스터 컷 참조) 또는 prompt-only (텍스트만).
      return {
        mode: 'anchor',
        catalogId: item.id,
        groomAnchorId: selectedGroomAnchorId,
        brideAnchorId: selectedBrideAnchorId,
        imageReference,
      };
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
    // 다음 batch 에서는 자동 모드 추천 banner 다시 노출.
    setModeRecommendDismissed(false);
    setStage('submitted');
  };

  // ── 헬퍼 / 표시용 ───────────────────────────────────────
  // 셀카 모드 = 항상 입력 + 앵커 빌더 노출. 앵커 이미 저장됐어도 부분 재생성
  // 가능해야 하므로 hide 하지 않음.
  // 셀카 모드 + 기존 앵커가 있고 "기존 사용" 선택 시 입력 영역 collapse.
  // 신규 사용자 / 커플 모드 / "새로 만들기" 선택 시는 노출.
  const showSelfieInputs = mode !== 'couple' && (!hasFullAnchor || anchorRecreateMode);
  const showCoupleInputs = mode === 'couple';
  const showAnchorBuilder = mode !== 'couple' && (!hasFullAnchor || anchorRecreateMode);
  // 셀카 모드 + 기존 앵커가 있을 때만 노출하는 분기 토글.
  const showAnchorBranchToggle = mode !== 'couple' && hasFullAnchor;

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

  // 선택한 카탈로그 중 호환성 caution/risky 라 prompt-only 가 권장되는 항목 개수.
  // 자동 모드 추천 banner 가 카탈로그 합성 방식이 'strict' 인 상태에서 이 개수 > 0
  // 이면 사용자에게 한 번 클릭으로 prompt-only 전환을 권유.
  const promptOnlyRecommendedCount = (() => {
    const compatMode = mode === 'couple' ? 'couple' : 'anchor';
    return selectedCatalogs.filter((item) => {
      const r = scoreCompatibility(item, {
        mode: compatMode,
        faceSizeRatio: coupleFaceMeta?.faceSizeRatio ?? null,
      });
      return r.recommendedMode === 'prompt-only';
    }).length;
  })();

  // 상단 StatusCard 가 표시할 앵커 URL — slot 별 selectedXxxAnchorId 기준.
  //   - 'current'  : active anchor (snap_anchors 의 해당 slot)
  //   - library id : 해당 slot 라이브러리 항목 URL. 없으면 active 로 fallback.
  // 사용자가 신랑/신부 picker 에서 골라도 상단 thumbnail 즉시 반영.
  const displayedAnchor = (() => {
    const resolveSlot = (
      sel: string,
      lib: LibraryAnchorSlot[],
      activeUrl: string | null,
    ): string | null => {
      if (sel === 'current') return activeUrl;
      const item = lib.find((l) => l.id === sel);
      return item ? item.anchorUrl : activeUrl;
    };
    return {
      groom: resolveSlot(selectedGroomAnchorId, groomLibrary, anchor?.groomAnchorUrl ?? null),
      bride: resolveSlot(selectedBrideAnchorId, brideLibrary, anchor?.brideAnchorUrl ?? null),
    };
  })();

  return (
    <div className="mt-6 flex flex-col gap-6">
      {/* 동의 모달 — 첫 사용 또는 약관 버전 업데이트 시 표시. */}
      {needsConsent === true && (
        <ConsentModal onAccept={() => setNeedsConsent(false)} />
      )}

      {/* 0. 현재 상태 카드 — 크레딧 + 선택된 앵커 썸네일.
            selectedAnchorId 가 'current' 면 active anchor URL, library id 면 해당
            라이브러리 항목 URL. 라이브러리에서 골랐을 때 즉시 상단에 반영. */}
      <StatusCard
        snapBalance={snapBalance}
        groomAnchorUrl={displayedAnchor.groom}
        brideAnchorUrl={displayedAnchor.bride}
        freeActivationAvailable={anchorFreeAvail}
      />

      {/* 상단 진행 단계 인디케이터 — 1 사진 → 2 앵커 → 3 카탈로그 → 4 생성.
          세로 섹션 레이아웃은 그대로 두고 사용자가 현재 어디까지 했는지 한눈에
          보여주는 보조 표시. couple 모드에서는 앵커 단계가 'skipped'. */}
      <StepIndicator steps={buildSteps({
        mode,
        inputsReady,
        hasFullAnchor,
        selectedCount: selectedIds.size,
        submitted: stage === 'submitted',
      })} />

      {/* 1. 사진 업로드 — 모드 카드 2개 → 셀카 sub-toggle */}
      <section className="rounded-md border border-[#E8DCC9] bg-white p-4">
        <h2 className="text-sm font-medium text-[#3D2E1F]">1. 사진 업로드</h2>
        <p className="mt-1 text-xs text-[#8B7355]">
          만들 방식을 골라주세요. 평균 생성 시간 60~120초.
        </p>

        {/* 모드 카드 2개 — 셀카로 만들기 / 커플 사진으로 만들기.
            각 카드에 설명을 풀어써서 사용자가 자기 케이스에 맞는 모드를 한 번에 선택. */}
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ModeCard
            title="셀카로 만들기"
            description={
              <>
                신랑·신부 각자 <strong>셀카·증명사진</strong>으로 앵커를 만들고, 그
                앵커를 카탈로그에 합성합니다. <strong>함께 / 신랑 단독 / 신부 단독
                컷 모두</strong> 가능. 키·몸무게로 전신 비율 보정 지원.
              </>
            }
            selected={mode === 'selfies1' || mode === 'selfies3'}
            disabled={isProgressing || isAnchorBusy}
            onClick={() => setMode('selfies1')}
            example={{
              inputSrc: '/wedding-snap/mode-examples/selfies-input.jpg',
              inputAlt: '신랑·신부 셀카 입력 예시',
              resultSrc: '/wedding-snap/mode-examples/selfies-result.jpg',
              resultAlt: '셀카 모드 카탈로그 합성 결과 예시',
              caption: '셀카 1장 → 50가지 컷',
            }}
          />
          <ModeCard
            title="커플 사진으로 만들기"
            description={
              <>
                두 사람이 함께 찍힌 <strong>커플 사진 1장</strong>으로 만듭니다.
                포즈·체형·상호작용을 그대로 유지하며 의상/배경만 바꿔요. <strong>함께
                컷만</strong> 가능 (단독 카탈로그는 숨겨짐).
              </>
            }
            selected={mode === 'couple'}
            disabled={isProgressing || isAnchorBusy}
            onClick={() => setMode('couple')}
            example={{
              inputSrc: '/wedding-snap/mode-examples/couple-input.jpg',
              inputAlt: '커플 사진 1장 입력 예시',
              resultSrc: '/wedding-snap/mode-examples/couple-result.jpg',
              resultAlt: '커플 모드 카탈로그 합성 결과 예시',
              caption: '커플 사진 → 의상·배경 교체',
            }}
          />
        </div>

        {/* 기존 앵커가 있으면 분기 토글 — "기존 앵커 사용" / "앵커 새로 만들기".
            재방문 사용자가 매번 사진/앵커 입력을 다시 보지 않아도 되게 collapse. */}
        {showAnchorBranchToggle && (
          <div className="mt-3 flex flex-col gap-2 rounded-md border border-[#3D2E1F]/15 bg-[#FAF7F2] p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] font-medium text-[#3D2E1F]">
                저장된 앵커가 있어요
              </span>
              <span className="text-[10px] text-[#8B7355]">
                새 셀카로 다시 만들어도 됩니다
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <SubToggleButton
                selected={!anchorRecreateMode}
                disabled={isProgressing || isAnchorBusy}
                onClick={() => setAnchorRecreateMode(false)}
                title="기존 앵커 사용"
                desc="저장된 신랑·신부 앵커 그대로 사용. 사진 업로드 생략."
              />
              <SubToggleButton
                selected={anchorRecreateMode}
                disabled={isProgressing || isAnchorBusy}
                onClick={() => setAnchorRecreateMode(true)}
                title="앵커 새로 만들기"
                desc="새 셀카로 다시 합성. 키·몸무게도 함께 갱신 가능."
              />
            </div>
          </div>
        )}

        {/* 셀카 모드 선택 시 — 1장 vs 3장 sub-toggle.
            "기존 사용" 선택 시는 사진 입력 자체가 collapse 라 1장/3장 구분 의미 없음 → 숨김. */}
        {mode !== 'couple' && showSelfieInputs && (
          <div className="mt-3 flex flex-col gap-2 rounded-md border border-dashed border-[#E8DCC9] bg-[#FAF7F2]/60 p-2.5">
            <span className="text-[11px] font-medium text-[#3D2E1F]">셀카 장수</span>
            <div className="grid grid-cols-2 gap-2">
              <SubToggleButton
                selected={mode === 'selfies1'}
                disabled={isProgressing || isAnchorBusy}
                onClick={() => setMode('selfies1')}
                title="1장씩"
                desc="빠르고 간편. 정면 1장씩만 업로드."
              />
              <SubToggleButton
                selected={mode === 'selfies3'}
                disabled={isProgressing || isAnchorBusy}
                onClick={() => setMode('selfies3')}
                title="3장씩 (권장)"
                desc="정면 + 좌 45° + 우 45°. 측면 컷에서도 정체성 안정."
              />
            </div>
          </div>
        )}

        {/* 셀카 거리 가이드 — 광각 왜곡(볼록렌즈 효과) 회피 안내.
            너무 가까이서 찍은 셀카는 코·얼굴 가운데가 부풀고 옆얼굴이 작아 보여,
            앵커 → 카탈로그 합성 결과의 비율이 어색해진다. */}
        {mode !== 'couple' && (
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
        )}

        {/* 커플 사진 1장 모드 전용 가이드 — 얼굴 변형 / 정체성 손상의 흔한 입력 패턴을
            사전 차단. 가장 큰 실패 케이스는 (1) 사진이 회전돼 들어옴, (2) 광각 풀샷이라
            얼굴이 너무 작음, (3) 두꺼운 외투·머플러로 어깨·턱선이 가려짐, (4) 두 사람이
            정면을 안 봄, (5) 강한 필터·야경/저조도. */}
        {mode === 'couple' && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-[11px] text-[#5C4633]">
            <p className="font-semibold text-amber-800">
              📸 무조건 잘 나오는 커플 사진 가이드
            </p>
            <p className="mt-1.5 text-[10px] font-semibold text-amber-900">필수</p>
            <ul className="mt-0.5 list-disc space-y-1 pl-4">
              <li>
                <strong>사진이 누워있지 않은지</strong> 미리보기에서 확인. 가로로 보이면
                회전해서 다시 업로드해주세요.
              </li>
              <li>
                두 사람 모두 <strong>카메라 정면</strong>을 바라보는 사진. 옆모습·딴 데
                보는 사진은 얼굴이 재구성됩니다.
              </li>
              <li>
                <strong>얼굴이 또렷</strong>해야 해요. 흐림·강한 필터·흑백·세피아·마스크·
                선글라스는 피해주세요.
              </li>
              <li>
                <strong>반신 ~ 무릎 위</strong> 컷이 가장 안정적이에요. 풍경 위주 풀샷은
                얼굴이 작아져서 변형 위험이 커집니다.
              </li>
            </ul>
            <p className="mt-2 text-[10px] font-semibold text-amber-900">권장</p>
            <ul className="mt-0.5 list-disc space-y-1 pl-4">
              <li>
                <strong>가벼운 옷차림</strong>. 두꺼운 패딩·롱코트·후드·머플러·하이넥은
                어깨·턱선을 가려서 합성이 어색해집니다.
              </li>
              <li>
                <strong>밝은 자연광</strong> 또는 균일한 실내 조명. 강한 역광·반쪽 그늘은
                피해주세요.
              </li>
              <li>
                두 사람 어깨가 <strong>가볍게 닿거나 팔짱</strong>. 멀리 떨어진 투샷보다
                결과가 안정적이에요.
              </li>
              <li>
                키 차이가 크면 한 사람이 살짝 굽혀서 <strong>얼굴 높이를 비슷하게</strong>
                맞춰주세요.
              </li>
            </ul>
          </div>
        )}

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
          <div className="mt-3 flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-3">
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
            {/* 커플 사진 face 측정 상태 — 카탈로그 호환성 판정에 사용. */}
            {couple.url && coupleFaceMetaStatus !== 'idle' && (
              <CoupleFaceMetaBadge
                status={coupleFaceMetaStatus}
                meta={coupleFaceMeta}
              />
            )}
          </div>
        )}
      </section>

      {/* 1-b. 키 / 몸무게 — 셀카 모드에서만 의미.
            커플 사진 모드는 사용자 사진에서 실제 체형 정보가 그대로 들어오므로
            별도 키/몸무게 입력이 합성에 영향을 주지 않음 → 셀카 모드에서만 노출. */}
      {showSelfieInputs && (
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

      {/* 3-a. 앵커 선택 — slot 별 별도 picker.
              사용자가 신랑은 row A 의 신랑 slot, 신부는 row B 의 신부 slot 처럼
              조합해서 가장 마음에 드는 페어를 만들 수 있게 한다.
              각 slot 카드의 ✕ 는 그 slot 만 라이브러리에서 영구 삭제. */}
      {mode !== 'couple' &&
        (!!anchor?.groomAnchorUrl ||
          !!anchor?.brideAnchorUrl ||
          groomLibrary.length > 0 ||
          brideLibrary.length > 0) && (
          <section className="rounded-md border border-[#E8DCC9] bg-white p-4">
            <h2 className="text-sm font-medium text-[#3D2E1F]">사용할 앵커 선택</h2>
            <p className="mt-1 text-xs text-[#8B7355]">
              신랑·신부를 각자 골라 조합할 수 있어요. ✕ 는 라이브러리에서 그 slot 만 영구 삭제.
            </p>

            <AnchorSlotPicker
              slot="groom"
              label="신랑 앵커"
              activeUrl={anchor?.groomAnchorUrl ?? null}
              library={groomLibrary}
              selectedId={selectedGroomAnchorId}
              onSelect={setSelectedGroomAnchorId}
              onDiscard={(id) => handleDiscardLibrarySlot(id, 'groom')}
            />
            <AnchorSlotPicker
              slot="bride"
              label="신부 앵커"
              activeUrl={anchor?.brideAnchorUrl ?? null}
              library={brideLibrary}
              selectedId={selectedBrideAnchorId}
              onSelect={setSelectedBrideAnchorId}
              onDiscard={(id) => handleDiscardLibrarySlot(id, 'bride')}
            />
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

        {/* 검색 필터 — chip 토글 3그룹. couple 모드에서 모드 필터로 이미 추려진
            modeFilteredCatalog 를 기준으로 총량 표시. */}
        <div className="mt-3">
          <CatalogFilterBar
            value={catalogFilter}
            onChange={setCatalogFilter}
            resultCount={{
              shown: visibleCatalog.length,
              total: modeFilteredCatalog.length,
            }}
          />
        </div>

        {visibleCatalog.length === 0 ? (
          <p className="mt-3 rounded-md border border-dashed border-[#E8DCC9] bg-white p-6 text-center text-xs text-[#8B7355]">
            선택한 필터 조합에 맞는 카탈로그가 없어요. 필터를 조정해 보세요.
          </p>
        ) : (
          <div className="mt-3 grid auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {visibleCatalog.map((item) => {
              const selected = selectedIds.has(item.id);
              const enabled = isCatalogGeneratable(item);
              // 카탈로그 호환성 — intensity + framing + (커플 모드) 입력 face size.
              const compat = scoreCompatibility(item, {
                mode: mode === 'couple' ? 'couple' : 'anchor',
                faceSizeRatio: coupleFaceMeta?.faceSizeRatio ?? null,
              });
              return (
                <CatalogCard
                  key={item.id}
                  variant="picker"
                  item={item}
                  selected={selected}
                  disabled={isProgressing || !enabled}
                  onClick={() => toggleCatalogSelection(item.id)}
                  title={
                    !enabled
                      ? '이 컷을 만들려면 필요한 앵커 / 입력이 부족해요'
                      : compat.reasons[0]
                  }
                  topRight={
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
                  }
                  overlay={
                    compat.level !== 'safe' ? (
                      <span
                        className={`pointer-events-none absolute bottom-[60px] left-2 z-20 rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-none shadow-md ${
                          compat.level === 'risky'
                            ? 'bg-red-600/95 text-white'
                            : 'bg-amber-500/95 text-white'
                        }`}
                      >
                        {compat.level === 'risky' ? '🔴 비추' : '🟡 주의'}
                      </span>
                    ) : null
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      {/* 4. 합성 방식 — 별도 step. 각 모드 카드에 "선택한 카탈로그의 모드별
            결과 예시 썸네일" 슬롯이 있어 사용자가 어떤 식으로 결과가 나오는지
            한눈에 비교 가능. 예시 이미지는 public/wedding-snap/catalog/examples/
            <id>-<mode>.jpg 규칙으로 admin 이 미리 올림. 없으면 마스터 이미지로
            자동 fallback. */}
      <section className="rounded-md border border-[#E8DCC9] bg-white p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium text-[#3D2E1F]">4. 합성 방식</h2>
          {selectedCatalogs.length > 0 && (
            <span className="text-[10px] text-[#8B7355]">
              이번 선택 {selectedCatalogs.length}개에 모두 적용
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-[#8B7355]">
          {selectedCatalogs.length === 0
            ? '카탈로그를 1개 이상 선택하면 모드별 예시 결과 썸네일이 보여요.'
            : mode === 'couple'
              ? '커플 사진은 두 방식 결과가 의상·배경 충실도 vs 얼굴 보존으로 갈려요. 예시 보고 골라주세요.'
              : '같은 카탈로그라도 모드에 따라 결과가 달라요. 예시 보고 골라주세요.'}
        </p>

        {/* 자동 모드 추천 banner — 호환성 점수 기반.
              선택한 카탈로그 중 prompt-only 가 권장되는 게 1개 이상 있고 현재 strict
              모드면 한 번 클릭으로 전환하라고 권유. 사용자가 강한 안내를 받아 실패 케이스
              사전 회피 가능. dismiss 후엔 다시 strict 로 돌아가도 안 보임 (state 로 관리). */}
        {imageReference === 'strict' &&
          promptOnlyRecommendedCount > 0 &&
          !modeRecommendDismissed && (
            <div className="mt-3 flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50/70 p-3 text-xs text-amber-900 sm:flex-row sm:items-center">
              <span className="flex-1">
                선택한 컷 중 <strong>{promptOnlyRecommendedCount}개</strong>는{' '}
                <strong>prompt-only 모드</strong>가 얼굴 보존이 더 잘 돼요.
                자동 전환할까요?
              </span>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setImageReference('prompt-only')}
                >
                  자동 전환
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setModeRecommendDismissed(true)}
                >
                  유지
                </Button>
              </div>
            </div>
          )}

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ImageReferenceCard
            value="strict"
            current={imageReference}
            disabled={isProgressing}
            onSelect={() => setImageReference('strict')}
            title={mode === 'couple' ? '카탈로그 충실 (strict)' : '구도 우선 (strict)'}
            description={
              mode === 'couple'
                ? '카탈로그 마스터의 의상/배경/조명을 그대로 재현. 얼굴이 미세하게 카탈로그 톤에 끌릴 수 있음.'
                : '카탈로그 마스터 컷의 포즈/구도/조명을 그대로 재현. 얼굴 보존은 face-swap 단계 의존.'
            }
            examples={selectedCatalogs}
            exampleMode="strict"
          />
          <ImageReferenceCard
            value="prompt-only"
            current={imageReference}
            disabled={isProgressing}
            onSelect={() => setImageReference('prompt-only')}
            title={mode === 'couple' ? '얼굴 보존 (prompt-only)' : '유사도 우선 (prompt-only)'}
            description={
              mode === 'couple'
                ? '마스터 이미지를 빼고 텍스트로만 분위기 지시. 얼굴 보존이 가장 강함. 의상·배경 디테일은 매번 달라짐.'
                : '마스터 컷을 안 쓰고 텍스트로만 scene 지시. 앵커 파이프라인 수준의 얼굴 일치, 포즈는 컨셉만 보장.'
            }
            examples={selectedCatalogs}
            exampleMode="prompt-only"
          />
        </div>
      </section>

      {/* 5. 생성 */}
      <section className="rounded-md border border-[#E8DCC9] bg-white p-4">
        <h2 className="text-sm font-medium text-[#3D2E1F]">5. 생성</h2>
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
            평균 60~120초 후에 완성됩니다. 화면을 떠나도 생성은 계속 진행되며, 결과는
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
}: {
  snapBalance: number | null;
  groomAnchorUrl: string | null;
  brideAnchorUrl: string | null;
  freeActivationAvailable: boolean;
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
                className="ml-auto text-[11px] text-[#8B7355] underline underline-offset-2 hover:text-[#3D2E1F]"
              >
                {expanded ? '접기' : '크게 보기'}
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

/**
 * slot 단위 앵커 picker. 한 줄에 "현재 (active)" 카드 + 라이브러리 카드들.
 * 각 카드 우상단 ✕ → onDiscard(id) 호출 (active 카드는 ✕ 없음, 다음 batch 저장
 * 시 자동 archive 흐름이라 별도 폐기 UX 불필요).
 */
function AnchorSlotPicker({
  slot,
  label,
  activeUrl,
  library,
  selectedId,
  onSelect,
  onDiscard,
}: {
  slot: 'groom' | 'bride';
  label: string;
  activeUrl: string | null;
  library: LibraryAnchorSlot[];
  selectedId: string;
  onSelect: (id: string) => void;
  onDiscard: (id: string) => void;
}) {
  const hasAny = !!activeUrl || library.length > 0;
  if (!hasAny) {
    return (
      <div className="mt-3">
        <h3 className="text-[12px] font-medium text-[#3D2E1F]">{label}</h3>
        <p className="mt-1 text-[11px] text-[#8B7355]">
          아직 저장된 {slot === 'groom' ? '신랑' : '신부'} 앵커가 없어요.
        </p>
      </div>
    );
  }
  return (
    <div className="mt-3">
      <h3 className="text-[12px] font-medium text-[#3D2E1F]">{label}</h3>
      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {activeUrl && (
          <button
            type="button"
            onClick={() => onSelect('current')}
            aria-pressed={selectedId === 'current'}
            className={`relative flex flex-col gap-1 rounded-md border p-2 text-left transition-colors ${
              selectedId === 'current'
                ? 'border-[#3D2E1F] ring-2 ring-[#3D2E1F]/30'
                : 'border-[#E8DCC9] hover:border-[#8B7355]'
            }`}
          >
            <AnchorTinyThumb url={activeUrl} />
            <span className="text-[11px] font-medium text-[#3D2E1F]">현재</span>
            <span className="text-[10px] text-[#8B7355]">최근 저장</span>
          </button>
        )}
        {library.map((lib) => (
          <div
            key={lib.id}
            className={`relative rounded-md border transition-colors ${
              selectedId === lib.id
                ? 'border-[#3D2E1F] ring-2 ring-[#3D2E1F]/30'
                : 'border-[#E8DCC9] hover:border-[#8B7355]'
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(lib.id)}
              aria-pressed={selectedId === lib.id}
              className="flex w-full flex-col gap-1 p-2 text-left"
            >
              <AnchorTinyThumb url={lib.anchorUrl} />
              <span className="text-[11px] font-medium text-[#3D2E1F]">라이브러리</span>
              <span className="text-[10px] text-[#8B7355]">
                {formatLibraryDate(lib.anchorCreatedAt ?? lib.discardedAt)}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onDiscard(lib.id)}
              title="이 slot 만 라이브러리에서 영구 삭제"
              aria-label="이 slot 만 라이브러리에서 영구 삭제"
              className="absolute right-1 top-1 z-10 grid h-5 w-5 place-items-center rounded-full bg-white/95 text-[10px] leading-none text-[#8B7355] shadow-sm ring-1 ring-[#E8DCC9] hover:text-red-600 hover:ring-red-300"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
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

/**
 * 입력 모드 카드 — 셀카 / 커플 두 케이스를 큰 카드로 선택.
 *
 * `example` prop 으로 "이렇게 입력하면 이런 결과가 나와요" 미리보기 1세트를
 * 카드 하단에 표시 — 사용자가 처음 모드를 고를 때 직관적으로 이해할 수 있게.
 * 입력 사진 + → + 결과 사진 두 썸네일. 파일이 아직 없으면(onError) placeholder
 * 박스로 대체되어 깨짐 없이 노출. admin 이 mode-examples/ 에 jpg 만 올리면 즉시 노출.
 */
interface ModeExample {
  inputSrc: string;
  inputAlt: string;
  resultSrc: string;
  resultAlt: string;
  /** "정면 클로즈업 1장" 같은 1줄 부연 (옵션) */
  caption?: string;
}

function ModeCard({
  title,
  description,
  selected,
  disabled,
  onClick,
  example,
}: {
  title: string;
  description: React.ReactNode;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  example?: ModeExample;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={`flex flex-col gap-1.5 rounded-md border p-3 text-left transition-colors ${
        selected
          ? 'border-[#3D2E1F] bg-white ring-2 ring-[#3D2E1F]/20'
          : 'border-[#E8DCC9] bg-white hover:border-[#8B7355]'
      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <span className="flex items-center gap-1.5">
        <span
          className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border-2 ${
            selected ? 'border-[#3D2E1F] bg-[#3D2E1F]' : 'border-[#D4C5B0] bg-white'
          }`}
          aria-hidden
        >
          {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
        </span>
        <span className="text-sm font-semibold text-[#3D2E1F]">{title}</span>
      </span>
      <span className="text-[11px] leading-relaxed text-[#5C4633]">{description}</span>
      {example && <ModeExamplePair example={example} />}
    </button>
  );
}

/**
 * 입력 → 결과 예시 1세트 — 카드 하단에 작게 표시. 두 썸네일 사이 화살표.
 * 둘 다 3:4 비율 작은 카드. 파일이 아직 없으면 onError → placeholder 텍스트로 fallback.
 */
function ModeExamplePair({ example }: { example: ModeExample }) {
  return (
    <div className="mt-1.5 flex flex-col gap-1">
      <span className="text-[10px] font-medium text-[#8B7355]">예시</span>
      <div className="flex items-center gap-1.5">
        <ModeExampleThumb src={example.inputSrc} alt={example.inputAlt} label="입력 사진" />
        <span
          aria-hidden
          className="text-base font-light leading-none text-[#8B7355]"
        >
          →
        </span>
        <ModeExampleThumb src={example.resultSrc} alt={example.resultAlt} label="결과" />
        {example.caption && (
          <span className="ml-auto text-[10px] leading-snug text-[#8B7355]">
            {example.caption}
          </span>
        )}
      </div>
    </div>
  );
}

/** 모드 예시 입력/결과 작은 썸네일 (3:4, 약 56–72px 폭). onError 시 placeholder. */
function ModeExampleThumb({
  src,
  alt,
  label,
}: {
  src: string;
  alt: string;
  label: string;
}) {
  return (
    <div
      title={alt}
      className="relative h-16 w-12 overflow-hidden rounded border border-[#E8DCC9] bg-[#F5EDE0]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="block h-full w-full object-cover"
        onError={(e) => {
          const target = e.currentTarget;
          target.style.display = 'none';
          const fb = target.nextElementSibling as HTMLElement | null;
          if (fb) fb.style.display = 'flex';
        }}
      />
      <div
        className="absolute inset-0 hidden flex-col items-center justify-center px-1 text-center text-[9px] leading-tight text-[#8B7355]"
        style={{ display: 'none' }}
      >
        <span>{label}</span>
        <span className="opacity-60">준비 중</span>
      </div>
    </div>
  );
}

/** 셀카 sub-toggle — "1장씩" / "3장씩" 두 옵션을 같은 모양의 작은 카드로. */
function SubToggleButton({
  selected,
  disabled,
  onClick,
  title,
  desc,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={`flex flex-col gap-0.5 rounded-md border px-2.5 py-2 text-left transition-colors ${
        selected
          ? 'border-[#3D2E1F] bg-white ring-2 ring-[#3D2E1F]/20'
          : 'border-[#D4C5B0] bg-white hover:border-[#8B7355]'
      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <span className="text-[11px] font-semibold text-[#3D2E1F]">{title}</span>
      <span className="text-[10px] leading-snug text-[#8B7355]">{desc}</span>
    </button>
  );
}

/**
 * 커플 사진 face 측정 결과 작은 인디케이터 — 카탈로그 호환성에 어떻게 반영
 * 되는지 사용자에게 투명하게 노출. 측정 실패 시 "측정 못 함, 일반 규칙 적용" 안내.
 */
function CoupleFaceMetaBadge({
  status,
  meta,
}: {
  status: 'measuring' | 'ready' | 'error';
  meta: FaceMeta | null;
}) {
  if (status === 'measuring') {
    return (
      <p className="text-[10px] text-[#8B7355]">
        ⏳ 사진 분석 중… (얼굴 크기 측정 후 호환 카탈로그 자동 추천)
      </p>
    );
  }
  if (status === 'error') {
    return (
      <p className="text-[10px] text-amber-700">
        ⚠ 얼굴 자동 측정 실패 — 일반 호환성 규칙으로 진행됩니다.
      </p>
    );
  }
  if (status === 'ready' && meta) {
    const r = meta.faceSizeRatio;
    const sizeLabel =
      meta.faceCount === 0
        ? '얼굴을 못 찾았어요 — 정면 얼굴이 잘 보이는 사진을 권장합니다'
        : r >= 0.25
          ? '얼굴 크게 보이는 사진 — 대부분 카탈로그에 잘 맞아요'
          : r >= 0.15
            ? '보통 반신 사진 — 클로즈업 카탈로그는 살짝 주의'
            : '얼굴 작은 전신 사진 — 클로즈업 카탈로그는 변형 위험이 있어요';
    return (
      <p className="text-[10px] text-[#5C4633]">
        ✓ 얼굴 {meta.faceCount}개 감지 · {sizeLabel}
      </p>
    );
  }
  return null;
}

/**
 * 합성 방식 (strict / prompt-only) 카드 — 카드 안에 선택한 카탈로그의 모드별
 * 결과 예시 썸네일을 작게 N장 노출.
 *
 * - examples 가 비어 있으면 (선택 카탈로그 0) 안내 placeholder.
 * - 각 썸네일은 `public/wedding-snap/catalog/examples/<id>-<mode>.jpg` 를
 *   <img> 로 시도하고, 없으면 onError 로 카탈로그 마스터로 자동 fallback.
 * - 최대 4장까지만 노출 (5개 이상 선택 시 +N 칩으로 표시).
 */
function ImageReferenceCard({
  value,
  current,
  disabled,
  onSelect,
  title,
  description,
  examples,
  exampleMode,
}: {
  value: 'strict' | 'prompt-only';
  current: 'strict' | 'prompt-only';
  disabled: boolean;
  onSelect: () => void;
  title: string;
  description: string;
  examples: SnapCatalogItem[];
  exampleMode: 'strict' | 'prompt-only';
}) {
  const selected = current === value;
  const visibleExamples = examples.slice(0, 4);
  const extra = Math.max(0, examples.length - visibleExamples.length);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={`flex flex-col gap-2 rounded-md border p-3 text-left transition-colors ${
        selected
          ? 'border-[#3D2E1F] bg-white ring-2 ring-[#3D2E1F]/20'
          : 'border-[#E8DCC9] bg-white hover:border-[#8B7355]'
      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <span className="flex items-center gap-1.5">
        <span
          className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border-2 ${
            selected ? 'border-[#3D2E1F] bg-[#3D2E1F]' : 'border-[#D4C5B0] bg-white'
          }`}
          aria-hidden
        >
          {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
        </span>
        <span className="text-sm font-semibold text-[#3D2E1F]">{title}</span>
      </span>
      <span className="text-[11px] leading-relaxed text-[#5C4633]">{description}</span>
      {visibleExamples.length > 0 && (
        <div className="mt-1 flex flex-col gap-1">
          <span className="text-[10px] font-medium text-[#8B7355]">예시 결과</span>
          <div className="grid grid-cols-4 gap-1">
            {visibleExamples.map((item) => (
              <ExampleThumb
                key={item.id}
                item={item}
                exampleMode={exampleMode}
              />
            ))}
            {extra > 0 && (
              <span className="grid aspect-[3/4] place-items-center rounded border border-dashed border-[#D4C5B0] bg-[#FAF7F2] text-[10px] font-medium text-[#8B7355]">
                +{extra}
              </span>
            )}
          </div>
        </div>
      )}
    </button>
  );
}

/**
 * 모드별 예시 결과 thumbnail. 카탈로그 마스터 자체로 fallback (onError).
 * 추후 admin 이 examples/<id>-<mode>.jpg 를 올리면 즉시 노출됨.
 */
function ExampleThumb({
  item,
  exampleMode,
}: {
  item: SnapCatalogItem;
  exampleMode: 'strict' | 'prompt-only';
}) {
  const exampleSrc = catalogExampleImage(item, exampleMode);
  return (
    <div
      title={`${item.label} · ${exampleMode === 'strict' ? 'strict' : 'prompt-only'} 예시`}
      className="relative overflow-hidden rounded border border-[#E8DCC9] bg-[#F5EDE0]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={exampleSrc}
        alt={`${item.label} ${exampleMode} 예시 결과`}
        className="block aspect-[3/4] w-full object-cover"
        onError={(e) => {
          // examples/ 파일 없으면 카탈로그 마스터로 fallback (admin 이 아직 안 올렸을 때).
          const target = e.currentTarget;
          if (target.src.endsWith(exampleSrc)) target.src = item.image;
        }}
      />
    </div>
  );
}

/** 상단 StepIndicator 가 보여줄 5-step 상태를 현재 state 로부터 계산.
 *   1 사진 → 2 앵커 → 3 카탈로그 → 4 합성 방식 → 5 생성.
 *   합성 방식(strict / prompt-only) 은 항상 default 가 있어 "done" 으로 간주하되,
 *   사용자가 카탈로그를 골랐을 때 active 로 표시. couple 모드에선 앵커 단계 'skipped'. */
function buildSteps({
  mode,
  inputsReady,
  hasFullAnchor,
  selectedCount,
  submitted,
}: {
  mode: InputMode;
  inputsReady: boolean;
  hasFullAnchor: boolean;
  selectedCount: number;
  submitted: boolean;
}): SnapStep[] {
  const isCouple = mode === 'couple';
  // 단계 별 done 판정.
  const photoDone = inputsReady;
  const anchorDone = isCouple ? true : hasFullAnchor;
  const catalogDone = selectedCount > 0;
  const modeDone = catalogDone; // 합성 방식은 default 있으니 카탈로그 선택까지 마치면 자동 done.
  // active 는 첫 번째 미완료 단계 (submitted 면 모두 done).
  const decideActive = (i: number): boolean => {
    if (submitted) return false;
    const doneFlags = [photoDone, anchorDone, catalogDone, modeDone, false];
    for (let j = 0; j < doneFlags.length; j += 1) {
      if (!doneFlags[j]) return i === j;
    }
    return false;
  };
  const statusOf = (i: number, done: boolean, skipped = false): SnapStep['status'] => {
    if (skipped) return 'skipped';
    if (done) return 'done';
    if (decideActive(i)) return 'active';
    return 'pending';
  };
  return [
    { n: 1, label: '사진 업로드', status: statusOf(0, photoDone) },
    {
      n: 2,
      label: '앵커 만들기',
      status: isCouple ? 'skipped' : statusOf(1, anchorDone),
    },
    { n: 3, label: '카탈로그 선택', status: statusOf(2, catalogDone) },
    { n: 4, label: '합성 방식', status: statusOf(3, modeDone) },
    {
      n: 5,
      label: '생성',
      status: submitted ? 'done' : statusOf(4, false),
    },
  ];
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
            {/* 업로드 후에도 흐릿한 가이드 — 얼굴 위치 / 크기 점검용.
                커플 사진 모드(wide) 는 한 명이 아니라 두 명이 함께 찍힌 사진이라
                중앙 얼굴 1개 가이드가 오히려 혼란을 줘서 표시하지 않는다. */}
            {!wide && <UploadGuideOverlay wide={wide} opacity={0.25} />}
          </>
        ) : (
          <>
            {!wide && <UploadGuideOverlay wide={wide} opacity={0.6} />}
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
 * 업로드 박스 안에 그리는 얼굴 / 목 / 어깨 가이드 오버레이.
 *
 * 사용자가 적정 거리·구도로 사진을 찍도록 유도:
 *   - 얼굴: 세로 타원 (실제 한국인 얼굴 비율에 가까운 5:6) 으로 위쪽 가운데.
 *   - 목  : 얼굴 하단에서 어깨로 내려가는 짧은 두 선 (안쪽으로 살짝 좁아짐).
 *   - 어깨: 자연스러운 곡선 — 가운데가 위로 올라오는 사다리꼴 라인 (트래피지움).
 *
 * 업로드 전엔 진한 라인 (opacity 0.6), 업로드 후엔 흐린 가이드 (0.25) 로
 * 검토용 표시 유지.
 *
 * SVG 정규화 좌표계 — wide(4:3)/정사각형 모두 동일 비율로 그려짐.
 */
function UploadGuideOverlay({
  wide = false,
  opacity = 0.6,
}: {
  wide?: boolean;
  opacity?: number;
}) {
  // 좌표 기준 — wide 박스(4:3) 일 때는 viewBox 비율을 맞춰 정사각형 가이드를 가운데 정렬.
  const viewBox = wide ? '0 0 133 100' : '0 0 100 100';
  const cx = wide ? 66.5 : 50;

  // 얼굴 타원 — 세로 5:6 비율. 머리카락은 포함하지 않고 이마~턱 라인.
  const faceCy = 30;
  const faceRx = 17; // 가로 반지름
  const faceRy = 21; // 세로 반지름 (5:6 비율)

  // 목 — 얼굴 하단에서 어깨까지. 안쪽으로 살짝 좁아지는 사다리꼴.
  const neckTopY = faceCy + faceRy - 1; // 얼굴 하단보다 살짝 위 (턱 끝선과 자연스럽게 이어지도록)
  const neckTopHalfWidth = faceRx * 0.4; // 얼굴 폭의 40% — 턱 아래 목 시작
  const neckBottomY = neckTopY + 8; // 목 길이
  const neckBottomHalfWidth = faceRx * 0.5; // 어깨 가까이서 살짝 벌어짐 (목 → 승모근)

  // 어깨 — 목 아래에서 박스 좌우 끝까지. 가운데가 살짝 위로 올라오는 자연스러운 곡선.
  // M(좌측 끝 바닥) → C(좌측 어깨 끝 위) → C(목 아래 가운데) → 같은 식으로 우측.
  const shoulderEdgeY = neckBottomY + 6; // 어깨 가장 위쪽 (목 아래)
  const shoulderHalfWidth = wide ? 56 : 42; // 박스 끝 근처
  const bottomY = 100;

  // 어깨 라인 (좌측 끝 바닥 → 좌측 어깨 위 → 목 좌측 → 목 우측 → 우측 어깨 위 → 우측 끝 바닥).
  // C(control1, control2, end) 형태의 cubic Bezier.
  const shoulderPath = [
    `M ${cx - shoulderHalfWidth} ${bottomY}`,
    `L ${cx - shoulderHalfWidth} ${shoulderEdgeY + 6}`,
    `C ${cx - shoulderHalfWidth + 8} ${shoulderEdgeY}, ${cx - neckBottomHalfWidth - 6} ${shoulderEdgeY - 2}, ${cx - neckBottomHalfWidth} ${neckBottomY}`,
    `L ${cx - neckTopHalfWidth} ${neckTopY}`,
    `M ${cx + neckTopHalfWidth} ${neckTopY}`,
    `L ${cx + neckBottomHalfWidth} ${neckBottomY}`,
    `C ${cx + neckBottomHalfWidth + 6} ${shoulderEdgeY - 2}, ${cx + shoulderHalfWidth - 8} ${shoulderEdgeY}, ${cx + shoulderHalfWidth} ${shoulderEdgeY + 6}`,
    `L ${cx + shoulderHalfWidth} ${bottomY}`,
  ].join(' ');

  return (
    <svg
      aria-hidden
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ opacity }}
    >
      <g
        fill="none"
        stroke="#8B7355"
        strokeWidth="0.9"
        strokeDasharray="2 1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* 얼굴 가이드 타원 (세로 5:6) */}
        <ellipse cx={cx} cy={faceCy} rx={faceRx} ry={faceRy} />
        {/* 목 + 어깨 라인 */}
        <path d={shoulderPath} />
      </g>
    </svg>
  );
}
