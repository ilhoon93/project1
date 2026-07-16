'use client';

import { useCallback, useEffect, useRef, useState, useTransition, type PointerEvent } from 'react';
import { nanoid } from '@/lib/utils/nanoid';
import type { InvitationContent } from '@/types/invitation';
import type { ShowcaseCover } from '@/lib/marketing/social-proof';
import { InvitationPreview } from '@/components/marketing/InvitationPreview';
import {
  listShowcaseCandidates,
  loadInvitationForShowcase,
  uploadShowcaseImage,
  saveShowcaseCovers,
  addPhotolessCover,
  addAllPhotolessCovers,
  type ShowcaseCandidate,
} from './actions';

/** 얼굴 가리개 스티커 팔레트 — 웃는 얼굴(하트 없는) 위주 + 기본 하트 몇 종. */
const STICKERS = ['🙂', '😊', '😄', '😁', '😌', '☺️', '🙃', '😀', '❤️', '🩷', '🤍', '💛'];

interface Loaded {
  content: InvitationContent;
  groomName: string;
  brideName: string;
  weddingDate: string;
  heroImage: string;
}

interface Sticker {
  id: string;
  char: string;
  /** 표시 이미지 기준 중심 위치(%) + 크기(이미지 너비 대비 %). */
  xPct: number;
  yPct: number;
  sizePct: number;
}

/** 이름 자동 익명화 — 첫 글자 + ○ (예: 민준 → 민○). 비면 ○○. */
function initial(name: string): string {
  const t = name.trim();
  return t ? `${t[0]}○` : '○○';
}

export function ShowcaseEditor({
  initialCovers,
}: {
  initialCovers: ShowcaseCover[];
}) {
  const [covers, setCovers] = useState<ShowcaseCover[]>(initialCovers);
  const [savePending, startSave] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  // ── 동의 후보 목록 ─────────────────────────────────────────
  const [candidates, setCandidates] = useState<ShowcaseCandidate[] | null>(null);
  const [candErr, setCandErr] = useState<string | null>(null);
  const refreshCandidates = useCallback(async () => {
    setCandErr(null);
    const res = await listShowcaseCandidates();
    if (res.ok) setCandidates(res.candidates);
    else {
      setCandidates([]);
      setCandErr(res.error);
    }
  }, []);
  useEffect(() => {
    void refreshCandidates();
  }, [refreshCandidates]);

  // ── 소스 로드 ───────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // ── 편집 상태 ───────────────────────────────────────────────
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [anonGroom, setAnonGroom] = useState('');
  const [anonBride, setAnonBride] = useState('');
  const [busy, setBusy] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; ox: number; oy: number } | null>(null);

  const load = async (invitationId: string) => {
    setLoadErr(null);
    setLoading(true);
    setSelectedId(invitationId);
    try {
      const res = await loadInvitationForShowcase(invitationId);
      if (!res.ok) {
        setLoadErr(res.error);
        setLoaded(null);
        return;
      }
      if (!res.heroImage) {
        setLoadErr('이 알림장에는 메인 사진이 없어 showcase 대상이 아닙니다.');
        setLoaded(null);
        return;
      }
      setLoaded({
        content: res.content as InvitationContent,
        groomName: res.groomName,
        brideName: res.brideName,
        weddingDate: res.weddingDate,
        heroImage: res.heroImage,
      });
      setStickers([]);
      setSelected(null);
      setAnonGroom(initial(res.groomName));
      setAnonBride(initial(res.brideName));
    } finally {
      setLoading(false);
    }
  };

  // ── 스티커 조작 ─────────────────────────────────────────────
  const addSticker = (char: string) => {
    const s: Sticker = { id: nanoid(8), char, xPct: 50, yPct: 40, sizePct: 22 };
    setStickers((prev) => [...prev, s]);
    setSelected(s.id);
  };

  const onStickerPointerDown = (e: PointerEvent, s: Sticker) => {
    e.preventDefault();
    e.stopPropagation();
    setSelected(s.id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { id: s.id, startX: e.clientX, startY: e.clientY, ox: s.xPct, oy: s.yPct };
  };

  const onStickerPointerMove = (e: PointerEvent) => {
    const d = dragRef.current;
    const stage = stageRef.current;
    if (!d || !stage) return;
    const rect = stage.getBoundingClientRect();
    const dx = ((e.clientX - d.startX) / rect.width) * 100;
    const dy = ((e.clientY - d.startY) / rect.height) * 100;
    setStickers((prev) =>
      prev.map((s) =>
        s.id === d.id
          ? {
              ...s,
              xPct: Math.max(0, Math.min(100, d.ox + dx)),
              yPct: Math.max(0, Math.min(100, d.oy + dy)),
            }
          : s,
      ),
    );
  };

  const onStickerPointerUp = () => {
    dragRef.current = null;
  };

  const updateSelectedSize = (sizePct: number) =>
    setStickers((prev) => prev.map((s) => (s.id === selected ? { ...s, sizePct } : s)));

  const removeSticker = (id: string) => {
    setStickers((prev) => prev.filter((s) => s.id !== id));
    if (selected === id) setSelected(null);
  };

  const selectedSticker = stickers.find((s) => s.id === selected) ?? null;

  // ── 합성 → 업로드 → 저장 ────────────────────────────────────
  const composite = async (): Promise<Blob> => {
    if (!loaded) throw new Error('소스 없음');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('메인 사진을 불러오지 못했습니다(CORS).'));
      img.src = loaded.heroImage;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('캔버스 생성 실패');
    ctx.drawImage(img, 0, 0);
    for (const s of stickers) {
      const fontPx = (s.sizePct / 100) * canvas.width;
      ctx.font = `${fontPx}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.char, (s.xPct / 100) * canvas.width, (s.yPct / 100) * canvas.height);
    }
    const blob: Blob | null = await new Promise((res) => canvas.toBlob((b) => res(b), 'image/png'));
    if (!blob) throw new Error('이미지 인코딩 실패');
    return blob;
  };

  const addCover = async () => {
    if (!loaded) return;
    if (stickers.length === 0) {
      setMsg('얼굴을 가릴 스티커를 최소 1개 이상 붙여주세요.');
      return;
    }
    setMsg(null);
    setBusy(true);
    try {
      const blob = await composite();
      const fd = new FormData();
      fd.append('file', new File([blob], 'cover.png', { type: 'image/png' }));
      const up = await uploadShowcaseImage(fd);
      if (!up.ok) throw new Error(up.error);

      const content = structuredClone(loaded.content);
      content.main.heroImage = up.url;
      // 같은 알림장의 기존 커버가 있으면 교체(중복 방지).
      const withoutOld = selectedId
        ? covers.filter((c) => c.invitationId !== selectedId)
        : covers;
      const cover: ShowcaseCover = {
        id: nanoid(10),
        invitationId: selectedId ?? '',
        groomName: anonGroom.trim() || '○○',
        brideName: anonBride.trim() || '○○',
        weddingDate: loaded.weddingDate,
        hidden: false,
        content,
      };
      const next = [...withoutOld, cover];
      setCovers(next);
      const res = await saveShowcaseCovers(next);
      if (!res.ok) throw new Error(res.error ?? 'save failed');
      setMsg('커버가 추가되었습니다.');
      // 편집 상태 초기화(다음 알림장으로).
      setLoaded(null);
      setStickers([]);
      setSelected(null);
      setSelectedId(null);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '커버 추가 실패');
    } finally {
      setBusy(false);
    }
  };

  const removeCover = (id: string) => {
    const next = covers.filter((c) => c.id !== id);
    setCovers(next);
    startSave(async () => {
      const res = await saveShowcaseCovers(next);
      setMsg(res.ok ? '삭제되었습니다.' : `삭제 실패: ${res.error ?? 'unknown'}`);
    });
  };

  const toggleHidden = (id: string) => {
    const next = covers.map((c) => (c.id === id ? { ...c, hidden: !c.hidden } : c));
    setCovers(next);
    startSave(async () => {
      const res = await saveShowcaseCovers(next);
      setMsg(res.ok ? '노출 설정이 저장되었습니다.' : `저장 실패: ${res.error ?? 'unknown'}`);
    });
  };

  const registeredIds = new Set(covers.map((c) => c.invitationId).filter(Boolean));

  // 사진 없는 디자인 — 스티커 없이 바로 추가.
  const addOnePhotoless = (invitationId: string) => {
    setMsg(null);
    startSave(async () => {
      const res = await addPhotolessCover(invitationId);
      if (res.ok) {
        setCovers(res.covers);
        setMsg('사진 없는 디자인을 추가했습니다.');
      } else {
        setMsg(`실패: ${res.error}`);
      }
    });
  };

  const addAllPhotoless = () => {
    setMsg(null);
    startSave(async () => {
      const res = await addAllPhotolessCovers();
      if (res.ok) {
        setCovers(res.covers);
        setMsg(
          res.added > 0
            ? `사진 없는 디자인 ${res.added}건을 추가했습니다.`
            : '추가할 새 디자인이 없습니다.',
        );
      } else {
        setMsg(`실패: ${res.error}`);
      }
    });
  };

  const photolessCount = (candidates ?? []).filter(
    (c) => !c.hasPhoto && !registeredIds.has(c.id),
  ).length;

  return (
    <div className="flex flex-col gap-6">
      {msg && (
        <p
          className={`rounded-md px-3 py-2 text-[12px] ${
            /실패|없|CORS/.test(msg)
              ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
              : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
          }`}
        >
          {msg}
        </p>
      )}

      {/* ── 1. 동의 고객 목록 ─────────────────────────────── */}
      <section className="flex flex-col gap-3 rounded-md border border-[#E8DCC9] bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[13px] font-semibold text-[#3D2E1F]">
            1. 동의한 알림장 {candidates ? `(${candidates.length})` : ''}
          </h2>
          <button
            type="button"
            onClick={() => refreshCandidates()}
            className="text-[11px] text-[#8B7355] hover:underline"
          >
            새로고침
          </button>
        </div>
        <p className="text-[11px] leading-relaxed text-[#8B7355]">
          <strong className="text-[#3D2E1F]">사진 있는 디자인</strong>은 동의(showcase_consent)한
          발행 건만, <strong className="text-[#3D2E1F]">사진 없는 디자인</strong>(일러스트·텍스트)은
          얼굴 노출이 없어 <strong className="text-[#3D2E1F]">동의 없이도</strong> 표시됩니다.
          사진 카드는 선택해 스티커를, 사진 없는 카드는 바로 추가할 수 있어요.
        </p>

        {photolessCount > 0 && (
          <button
            type="button"
            onClick={addAllPhotoless}
            disabled={savePending}
            className="self-start rounded-md border border-[#8B7355] px-3 py-1.5 text-[12px] font-medium text-[#8B7355] transition-colors hover:bg-[#8B7355] hover:text-white disabled:opacity-50"
          >
            사진 없는 디자인 {photolessCount}건 모두 추가
          </button>
        )}

        {candErr && <p className="text-[11px] text-red-600">{candErr}</p>}
        {candidates === null ? (
          <p className="py-4 text-center text-[11px] text-[#8B7355]">불러오는 중…</p>
        ) : candidates.length === 0 ? (
          <p className="rounded-md border border-[#E8DCC9] bg-[#FAF7F2] p-4 text-[11px] text-[#8B7355]">
            표시할 발행 알림장이 없습니다.
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {candidates.map((c) => {
              const on = selectedId === c.id;
              const done = registeredIds.has(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => (c.hasPhoto ? load(c.id) : addOnePhotoless(c.id))}
                    disabled={loading || savePending}
                    className={`relative block w-full overflow-hidden rounded-lg border text-left transition-colors disabled:opacity-60 ${
                      on ? 'border-[1.5px] border-[#B5614F]' : 'border-[#E8DCC9] hover:border-[#8B7355]'
                    }`}
                  >
                    <div className="grid aspect-[3/4] w-full place-items-center bg-[#FAF7F2]">
                      {c.hasPhoto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.heroImage} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="px-1 text-center text-[10px] leading-tight text-[#B09B80]">
                          🎨 사진 없는
                          <br />
                          디자인
                        </span>
                      )}
                    </div>
                    {done ? (
                      <span className="absolute right-1 top-1 rounded bg-[#B5614F] px-1.5 py-0.5 text-[9px] font-medium text-white">
                        등록됨
                      </span>
                    ) : (
                      !c.hasPhoto && (
                        <span className="absolute right-1 top-1 rounded bg-[#6B8E7A] px-1.5 py-0.5 text-[9px] font-medium text-white">
                          동의 불필요
                        </span>
                      )
                    )}
                    <span className="block truncate px-1.5 py-1 text-[10.5px] text-[#5C4633]">
                      {c.groomName || '신랑'} · {c.brideName || '신부'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {loadErr && <p className="text-[11px] text-red-600">{loadErr}</p>}
      </section>

      {/* ── 2. 스티커 붙이기 ─────────────────────────────── */}
      {loaded && (
        <section className="flex flex-col gap-4 rounded-md border border-[#E8DCC9] bg-white p-4">
          <h2 className="text-[13px] font-semibold text-[#3D2E1F]">
            2. 얼굴 위 스티커 붙이기
          </h2>

          <div className="flex flex-col gap-4 sm:flex-row">
            {/* 스테이지 — 메인 사진 + 드래그 가능한 스티커 */}
            <div className="flex flex-col items-center gap-2">
              <div
                ref={stageRef}
                className="relative w-[260px] select-none overflow-hidden rounded-lg border border-[#E8DCC9] bg-[#FAF7F2]"
                onPointerDown={() => setSelected(null)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={loaded.heroImage}
                  alt="메인 사진"
                  className="pointer-events-none block w-full"
                  draggable={false}
                />
                {stickers.map((s) => (
                  <div
                    key={s.id}
                    onPointerDown={(e) => onStickerPointerDown(e, s)}
                    onPointerMove={onStickerPointerMove}
                    onPointerUp={onStickerPointerUp}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none leading-none ${
                      selected === s.id ? 'rounded ring-2 ring-[#B5614F]' : ''
                    }`}
                    style={{
                      left: `${s.xPct}%`,
                      top: `${s.yPct}%`,
                      fontSize: `${(s.sizePct / 100) * 260}px`,
                    }}
                  >
                    {s.char}
                  </div>
                ))}
              </div>
              <p className="text-[10.5px] text-[#B09B80]">
                스티커를 드래그해 얼굴 위로 옮기세요.
              </p>
            </div>

            {/* 컨트롤 */}
            <div className="flex flex-1 flex-col gap-3">
              <div>
                <p className="mb-1.5 text-[11px] font-medium text-[#8B7355]">스티커 추가</p>
                <div className="flex flex-wrap gap-1.5">
                  {STICKERS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => addSticker(c)}
                      className="grid h-8 w-8 place-items-center rounded-md border border-[#E8DCC9] bg-white text-[18px] hover:bg-[#FAF7F2]"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {selectedSticker ? (
                <div className="flex flex-col gap-2 rounded-md border border-[#E8DCC9] bg-[#FAF7F2] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-[#8B7355]">
                      선택된 스티커 {selectedSticker.char}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeSticker(selectedSticker.id)}
                      className="text-[11px] text-red-600 hover:underline"
                    >
                      삭제
                    </button>
                  </div>
                  <label className="flex items-center gap-2 text-[11px] text-[#8B7355]">
                    크기
                    <input
                      type="range"
                      min={8}
                      max={60}
                      value={selectedSticker.sizePct}
                      onChange={(e) => updateSelectedSize(Number(e.target.value))}
                      className="flex-1"
                    />
                  </label>
                </div>
              ) : (
                <p className="text-[11px] text-[#B09B80]">
                  스티커를 클릭하면 크기 조절·삭제할 수 있습니다.
                </p>
              )}

              {/* 익명 이름 */}
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-[#8B7355]">신랑(익명)</span>
                  <input
                    className="rounded border border-[#E8DCC9] bg-white px-2.5 py-1.5 text-[13px] text-[#3D2E1F] focus:border-[#8B7355] focus:outline-none"
                    value={anonGroom}
                    onChange={(e) => setAnonGroom(e.target.value)}
                    placeholder="○○"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-[#8B7355]">신부(익명)</span>
                  <input
                    className="rounded border border-[#E8DCC9] bg-white px-2.5 py-1.5 text-[13px] text-[#3D2E1F] focus:border-[#8B7355] focus:outline-none"
                    value={anonBride}
                    onChange={(e) => setAnonBride(e.target.value)}
                    placeholder="○○"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={addCover}
                disabled={busy}
                className="mt-1 self-start rounded-md bg-[#B5614F] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
              >
                {busy ? '처리 중…' : '스티커 합성 후 커버 추가'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── 3. 등록된 커버 ───────────────────────────────── */}
      <section className="flex flex-col gap-3 rounded-md border border-[#E8DCC9] bg-white p-4">
        <h2 className="text-[13px] font-semibold text-[#3D2E1F]">
          등록된 showcase 커버 ({covers.length})
        </h2>
        {covers.length === 0 ? (
          <p className="text-[11px] text-[#8B7355]">아직 등록된 커버가 없습니다.</p>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {covers.map((c) => (
              <li key={c.id} className="flex w-[120px] flex-col gap-1.5">
                <div
                  className={`relative aspect-[1/2] w-full overflow-hidden rounded-lg border border-[#E8DCC9] bg-[#FAF7F2] ${
                    c.hidden ? 'opacity-40' : ''
                  }`}
                >
                  <InvitationPreview
                    design={{
                      id: c.id,
                      name: '',
                      layoutLabel: '',
                      groomName: c.groomName,
                      brideName: c.brideName,
                      weddingDate: c.weddingDate,
                      content: c.content,
                    }}
                    cover
                  />
                  {c.hidden && (
                    <span className="absolute left-1 top-1 rounded bg-[#6B4E1E] px-1.5 py-0.5 text-[9px] font-medium text-white">
                      숨김
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => toggleHidden(c.id)}
                    disabled={savePending}
                    className="text-[11px] text-[#8B7355] hover:underline disabled:opacity-50"
                  >
                    {c.hidden ? '보이기' : '숨기기'}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeCover(c.id)}
                    disabled={savePending}
                    className="text-[11px] text-red-600 hover:underline disabled:opacity-50"
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
