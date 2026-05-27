'use client';

import { useState, useTransition } from 'react';
import {
  COLOR_THEMES,
  PETAL_TYPES,
  AVAILABLE_FONT_KEYS,
  type ColorTheme,
  type PetalType,
  type FontKey,
} from '@/lib/theme';
import { MAIN_LAYOUTS, type InvitationContent } from '@/types/invitation';
import type {
  DesignConfig,
  HomeSamplesConfig,
} from '@/lib/marketing/sample-invitations';
import { saveHomeSamplesAction } from './actions';

type MainLayout = InvitationContent['main']['layout'];
interface CatalogItem {
  id: string;
  label: string;
  src: string;
}

const inputCls =
  'w-full rounded border border-[#E8DCC9] bg-white px-2 py-1.5 text-[12px] text-[#3D2E1F] focus:border-[#8B7355] focus:outline-none';
const labelCls = 'block text-[10px] font-medium uppercase tracking-wide text-[#8B7355]';

export function HomeSamplesEditor({
  initialConfig,
  catalog,
}: {
  initialConfig: HomeSamplesConfig;
  catalog: CatalogItem[];
}) {
  const [config, setConfig] = useState<HomeSamplesConfig>(initialConfig);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const byId = new Map(catalog.map((c) => [c.id, c]));
  const srcOf = (id: string) => byId.get(id)?.src ?? `/wedding-snap/catalog/${id}.jpg`;

  // ── AI 스냅 ──────────────────────────────────────────────
  const snaps = config.aiSnapCatalogIds;
  const setSnaps = (next: string[]) =>
    setConfig((c) => ({ ...c, aiSnapCatalogIds: next }));
  const addSnap = (id: string) => {
    if (!id || snaps.includes(id)) return;
    setSnaps([...snaps, id]);
  };
  const removeSnap = (i: number) => setSnaps(snaps.filter((_, k) => k !== i));
  const moveSnap = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= snaps.length) return;
    const next = [...snaps];
    [next[i], next[j]] = [next[j], next[i]];
    setSnaps(next);
  };

  // ── 디자인 ──────────────────────────────────────────────
  const setDesigns = (next: DesignConfig[]) =>
    setConfig((c) => ({ ...c, designs: next }));
  const patchDesign = (i: number, patch: Partial<DesignConfig>) =>
    setDesigns(config.designs.map((d, k) => (k === i ? { ...d, ...patch } : d)));
  const moveDesign = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= config.designs.length) return;
    const next = [...config.designs];
    [next[i], next[j]] = [next[j], next[i]];
    setDesigns(next);
  };

  const save = () => {
    setMsg(null);
    startTransition(async () => {
      const res = await saveHomeSamplesAction(config);
      setMsg(res.ok ? '저장됐습니다.' : `저장 실패: ${res.error ?? '알 수 없음'}`);
    });
  };

  const unusedCatalog = catalog.filter((c) => !snaps.includes(c.id));

  return (
    <div className="space-y-8">
      {/* ───────────── AI 스냅 샘플 ───────────── */}
      <section className="rounded-lg border border-[#E8DCC9] bg-white p-4">
        <h2 className="text-sm font-semibold text-[#3D2E1F]">샘플 AI스냅</h2>
        <p className="mt-0.5 text-[11px] text-[#8B7355]">
          앞 4개 = 메인 폴라로이드, 전체 = AI 스냅 썸네일 스트립. 순서대로 노출됩니다.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {snaps.map((id, i) => (
            <div
              key={id}
              className="relative w-[88px] overflow-hidden rounded border border-[#E8DCC9]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={srcOf(id)} alt={id} className="h-[118px] w-full object-cover" />
              {i < 4 && (
                <span className="absolute left-1 top-1 rounded bg-[#3D2E1F]/80 px-1 text-[8px] text-white">
                  폴라로이드
                </span>
              )}
              <div className="flex items-center justify-between gap-0.5 bg-[#FAF7F2] px-1 py-1">
                <button
                  type="button"
                  onClick={() => moveSnap(i, -1)}
                  className="px-1 text-[12px] text-[#8B7355] disabled:opacity-30"
                  disabled={i === 0}
                >
                  ←
                </button>
                <span className="text-[9px] text-[#8B7355]">{i + 1}</span>
                <button
                  type="button"
                  onClick={() => moveSnap(i, 1)}
                  className="px-1 text-[12px] text-[#8B7355] disabled:opacity-30"
                  disabled={i === snaps.length - 1}
                >
                  →
                </button>
                <button
                  type="button"
                  onClick={() => removeSnap(i)}
                  className="px-1 text-[12px] text-[#B5614F]"
                  aria-label="제거"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3">
          <label className={labelCls}>카탈로그에서 추가</label>
          <select
            className={`${inputCls} mt-1 max-w-md`}
            value=""
            onChange={(e) => {
              addSnap(e.target.value);
              e.currentTarget.selectedIndex = 0;
            }}
          >
            <option value="">+ 추가할 카탈로그 선택…</option>
            {unusedCatalog.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} ({c.id})
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* ───────────── 알림장 디자인 ───────────── */}
      <section className="rounded-lg border border-[#E8DCC9] bg-white p-4">
        <h2 className="text-sm font-semibold text-[#3D2E1F]">알림장 디자인 샘플</h2>
        <p className="mt-0.5 text-[11px] text-[#8B7355]">
          노출 여부·순서와 표지(테마·효과·폰트·레이아웃·사진·이름·인사말)를 설정합니다.
          본문(스토리·갤러리 등)은 공유 템플릿으로 고정됩니다.
        </p>

        <div className="mt-4 space-y-4">
          {config.designs.map((d, i) => {
            const heroOptions = byId.has(d.heroImageId)
              ? catalog
              : [{ id: d.heroImageId, label: d.heroImageId, src: srcOf(d.heroImageId) }, ...catalog];
            return (
              <div
                key={d.id}
                className={`rounded-md border p-3 ${
                  d.enabled ? 'border-[#E8DCC9] bg-[#FCFAF6]' : 'border-[#EEE6D8] bg-[#F3EFE8] opacity-70'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={srcOf(d.heroImageId)}
                    alt=""
                    className="h-[68px] w-[40px] flex-shrink-0 rounded object-cover"
                  />
                  <input
                    className={`${inputCls} flex-1 font-medium`}
                    value={d.name}
                    onChange={(e) => patchDesign(i, { name: e.target.value })}
                    placeholder="디자인 이름"
                  />
                  <label className="flex items-center gap-1 text-[11px] text-[#5C4633]">
                    <input
                      type="checkbox"
                      checked={d.enabled}
                      onChange={(e) => patchDesign(i, { enabled: e.target.checked })}
                    />
                    노출
                  </label>
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => moveDesign(i, -1)}
                      disabled={i === 0}
                      className="text-[11px] text-[#8B7355] disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => moveDesign(i, 1)}
                      disabled={i === config.designs.length - 1}
                      className="text-[11px] text-[#8B7355] disabled:opacity-30"
                    >
                      ▼
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Field label="컬러 테마">
                    <select
                      className={inputCls}
                      value={d.colorTheme}
                      onChange={(e) => patchDesign(i, { colorTheme: e.target.value as ColorTheme })}
                    >
                      {COLOR_THEMES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="배경 효과">
                    <select
                      className={inputCls}
                      value={d.petalType}
                      onChange={(e) => patchDesign(i, { petalType: e.target.value as PetalType })}
                    >
                      {PETAL_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="폰트">
                    <select
                      className={inputCls}
                      value={d.font}
                      onChange={(e) => patchDesign(i, { font: e.target.value as FontKey })}
                    >
                      {AVAILABLE_FONT_KEYS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="레이아웃">
                    <select
                      className={inputCls}
                      value={d.layout}
                      onChange={(e) => patchDesign(i, { layout: e.target.value as MainLayout })}
                    >
                      {MAIN_LAYOUTS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="표지 사진">
                    <select
                      className={inputCls}
                      value={d.heroImageId}
                      onChange={(e) => patchDesign(i, { heroImageId: e.target.value })}
                    >
                      {heroOptions.map((c) => (
                        <option key={c.id} value={c.id}>{c.label} ({c.id})</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="태그(레이아웃 라벨)">
                    <input
                      className={inputCls}
                      value={d.layoutLabel}
                      onChange={(e) => patchDesign(i, { layoutLabel: e.target.value })}
                    />
                  </Field>
                  <Field label="신랑 이름">
                    <input
                      className={inputCls}
                      value={d.groomName}
                      onChange={(e) => patchDesign(i, { groomName: e.target.value })}
                    />
                  </Field>
                  <Field label="신부 이름">
                    <input
                      className={inputCls}
                      value={d.brideName}
                      onChange={(e) => patchDesign(i, { brideName: e.target.value })}
                    />
                  </Field>
                  <Field label="예식일 (YYYY-MM-DD)">
                    <input
                      className={inputCls}
                      value={d.weddingDate}
                      onChange={(e) => patchDesign(i, { weddingDate: e.target.value })}
                      placeholder="2026-05-23"
                    />
                  </Field>
                  <Field label="인사말(표지)">
                    <input
                      className={inputCls}
                      value={d.greetingShort}
                      onChange={(e) => patchDesign(i, { greetingShort: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ───────────── 저장 ───────────── */}
      <div className="sticky bottom-0 flex items-center gap-3 border-t border-[#E8DCC9] bg-[#FAF7F2]/95 py-3 backdrop-blur">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-full bg-[#3D2E1F] px-5 py-2 text-[13px] font-medium text-white disabled:opacity-50"
        >
          {pending ? '저장 중…' : '저장'}
        </button>
        {msg && <span className="text-[12px] text-[#5C4633]">{msg}</span>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
