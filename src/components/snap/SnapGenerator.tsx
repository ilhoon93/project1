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
import { CatalogThumbnail } from '@/components/snap/CatalogThumbnail';

// 폴링 — gpt-image-2 medium 은 보통 20–60초.
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
  /** signed URL on private-uploads — fal 가 fetch 가능 */
  url: string | null;
  /** 미리보기용 (브라우저 ObjectURL 또는 동일 signed URL) */
  preview: string | null;
  /** 업로드 진행 중 표시 */
  uploading: boolean;
}

interface BodyForm {
  /** 빈 문자열을 허용하기 위해 string 상태로 보관 — submit 시 parse. */
  heightCm: string;
  weightKg: string;
}

const HEIGHT_RANGE = { min: 140, max: 210 };
const WEIGHT_RANGE = { min: 35, max: 150 };

const emptyFace = (): FaceState => ({ url: null, preview: null, uploading: false });

interface Props {
  catalog: SnapCatalogItem[];
}

/**
 * 입력 가능한 값일 때만 숫자, 아니면 null. 둘 다 채워졌고 범위 내일 때만
 * 서버로 보낸다 (한쪽만 비어 있으면 그 사람은 omit).
 */
function parseBody(b: BodyForm): { heightCm: number; weightKg: number } | null {
  const h = Number(b.heightCm);
  const w = Number(b.weightKg);
  if (!b.heightCm || !b.weightKg) return null;
  if (!Number.isFinite(h) || !Number.isFinite(w)) return null;
  if (h < HEIGHT_RANGE.min || h > HEIGHT_RANGE.max) return null;
  if (w < WEIGHT_RANGE.min || w > WEIGHT_RANGE.max) return null;
  return { heightCm: h, weightKg: w };
}

export function SnapGenerator({ catalog }: Props) {
  // 입력 모드 — 셀카 2장 (디폴트) / 커플 사진 1장.
  // 모드를 바꿔도 이미 업로드한 사진은 유지(서버에 이미 올라가 있으므로) 하고,
  // 사용하지 않는 슬롯은 단순히 무시한다.
  const [mode, setMode] = useState<InputMode>('selfies');

  const [groom, setGroom] = useState<FaceState>(emptyFace);
  const [bride, setBride] = useState<FaceState>(emptyFace);
  const [couple, setCouple] = useState<FaceState>(emptyFace);
  const [groomBody, setGroomBody] = useState<BodyForm>({ heightCm: '', weightKg: '' });
  const [brideBody, setBrideBody] = useState<BodyForm>({ heightCm: '', weightKg: '' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [progressNote, setProgressNote] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const groomInputRef = useRef<HTMLInputElement>(null);
  const brideInputRef = useRef<HTMLInputElement>(null);
  const coupleInputRef = useRef<HTMLInputElement>(null);

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

  const isProgressing =
    stage === 'submitting' || stage === 'queued' || stage === 'in-progress' || stage === 'finalizing';

  // 현재 모드에서 모든 입력이 충족됐는지.
  const inputsReady =
    mode === 'selfies' ? !!groom.url && !!bride.url : !!couple.url;
  const canGenerate = inputsReady && !!selectedId && !isProgressing;

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
    if (!selectedId) return;
    if (mode === 'selfies' && (!groom.url || !bride.url)) return;
    if (mode === 'couple' && !couple.url) return;

    setStage('submitting');
    setErrorMsg(null);
    setResultUrl(null);
    setProgressNote('AI 작업을 큐에 제출하는 중...');

    const groomBodyValid = parseBody(groomBody);
    const brideBodyValid = parseBody(brideBody);

    const payload =
      mode === 'couple'
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

  const inputsHint =
    !inputsReady
      ? mode === 'selfies'
        ? '얼굴 사진을 모두 업로드하세요'
        : '커플 사진을 업로드하세요'
      : !selectedId
        ? '카탈로그 컷을 선택하세요'
        : null;

  // 결과 비교 뷰에서 사용할 선택된 카탈로그.
  const selectedCatalog = selectedId ? catalog.find((c) => c.id === selectedId) ?? null : null;

  return (
    <div className="mt-6 flex flex-col gap-6">
      {/* 1. 입력 모드 선택 + 업로드 */}
      <section className="rounded-md border border-[#E8DCC9] bg-white p-4">
        <h2 className="text-sm font-medium text-[#3D2E1F]">1. 사진 업로드</h2>

        {/* 모드 토글 — 셀카 (디폴트) / 커플 사진 */}
        <div
          role="tablist"
          aria-label="입력 방식"
          className="mt-3 inline-flex rounded-md border border-[#E8DCC9] bg-[#FAF7F2] p-0.5 text-xs"
        >
          <ModeToggleButton
            selected={mode === 'selfies'}
            disabled={isProgressing}
            onClick={() => setMode('selfies')}
          >
            셀카 2장 (권장)
          </ModeToggleButton>
          <ModeToggleButton
            selected={mode === 'couple'}
            disabled={isProgressing}
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
          </>
        ) : (
          <>
            <p className="mt-3 text-xs text-[#8B7355]">
              두 사람이 함께 찍힌 정면 사진을 1장 올려주세요. 두 분의 포즈·체형·
              상호작용을 그대로 유지하고, 카탈로그의 의상·배경·조명만 입혀
              드려요. 좋은 데이트 사진이 있으면 결과 품질이 가장 좋습니다.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <FaceUploader
                label="커플 사진"
                face={couple}
                disabled={isProgressing}
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

      {/* 1-b. 키 / 몸무게 (선택) — 전신 비율 반영용 */}
      <section className="rounded-md border border-[#E8DCC9] bg-white p-4">
        <h2 className="text-sm font-medium text-[#3D2E1F]">
          1-1. 키 · 몸무게 <span className="text-[10px] text-[#8B7355]">(선택)</span>
        </h2>
        <p className="mt-1 text-xs text-[#8B7355]">
          전신 / 반신 컷의 비율을 맞추는 데 사용돼요. 키 {HEIGHT_RANGE.min}–
          {HEIGHT_RANGE.max}cm · 몸무게 {WEIGHT_RANGE.min}–{WEIGHT_RANGE.max}kg
          범위로 입력해주세요. 비워두면 카탈로그 기본 체형으로 합성됩니다.
          {mode === 'couple' && (
            <>
              <br />
              커플 사진 모드에서는 사진 속 체형이 우선이지만, 입력하면 보정에
              참고됩니다.
            </>
          )}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <BodyFields
            label="신랑"
            value={groomBody}
            disabled={isProgressing}
            onChange={setGroomBody}
          />
          <BodyFields
            label="신부"
            value={brideBody}
            disabled={isProgressing}
            onChange={setBrideBody}
          />
        </div>
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
          {!canGenerate && stage === 'idle' && inputsHint && (
            <span className="text-xs text-[#8B7355]">{inputsHint}</span>
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

      {/* 4. 결과 — 카탈로그 마스터 ↔ 생성 결과 비교 뷰 */}
      {stage === 'done' && resultUrl && (
        <section className="rounded-md border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900 dark:bg-emerald-900/10">
          <h2 className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            ✨ 생성 완료
          </h2>
          <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-300/80">
            선택한 카탈로그와 생성 결과를 나란히 비교해보세요. AI 합성은
            카탈로그를 기준으로 하지만 얼굴/체형 차이로 일부 디테일은 달라질
            수 있어요.
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
  /** 커플 사진은 더 넓은 프레임 사용 */
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
