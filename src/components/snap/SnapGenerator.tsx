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
import { detectFaces, type FaceMeta } from '@/lib/snap/face-detect';
import {
  ExampleFlowModal,
  type ExampleFlowMode,
} from '@/components/snap/ExampleFlowModal';
import { CatalogCard } from '@/components/snap/CatalogCard';
import { StepIndicator, type SnapStep } from '@/components/snap/StepIndicator';
import {
  CatalogFilterBar,
  EMPTY_CATALOG_FILTER,
  applyCatalogFilter,
  type CatalogFilterState,
  type CatalogSortMode,
} from '@/components/snap/CatalogFilterBar';
import type { CatalogStatsMap } from '@/lib/snap/catalog-stats';
import { computePageItems, CATALOG_PAGE_SIZE } from '@/lib/utils/pagination';
import {
  evaluateCompatibility,
  isCatalogHidden,
  resolveAdminCondition,
} from '@/lib/snap/catalog-compatibility';
import type { CatalogAdminTagMap } from '@/lib/snap/catalog-admin-tags';
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
  /**
   * 운영자가 admin 페이지에서 세팅한 카탈로그별 태그 map.
   * 사용자 페이지의 호환성 판정 / 추천 정렬 / hidden 필터에 모두 사용.
   * 미설정 카탈로그 = default safe.
   */
  adminTags: CatalogAdminTagMap;
  /**
   * snap_catalog_stats view 에서 합산한 카탈로그별 stats (catalog_id 단위).
   * 정렬 모드 'popular' / 'most-liked' 의 정렬 키. 없으면 정렬 chip UI 숨김.
   */
  catalogStats?: CatalogStatsMap;
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

export function SnapGenerator({ catalog, adminTags, catalogStats }: Props) {
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
  // 카탈로그 그리드 페이징 — 24개씩 표시. 필터/정렬/모드 변경 시 첫 페이지로 복귀.
  const [catalogPage, setCatalogPage] = useState<number>(0);
  // "추천만 보기" 토글 — 운영자 recommend 태그 카탈로그만 노출 (caution/risky 숨김).
  const [onlyRecommended, setOnlyRecommended] = useState<boolean>(false);
  // 카탈로그 정렬 모드 — default(추천순) / popular(인기순) / most-liked(좋아요순).
  // stats prop 이 없으면 UI 자체 숨김.
  const [sortMode, setSortMode] = useState<CatalogSortMode>('default');
  // 카탈로그 합성 방식 — 'strict' (마스터 컷 참조, 포즈 재현 강함)
  //                  / 'prompt-only' (마스터 안 쓰고 텍스트로만 scene 지시, 얼굴 보존 강함).
  // 이번 batch 의 모든 선택 카탈로그에 동일하게 적용.
  const [imageReference, setImageReference] = useState<'strict' | 'prompt-only'>('strict');
  // 자동 모드 추천 banner 닫힘 여부. 사용자가 "유지" 누르면 같은 batch 동안 다시 안 뜸.
  // 다음 batch (제출 후 다시 선택) 에는 false 로 리셋.
  const [modeRecommendDismissed, setModeRecommendDismissed] = useState<boolean>(false);
  // "예시 보기" 모달 — null = 닫힘, 'selfies' | 'couple' = 해당 모드 흐름 표시.
  const [exampleModalMode, setExampleModalMode] = useState<ExampleFlowMode | null>(null);
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
  // 현재 mode + 입력 face size 로 admin condition 결정 (한 번만 derive 해서 재사용).
  const adminCondition = resolveAdminCondition(
    mode === 'couple' ? 'couple' : 'anchor',
    coupleFaceMeta?.faceSizeRatio ?? null,
  );

  // 카탈로그 필터링 3단계:
  //   1. mode-based — couple 모드에서는 solo 카탈로그는 의미 없어 숨김.
  //   2. admin hidden — 현재 condition 에서 운영자가 hidden 태그 단 카탈로그 제외.
  //   3. user-driven — picker 위 chip 필터(personality/backdrop/framing) 적용.
  // 그리고 recommend 태그 카탈로그가 그리드 앞쪽에 오도록 정렬.
  const modeFilteredCatalog = catalog.filter((c) => {
    if (mode === 'couple' && c.personality !== 'together') return false;
    if (adminCondition) {
      const tag = adminTags[c.id]?.[adminCondition];
      if (isCatalogHidden(tag)) return false;
    }
    return true;
  });
  // 정렬:
  //   default    → 추천 > 기본(미설정) > 주의 > 비추 순. 같은 등급 내 원래 순서 (stable).
  //   popular    → gen_count 내림차순. tie-break 는 추천 등급.
  //   most-liked → like_count 내림차순. tie-break 는 추천 등급.
  // hidden 은 위 필터에서 이미 제외.
  const tagRank = (id: string): number => {
    if (!adminCondition) return 1;
    const tag = adminTags[id]?.[adminCondition];
    if (tag === 'recommend') return 0;
    if (tag === 'caution') return 2;
    if (tag === 'risky') return 3;
    return 1; // null / 미설정 = 기본 (safe)
  };
  const statsKey: 'genCount' | 'likeCount' | null =
    sortMode === 'popular'
      ? 'genCount'
      : sortMode === 'most-liked'
        ? 'likeCount'
        : null;
  const sortedModeFiltered = modeFilteredCatalog.slice().sort((a, b) => {
    if (statsKey && catalogStats) {
      const va = catalogStats[a.id]?.[statsKey] ?? 0;
      const vb = catalogStats[b.id]?.[statsKey] ?? 0;
      if (va !== vb) return vb - va; // 내림차순
    }
    return tagRank(a.id) - tagRank(b.id);
  });
  // "추천만 보기" 토글 — caution/risky 제외 (recommend + safe 만 노출).
  const onlyRecommendedFiltered = onlyRecommended
    ? sortedModeFiltered.filter((c) => {
        if (!adminCondition) return true;
        const tag = adminTags[c.id]?.[adminCondition];
        return tag !== 'caution' && tag !== 'risky';
      })
    : sortedModeFiltered;
  const visibleCatalog = applyCatalogFilter(onlyRecommendedFiltered, catalogFilter);

  // 페이징 — 필터/정렬/모드 변경 시 0 페이지로 복귀.
  useEffect(() => {
    setCatalogPage(0);
  }, [mode, catalogFilter, onlyRecommended, sortMode]);
  const totalCatalogPages = Math.max(
    1,
    Math.ceil(visibleCatalog.length / CATALOG_PAGE_SIZE),
  );
  const clampedCatalogPage = Math.min(catalogPage, totalCatalogPages - 1);
  const visibleCatalogPage = visibleCatalog.slice(
    clampedCatalogPage * CATALOG_PAGE_SIZE,
    clampedCatalogPage * CATALOG_PAGE_SIZE + CATALOG_PAGE_SIZE,
  );
  const catalogPageItems = computePageItems(clampedCatalogPage, totalCatalogPages);

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

  // 선택한 카탈로그 중 운영자가 caution/risky 태그 단 것 개수.
  // 합성 방식이 'strict' 인 상태에서 이 개수 > 0 이면 자동 모드 추천 banner 노출.
  const promptOnlyRecommendedCount = selectedCatalogs.filter((item) => {
    if (!adminCondition) return false;
    const tag = adminTags[item.id]?.[adminCondition];
    return evaluateCompatibility(tag).recommendedMode === 'prompt-only';
  }).length;

  // (이전엔 StatusCard 가 사용하던 displayedAnchor — slot 별 selectedXxxAnchorId 를
  //  resolve 해 상단 썸네일에 노출 — 박스 자체가 제거되면서 함께 삭제됨.
  //  각 slot 의 선택 상태는 AnchorSlotPicker 가 직접 ring 으로 표시.)

  return (
    <div className="mt-6 flex flex-col gap-6">
      {/* 동의 모달 — 첫 사용 또는 약관 버전 업데이트 시 표시. */}
      {needsConsent === true && (
        <ConsentModal onAccept={() => setNeedsConsent(false)} />
      )}

      {/* 모드별 합성 흐름 예시 모달 — "예시 보기" 버튼 클릭 시 노출. */}
      <ExampleFlowModal
        mode={exampleModalMode}
        onClose={() => setExampleModalMode(null)}
      />


      {/*
        과거 여기 있던 StatusCard (크레딧 + 앵커 썸네일 박스) 는 삭제됨 —
        스냅 크레딧 / 재생성 잔량은 페이지 헤더 (create/page.tsx) 의 잔액 배지가,
        앵커 미리보기는 아래 "사용할 앵커 선택" picker 의 lightbox 가 각각 담당.
        중복 노출 + 세로 공간 절약을 위해 일원화.
      */}

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
            onShowExample={() => setExampleModalMode('selfies')}
          />
          <ModeCard
            title="커플 사진으로 만들기"
            description={
              <>
                두 사람이 함께 찍힌 <strong>커플 사진 1장</strong>으로 만듭니다.
                <strong>포즈·체형·상호작용을 그대로 유지</strong>하며 의상/배경만 바꿔요. <strong>함께
                컷만</strong> 가능 (단독 카탈로그는 숨겨짐).
              </>
            }
            selected={mode === 'couple'}
            disabled={isProgressing || isAnchorBusy}
            onClick={() => setMode('couple')}
            onShowExample={() => setExampleModalMode('couple')}
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
            <ul className="mt-0.5 list-disc space-y-1 pl-4">
              <li>
                <strong>사진이 누워있지 않은지</strong> 미리보기에서 확인. 가로로 보이면
                회전해서 다시 업로드해주세요.
              </li>
              <li>
                <strong>얼굴이 또렷</strong>해야 해요. 흐림·강한 필터·흑백·세피아·마스크·
                머플러·모자·선글라스는 피해주세요.
              </li>
              <li>
                <strong>셀카 ~ 무릎 위</strong> 컷이 가장 안정적이에요. 풍경 위주 풀샷은
                얼굴이 작아져서 카탈로그 선택시 주의가 필요해요.
              </li>
              <li>
                <strong>밝은 자연광</strong> 또는 균일한 실내 조명. 강한 역광·반쪽 그늘은
                피해주세요.
              </li>
              <li>
                두 사람 어깨가 <strong>가볍게 닿거나 팔짱</strong>. 멀리 떨어진 투샷보다
                결과가 안정적이에요.
              </li>
            </ul>
          </div>
        )}

        {showSelfieInputs && (
          // 1장 모드: 신랑 + 신부 각 1박스를 가로 grid-cols-2 로 나란히.
          // 3장 모드: 각 person 별 3박스 row 가 커서 세로 stack 유지.
          <div
            className={`mt-3 ${
              numAngles === 1
                ? 'grid grid-cols-2 gap-3'
                : 'flex flex-col gap-4'
            }`}
          >
            <AngleRow
              personLabel={numAngles === 1 ? '신랑' : '신랑 얼굴'}
              numAngles={numAngles}
              faces={groomFaces}
              refs={groomRefs}
              disabled={isProgressing || isAnchorBusy}
            />
            <AngleRow
              personLabel={numAngles === 1 ? '신부' : '신부 얼굴'}
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
              각 slot 카드의 "크게보기" → lightbox, ✕ → 해당 slot 삭제. */}
      {mode !== 'couple' &&
        (!!anchor?.groomAnchorUrl ||
          !!anchor?.brideAnchorUrl ||
          groomLibrary.length > 0 ||
          brideLibrary.length > 0) && (
          <section className="rounded-md border border-[#E8DCC9] bg-white p-4">
            <h2 className="text-sm font-medium text-[#3D2E1F]">사용할 앵커 선택</h2>
            <p className="mt-1 text-xs text-[#8B7355]">
              신랑·신부를 각자 골라 조합할 수 있어요.
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
        {/* 헤더 — 제목 + 선택 카운트 + 안내문. 한 줄 너비 사용. */}
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="text-sm font-medium text-[#3D2E1F]">카탈로그 컷 선택</h2>
          {selectedIds.size > 0 && (
            <span className="text-[11px] text-[#5C4633]">
              {selectedIds.size}개 선택 · {selectedIds.size} 스냅 크레딧 차감
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-[#8B7355]">
          여러 컷을 선택해 한 번에 만들 수 있어요. 1장당 스냅 크레딧 1개 차감.
        </p>

        {/*
          가이드 + 필터 — 헤더 아래 같은 row 에 좌우 배치. lg+ 에선 가로 정렬
          (items-stretch 로 양쪽 박스가 같은 height), 모바일에선 세로 stack.
          이전엔 가이드가 좌측 컬럼의 heading 아래에 위치해 필터와 시작 라인이
          어긋났는데, heading 을 row 위로 빼고 guide / filter 를 동일한 row 의
          형제 요소로 만들어 수평 라인 정렬.
        */}
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-stretch">
          <div className="flex min-w-0 flex-1 flex-col">
            <CatalogSelectionGuide />
          </div>
          <div className="flex w-full flex-col lg:w-[320px] lg:shrink-0">
            <CatalogFilterBar
              value={catalogFilter}
              onChange={setCatalogFilter}
              resultCount={{
                shown: visibleCatalog.length,
                total: modeFilteredCatalog.length,
              }}
              onlyRecommended={onlyRecommended}
              onOnlyRecommendedChange={setOnlyRecommended}
              sortMode={catalogStats ? sortMode : undefined}
              onSortModeChange={catalogStats ? setSortMode : undefined}
            />
          </div>
        </div>

        {visibleCatalog.length === 0 ? (
          <p className="mt-3 rounded-md border border-dashed border-[#E8DCC9] bg-white p-6 text-center text-xs text-[#8B7355]">
            선택한 필터 조합에 맞는 카탈로그가 없어요. 필터를 조정해 보세요.
          </p>
        ) : (
          <div className="mt-3 grid auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {visibleCatalogPage.map((item) => {
              const selected = selectedIds.has(item.id);
              const enabled = isCatalogGeneratable(item);
              // 호환성 — admin 페이지에서 운영자가 설정한 태그 lookup.
              const adminTag = adminCondition
                ? adminTags[item.id]?.[adminCondition] ?? null
                : null;
              const compat = evaluateCompatibility(adminTag);
              return (
                <CatalogCard
                  key={item.id}
                  variant="picker"
                  item={item}
                  selected={selected}
                  disabled={isProgressing || !enabled}
                  isRecommended={compat.isRecommended}
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
                        {compat.level === 'risky' ? '비추' : '주의'}
                      </span>
                    ) : null
                  }
                />
              );
            })}
          </div>
        )}

        {/* 카탈로그 그리드 페이지네이션 — 24개/페이지. 랜딩과 동일 컨벤션. */}
        {visibleCatalog.length > 0 && totalCatalogPages > 1 && (
          <div className="mt-3 flex w-full max-w-full flex-wrap items-center justify-center gap-1 overflow-hidden text-[11px] text-[#5C4633]">
            <button
              type="button"
              onClick={() => setCatalogPage((p) => Math.max(0, p - 1))}
              disabled={clampedCatalogPage === 0}
              className="shrink-0 rounded border border-[#E8DCC9] bg-white px-2 py-1 hover:bg-[#FAF7F2] disabled:opacity-40"
            >
              이전
            </button>
            {catalogPageItems.map((it, idx) =>
              it === 'ellipsis' ? (
                <span
                  key={`e-${idx}`}
                  className="shrink-0 px-1 text-[#8B7355]"
                  aria-hidden
                >
                  …
                </span>
              ) : (
                <button
                  key={it}
                  type="button"
                  onClick={() => setCatalogPage(it)}
                  className={`min-w-[28px] shrink-0 rounded border px-2 py-1 ${
                    it === clampedCatalogPage
                      ? 'border-[#3D2E1F] bg-[#3D2E1F] text-white'
                      : 'border-[#E8DCC9] bg-white hover:bg-[#FAF7F2]'
                  }`}
                >
                  {it + 1}
                </button>
              ),
            )}
            <button
              type="button"
              onClick={() =>
                setCatalogPage((p) => Math.min(totalCatalogPages - 1, p + 1))
              }
              disabled={clampedCatalogPage >= totalCatalogPages - 1}
              className="shrink-0 rounded border border-[#E8DCC9] bg-white px-2 py-1 hover:bg-[#FAF7F2] disabled:opacity-40"
            >
              다음
            </button>
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
          기본은 카탈로그 사진을 그대로 따라 만들고, 얼굴이 어색하면 강화 모드로
          한 번 더 보강할 수 있어요.
        </p>

        {/* 자동 모드 추천 banner — 호환성 점수 기반.
              선택한 카탈로그 중 얼굴 강화가 권장되는 게 1개 이상 있고 현재 기본 모드
              (strict) 면 한 번 클릭으로 강화 모드 (prompt-only) 로 전환 권유. */}
        {imageReference === 'strict' &&
          promptOnlyRecommendedCount > 0 &&
          !modeRecommendDismissed && (
            <div className="mt-3 flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50/70 p-3 text-xs text-amber-900 sm:flex-row sm:items-center">
              <span className="flex-1">
                선택한 컷 중 <strong>{promptOnlyRecommendedCount}개</strong>는{' '}
                <strong>얼굴 강화 모드</strong>가 더 잘 맞아요. 켜시겠어요?
              </span>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setImageReference('prompt-only')}
                >
                  강화 켜기
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setModeRecommendDismissed(true)}
                >
                  기본 유지
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
            title="기본 모드"
            description="카탈로그 사진의 의상·배경·포즈를 그대로 따라 만듭니다. 대부분의 컷에서 자연스럽게 동작해요."
          />
          <ImageReferenceCard
            value="prompt-only"
            current={imageReference}
            disabled={isProgressing}
            onSelect={() => setImageReference('prompt-only')}
            title="얼굴 강화 모드"
            description="카탈로그 구도를 살짝 양보하고 내 얼굴 유사도를 최우선으로 보존합니다. 측면·전신 컷이나 결과가 어색했던 컷에 효과적."
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
            평균 약 2분 후에 완성됩니다. 화면을 떠나도 생성은 계속 진행되며, 결과는
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
      <div
        className={`grid gap-2 ${
          numAngles === 3 ? 'grid-cols-3' : numAngles === 2 ? 'grid-cols-2' : 'grid-cols-1'
        }`}
      >
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
  // 앵커 lightbox — 클릭한 썸네일의 원본 URL. null 이면 닫힘.
  // 선택(onSelect) 액션과 분리하기 위해 별도 "크게보기" 버튼이 트리거.
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // ESC 로 닫기.
  useEffect(() => {
    if (!lightboxUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxUrl(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightboxUrl]);

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
          <div
            className={`relative rounded-md border transition-colors ${
              selectedId === 'current'
                ? 'border-[#3D2E1F] ring-2 ring-[#3D2E1F]/30'
                : 'border-[#E8DCC9] hover:border-[#8B7355]'
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect('current')}
              aria-pressed={selectedId === 'current'}
              className="flex w-full flex-col gap-1 p-2 text-left"
            >
              <AnchorTinyThumb url={activeUrl} />
              <span className="text-[11px] font-medium text-[#3D2E1F]">현재</span>
              <span className="text-[10px] text-[#8B7355]">최근 저장</span>
            </button>
            <LightboxButton onClick={() => setLightboxUrl(activeUrl)} />
          </div>
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
            {lib.anchorUrl && (
              <LightboxButton onClick={() => setLightboxUrl(lib.anchorUrl)} />
            )}
            <button
              type="button"
              onClick={() => onDiscard(lib.id)}
              title="삭제"
              aria-label="삭제"
              className="absolute right-1 top-1 z-10 grid h-5 w-5 place-items-center rounded-full bg-white/95 text-[10px] leading-none text-[#8B7355] shadow-sm ring-1 ring-[#E8DCC9] hover:text-red-600 hover:ring-red-300"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Lightbox modal — 화면 정중앙에 큰 앵커 이미지. backdrop 또는 ESC 로 닫기. */}
      {lightboxUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${label} 앵커 크게 보기`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-h-full max-w-md" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxUrl}
              alt={`${label} 앵커`}
              className="block max-h-[85vh] w-auto rounded-md shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setLightboxUrl(null)}
              aria-label="닫기"
              className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-white text-sm text-[#3D2E1F] shadow-md hover:bg-[#FAF7F2]"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 썸네일 우하단의 "크게보기" 텍스트 버튼 — 부모 선택 button 과 별개로 onClick 트리거.
 * pointer event stopPropagation 해서 부모 button (선택) 이 실행되지 않도록.
 * (이전 🔍 이모지는 모바일에서 OS 별로 크기/색이 달라 보여 텍스트로 변경.)
 */
function LightboxButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title="크게 보기"
      aria-label="크게 보기"
      className="absolute bottom-1 right-1 z-10 rounded-sm bg-white/95 px-1.5 py-0.5 text-[9px] font-medium leading-none text-[#5C4633] shadow-sm ring-1 ring-[#E8DCC9] hover:text-[#3D2E1F]"
    >
      크게보기
    </button>
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

/**
 * 입력 모드 카드 — 셀카 / 커플 두 케이스를 큰 카드로 선택.
 *
 * 카드 하단에는 "예시 보기" 버튼이 들어가 클릭 시 ExampleFlowModal 이 열림.
 * 카드 자체 클릭은 모드 선택, 버튼 클릭은 stopPropagation 으로 모달만 열림.
 */
function ModeCard({
  title,
  description,
  selected,
  disabled,
  onClick,
  onShowExample,
}: {
  title: string;
  description: React.ReactNode;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  /** "예시 보기" 버튼 핸들러. 없으면 버튼 숨김. */
  onShowExample?: () => void;
}) {
  return (
    <div
      role="radio"
      aria-checked={selected}
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onClick()}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`flex cursor-pointer flex-col gap-1.5 rounded-md border p-3 text-left transition-colors ${
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
      {onShowExample && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onShowExample();
          }}
          className="mt-1 self-start text-[11px] font-medium text-[#3D2E1F] underline underline-offset-2 hover:text-[#5C4633]"
        >
          예시 보기 →
        </button>
      )}
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
 * 카탈로그 선택 가이드 — 사용자가 본인 입력 케이스에 맞춰 어떤 카탈로그를
 * 고르면 좋은지 한눈에 보여줌. 우측 검색 필터(CatalogFilterBar) 와 수평으로
 * 정렬되어 같은 row 의 좌측에 위치.
 *
 * 디자인 v4:
 *   - 헤더 ("자연스러운 카탈로그 선택 가이드") + 본문 2줄 구조 유지.
 *   - 이전 v3 의 👤/👫 항목 아이콘 제거 — 텍스트만으로 정보 전달.
 *   - 카드 형태(rounded + ring + bg gradient) + divide-y 로 행 구분.
 *   - 좌우 가이드/필터 박스가 같은 시작 라인 + 같은 height (lg:h-full + items-stretch
 *     로 부모에서 정렬).
 */
function CatalogSelectionGuide() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-[#E8DCC9] bg-gradient-to-br from-[#FAF7F2] to-white">
      <div className="border-b border-[#F0E8D8] bg-[#FAF7F2] px-3 py-1.5">
        <span className="text-[11px] font-semibold tracking-wide text-[#3D2E1F]">
          자연스러운 카탈로그 선택 가이드
        </span>
      </div>
      <ul className="flex flex-1 flex-col divide-y divide-[#F0E8D8] text-[12px] leading-relaxed text-[#5C4633]">
        <li className="px-3 py-2">
          <strong className="text-[#3D2E1F]">셀카로 만들기</strong>
          <span className="text-[#8B7355]"> →</span> 솔로 컷 ·
          커플 클로즈업 컷에 어울려요
        </li>
        <li className="px-3 py-2">
          <strong className="text-[#3D2E1F]">커플사진으로 만들기</strong>
          <span className="text-[#8B7355]"> →</span> 모든 커플 카탈로그에 어울려요
        </li>
      </ul>
    </div>
  );
}

/**
 * 합성 방식 (기본 / 얼굴 강화) 카드 — 라디오 인디케이터 + 제목 + 설명만.
 * (이전엔 카드 안에 선택한 카탈로그별 예시 결과 N장 그리드가 있었으나 노이즈로
 *  판단되어 제거. 모드 선택에 집중하도록 단순화.)
 */
function ImageReferenceCard({
  value,
  current,
  disabled,
  onSelect,
  title,
  description,
}: {
  value: 'strict' | 'prompt-only';
  current: 'strict' | 'prompt-only';
  disabled: boolean;
  onSelect: () => void;
  title: string;
  description: string;
}) {
  const selected = current === value;
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
    </button>
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

