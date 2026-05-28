'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  COLOR_THEMES,
  PETAL_TYPES,
  AVAILABLE_FONT_KEYS,
  THEME_PALETTES,
  type ColorTheme,
  type PetalType,
  type FontKey,
} from '@/lib/theme';
import { type InvitationContent } from '@/types/invitation';
import {
  PosterDesignControls,
  FrameDesignControls,
  IllustrationDesignControls,
  TextDesignControls,
} from '@/components/editor/sections/MainEditor';
import { ColorSwatch, PetalIcon } from '@/components/editor/sections/ThemeEditor';
import {
  buildDesign,
  type BeforeAfterConfig,
  type BeforeAfterStyle,
  type DesignConfig,
  type HomeSamplesConfig,
  type TemplateChapter,
  type TemplateConfig,
} from '@/lib/marketing/sample-invitations';
import { InvitationPreview } from '@/components/marketing/InvitationPreview';
import { saveHomeSamplesAction } from './actions';

type MainSection = InvitationContent['main'];
type MainLayout = MainSection['layout'];

interface CatalogItem {
  id: string;
  label: string;
  src: string;
}

const LAYOUT_OPTIONS: { value: MainLayout; label: string }[] = [
  { value: 'poster', label: '풀이미지(포스터)' },
  { value: 'frame', label: '액자 프레임' },
  { value: 'illustration', label: '일러스트' },
  { value: 'text', label: '텍스트' },
];

// Before 이미지로 선택 가능한 mode-examples (catalog 와 별도 위치).
const MODE_EXAMPLE_OPTIONS: { path: string; label: string }[] = [
  { path: '/wedding-snap/mode-examples/couple-input-1.jpg', label: '커플 입력 샘플 1' },
  { path: '/wedding-snap/mode-examples/couple-input-2.jpg', label: '커플 입력 샘플 2' },
];

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
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const byId = useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog]);
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
  const patchMain = (i: number, patch: Partial<MainSection>) =>
    setDesigns(
      config.designs.map((d, k) => (k === i ? { ...d, main: { ...d.main, ...patch } } : d)),
    );
  const moveDesign = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= config.designs.length) return;
    const next = [...config.designs];
    [next[i], next[j]] = [next[j], next[i]];
    setDesigns(next);
  };

  // ── Before/After ─────────────────────────────────────────
  const setBA = (next: BeforeAfterConfig) =>
    setConfig((c) => ({ ...c, beforeAfter: next }));
  const patchStyle = (i: number, patch: Partial<BeforeAfterStyle>) =>
    setBA({
      ...config.beforeAfter,
      styles: config.beforeAfter.styles.map((s, k) =>
        k === i ? { ...s, ...patch } : s,
      ),
    });

  // ── Template ─────────────────────────────────────────────
  const setTpl = (next: TemplateConfig) =>
    setConfig((c) => ({ ...c, template: next }));
  const patchTpl = (patch: Partial<TemplateConfig>) =>
    setTpl({ ...config.template, ...patch });
  const patchChapter = (i: number, patch: Partial<TemplateChapter>) =>
    setTpl({
      ...config.template,
      storyChapters: config.template.storyChapters.map((ch, k) =>
        k === i ? { ...ch, ...patch } : ch,
      ),
    });
  const setGalleryId = (i: number, id: string) =>
    setTpl({
      ...config.template,
      galleryImageIds: config.template.galleryImageIds.map((g, k) =>
        k === i ? id : g,
      ),
    });
  const setQuizOpt = (i: number, v: string) =>
    setTpl({
      ...config.template,
      quizOptions: config.template.quizOptions.map((o, k) => (k === i ? v : o)),
    });
  const setVoteOpt = (i: number, v: string) =>
    setTpl({
      ...config.template,
      voteOptions: config.template.voteOptions.map((o, k) => (k === i ? v : o)),
    });

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
            <div key={id} className="relative w-[88px] overflow-hidden rounded border border-[#E8DCC9]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={srcOf(id)} alt={id} className="h-[118px] w-full object-cover" />
              {i < 4 && (
                <span className="absolute left-1 top-1 rounded bg-[#3D2E1F]/80 px-1 text-[8px] text-white">폴라로이드</span>
              )}
              <div className="flex items-center justify-between gap-0.5 bg-[#FAF7F2] px-1 py-1">
                <button type="button" onClick={() => moveSnap(i, -1)} className="px-1 text-[12px] text-[#8B7355] disabled:opacity-30" disabled={i === 0}>←</button>
                <span className="text-[9px] text-[#8B7355]">{i + 1}</span>
                <button type="button" onClick={() => moveSnap(i, 1)} className="px-1 text-[12px] text-[#8B7355] disabled:opacity-30" disabled={i === snaps.length - 1}>→</button>
                <button type="button" onClick={() => removeSnap(i)} className="px-1 text-[12px] text-[#B5614F]" aria-label="제거">✕</button>
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
              <option key={c.id} value={c.id}>{c.label} ({c.id})</option>
            ))}
          </select>
        </div>
      </section>

      {/* ───────────── Before/After ───────────── */}
      <section className="rounded-lg border border-[#E8DCC9] bg-white p-4">
        <h2 className="text-sm font-semibold text-[#3D2E1F]">메인 AI스냅 Before/After</h2>
        <p className="mt-0.5 text-[11px] text-[#8B7355]">
          왼쪽 슬라이드의 입력(Before) 사진과, 4개 스타일 탭(after)을 설정합니다.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Before 사진">
            <select
              className={inputCls}
              value={config.beforeAfter.beforeImage}
              onChange={(e) => setBA({ ...config.beforeAfter, beforeImage: e.target.value })}
            >
              <optgroup label="mode-examples (입력 샘플)">
                {MODE_EXAMPLE_OPTIONS.map((o) => (
                  <option key={o.path} value={o.path}>{o.label}</option>
                ))}
              </optgroup>
              <optgroup label="catalog">
                {catalog.map((c) => (
                  <option key={c.id} value={c.src}>{c.label}</option>
                ))}
              </optgroup>
            </select>
          </Field>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {config.beforeAfter.styles.map((s, i) => (
            <div key={`${s.id}-${i}`} className="rounded-md border border-[#E8DCC9] bg-[#FCFAF6] p-3">
              <div className="mb-2 flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.afterImage} alt={s.label} className="h-[48px] w-[72px] flex-shrink-0 rounded object-cover" />
                <span className="text-[10px] uppercase tracking-wide text-[#8B7355]">스타일 {i + 1}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="id (영문)">
                  <input className={inputCls} value={s.id} onChange={(e) => patchStyle(i, { id: e.target.value })} />
                </Field>
                <Field label="탭 라벨">
                  <input className={inputCls} value={s.label} onChange={(e) => patchStyle(i, { label: e.target.value })} />
                </Field>
                <Field label="After 라벨(슬라이더 우측)">
                  <input className={inputCls} value={s.afterLabel} onChange={(e) => patchStyle(i, { afterLabel: e.target.value })} />
                </Field>
                <Field label="After 사진 (catalog)">
                  <select
                    className={inputCls}
                    value={s.afterImage}
                    onChange={(e) => patchStyle(i, { afterImage: e.target.value })}
                  >
                    {!catalog.some((c) => c.src === s.afterImage) && (
                      <option value={s.afterImage}>(현재) {s.afterImage}</option>
                    )}
                    {catalog.map((c) => (
                      <option key={c.id} value={c.src}>{c.label}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────── 알림장 디자인 ───────────── */}
      <section className="rounded-lg border border-[#E8DCC9] bg-white p-4">
        <h2 className="text-sm font-semibold text-[#3D2E1F]">알림장 디자인 샘플</h2>
        <p className="mt-0.5 text-[11px] text-[#8B7355]">
          노출/순서와 표지(메인 슬라이드)를 실제 에디터 수준으로 편집합니다 — 레이아웃·디자인,
          제목 텍스트/폰트/색/크기/위치, 이름·날짜·인사말 박스까지. 본문(스토리·갤러리 등)은
          아래 &quot;공유 본문 템플릿&quot; 으로 일괄 관리합니다.
        </p>

        <div className="mt-4 space-y-3">
          {config.designs.map((d, i) => {
            const open = openId === d.id;
            const accent = THEME_PALETTES[d.colorTheme].accent;
            const heroOptions = byId.has(d.heroImageId)
              ? catalog
              : [{ id: d.heroImageId, label: d.heroImageId, src: srcOf(d.heroImageId) }, ...catalog];
            return (
              <div
                key={d.id}
                className={`overflow-hidden rounded-md border ${
                  d.enabled ? 'border-[#E8DCC9] bg-[#FCFAF6]' : 'border-[#EEE6D8] bg-[#F3EFE8]'
                }`}
              >
                {/* 헤더 — 작은 라이브 표지 썸네일 + 메타 */}
                <div className="flex flex-wrap items-center gap-3 p-3">
                  <div className="h-[64px] w-[34px] flex-shrink-0 overflow-hidden rounded border border-[#15110E]/80">
                    <div className="relative aspect-[9/18] w-full">
                      <InvitationPreview design={buildDesign(d, config.template)} cover />
                    </div>
                  </div>
                  <input
                    className={`${inputCls} min-w-[140px] flex-1 font-medium`}
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
                    <button type="button" onClick={() => moveDesign(i, -1)} disabled={i === 0} className="text-[11px] text-[#8B7355] disabled:opacity-30">▲</button>
                    <button type="button" onClick={() => moveDesign(i, 1)} disabled={i === config.designs.length - 1} className="text-[11px] text-[#8B7355] disabled:opacity-30">▼</button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : d.id)}
                    className="rounded-full border border-[#8B7355]/40 px-3 py-1 text-[11px] text-[#5C4633]"
                  >
                    {open ? '닫기' : '편집'}
                  </button>
                </div>

                {open && (
                  <div className="grid gap-4 border-t border-[#E8DCC9] p-3 lg:grid-cols-[180px_minmax(0,1fr)]">
                    {/* 라이브 미리보기 (큰 사이즈) */}
                    <div className="mx-auto w-[150px]">
                      <div className="overflow-hidden rounded-[20px] border-[6px] border-[#15110E] bg-white">
                        <div className="relative aspect-[9/18] w-full overflow-hidden">
                          <InvitationPreview design={buildDesign(d, config.template)} cover />
                        </div>
                      </div>
                      <p className="mt-1 text-center text-[10px] text-[#8B7355]">표지 미리보기</p>
                    </div>

                    {/* 컨트롤 — min-w-0 로 부모 grid 셀 안에 안전히 수렴 */}
                    <div className="min-w-0 space-y-4 overflow-hidden">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <Field label="레이아웃">
                          <select
                            className={inputCls}
                            value={normalizeLayout(d.main.layout)}
                            onChange={(e) => patchMain(i, { layout: e.target.value as MainLayout })}
                          >
                            {LAYOUT_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
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
                              <option key={c.id} value={c.id}>{c.label}</option>
                            ))}
                          </select>
                        </Field>
                        <Field label="폰트(본문)">
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
                        <Field label="태그(레이아웃 라벨)">
                          <input className={inputCls} value={d.layoutLabel} onChange={(e) => patchDesign(i, { layoutLabel: e.target.value })} />
                        </Field>
                        <Field label="신랑 이름">
                          <input className={inputCls} value={d.groomName} onChange={(e) => patchDesign(i, { groomName: e.target.value })} />
                        </Field>
                        <Field label="신부 이름">
                          <input className={inputCls} value={d.brideName} onChange={(e) => patchDesign(i, { brideName: e.target.value })} />
                        </Field>
                        <Field label="예식일 (YYYY-MM-DD)">
                          <input className={inputCls} value={d.weddingDate} onChange={(e) => patchDesign(i, { weddingDate: e.target.value })} placeholder="2026-05-23" />
                        </Field>
                      </div>

                      <div>
                        <span className={labelCls}>컬러 테마</span>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {COLOR_THEMES.map((t) => (
                            <ColorSwatch
                              key={t}
                              value={t}
                              selected={d.colorTheme === t}
                              onClick={() => patchDesign(i, { colorTheme: t as ColorTheme })}
                            />
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className={labelCls}>배경 효과</span>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {PETAL_TYPES.map((t) => {
                            const on = d.petalType === t;
                            return (
                              <button
                                key={t}
                                type="button"
                                onClick={() => patchDesign(i, { petalType: t as PetalType })}
                                aria-pressed={on}
                                title={t}
                                className={`grid h-9 w-9 place-items-center rounded-md border ${
                                  on ? 'border-[#3D2E1F] bg-[#FAF7F2]' : 'border-[#E8DCC9]'
                                }`}
                              >
                                <PetalIcon type={t} accent={accent} />
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 에디터 디자인 컨트롤 — 가로 넘침 방지 */}
                      <div className="max-w-full overflow-x-auto">
                        <DesignControls d={d} onMain={(patch) => patchMain(i, patch)} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ───────────── 공유 본문 템플릿 ───────────── */}
      <section className="rounded-lg border border-[#E8DCC9] bg-white p-4">
        <h2 className="text-sm font-semibold text-[#3D2E1F]">공유 본문 템플릿</h2>
        <p className="mt-0.5 text-[11px] text-[#8B7355]">
          12개 디자인 샘플이 모두 공유하는 본문(스토리·갤러리·퀴즈·투표·계좌·엔딩 등).
          여기서 바꾸면 모든 샘플에 즉시 반영됩니다.
        </p>

        <div className="mt-4 space-y-5">
          {/* 인사말 / 글귀 */}
          <div className="grid gap-3 lg:grid-cols-2">
            <Field label="기본 인사말(서약 톤)">
              <textarea
                rows={3}
                className={`${inputCls} font-normal`}
                value={config.template.basicGreeting}
                onChange={(e) => patchTpl({ basicGreeting: e.target.value })}
              />
            </Field>
            <Field label="기본 글귀(인용)">
              <input
                className={inputCls}
                value={config.template.basicQuote}
                onChange={(e) => patchTpl({ basicQuote: e.target.value })}
              />
            </Field>
          </div>

          {/* 스토리 */}
          <div>
            <span className={labelCls}>스토리 챕터 (최대 5)</span>
            <div className="mt-1.5 space-y-2">
              {config.template.storyChapters.map((ch, i) => (
                <div key={i} className="grid gap-2 rounded border border-[#E8DCC9] p-2 sm:grid-cols-[1fr_2fr_1fr]">
                  <input className={inputCls} placeholder="제목" value={ch.title} onChange={(e) => patchChapter(i, { title: e.target.value })} />
                  <input className={inputCls} placeholder="본문" value={ch.text} onChange={(e) => patchChapter(i, { text: e.target.value })} />
                  <select className={inputCls} value={ch.imageId} onChange={(e) => patchChapter(i, { imageId: e.target.value })}>
                    {!byId.has(ch.imageId) && ch.imageId && (
                      <option value={ch.imageId}>(현재) {ch.imageId}</option>
                    )}
                    {catalog.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* 갤러리 */}
          <div>
            <span className={labelCls}>갤러리 사진 ({config.template.galleryImageIds.length}장)</span>
            <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {config.template.galleryImageIds.map((id, i) => (
                <div key={i} className="rounded border border-[#E8DCC9] p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={srcOf(id)} alt={id} className="mb-1.5 h-[80px] w-full rounded object-cover" />
                  <select className={inputCls} value={id} onChange={(e) => setGalleryId(i, e.target.value)}>
                    {!byId.has(id) && (
                      <option value={id}>(현재) {id}</option>
                    )}
                    {catalog.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* 퀴즈 */}
          <div className="grid gap-2 rounded border border-[#E8DCC9] p-3">
            <span className={labelCls}>퀴즈 (4지선다)</span>
            <input className={inputCls} placeholder="질문" value={config.template.quizQuestion} onChange={(e) => patchTpl({ quizQuestion: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              {config.template.quizOptions.map((o, i) => (
                <label key={i} className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="quizAnswer"
                    checked={config.template.quizAnswer === i}
                    onChange={() => patchTpl({ quizAnswer: i })}
                  />
                  <input
                    className={inputCls}
                    placeholder={`보기 ${i + 1}`}
                    value={o}
                    onChange={(e) => setQuizOpt(i, e.target.value)}
                  />
                </label>
              ))}
            </div>
            <p className="text-[10px] text-[#8B7355]">왼쪽 라디오로 정답 보기를 선택하세요.</p>
          </div>

          {/* 투표 */}
          <div className="grid gap-2 rounded border border-[#E8DCC9] p-3">
            <span className={labelCls}>A/B 투표</span>
            <input className={inputCls} placeholder="질문" value={config.template.voteQuestion} onChange={(e) => patchTpl({ voteQuestion: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              {config.template.voteOptions.map((o, i) => (
                <input
                  key={i}
                  className={inputCls}
                  placeholder={i === 0 ? 'A' : 'B'}
                  value={o}
                  onChange={(e) => setVoteOpt(i, e.target.value)}
                />
              ))}
            </div>
          </div>

          {/* 방명록 / 계좌 / 엔딩 */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="방명록 안내 메시지">
              <input className={inputCls} value={config.template.guestbookMessage} onChange={(e) => patchTpl({ guestbookMessage: e.target.value })} />
            </Field>
            <Field label="엔딩 메시지">
              <input className={inputCls} value={config.template.closing} onChange={(e) => patchTpl({ closing: e.target.value })} />
            </Field>
            <Field label="계좌 안내 문구">
              <input className={inputCls} value={config.template.accountGuide} onChange={(e) => patchTpl({ accountGuide: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="신랑 은행">
                <input className={inputCls} value={config.template.accountGroomBank} onChange={(e) => patchTpl({ accountGroomBank: e.target.value })} />
              </Field>
              <Field label="신랑 계좌">
                <input className={inputCls} value={config.template.accountGroomNumber} onChange={(e) => patchTpl({ accountGroomNumber: e.target.value })} />
              </Field>
              <Field label="신부 은행">
                <input className={inputCls} value={config.template.accountBrideBank} onChange={(e) => patchTpl({ accountBrideBank: e.target.value })} />
              </Field>
              <Field label="신부 계좌">
                <input className={inputCls} value={config.template.accountBrideNumber} onChange={(e) => patchTpl({ accountBrideNumber: e.target.value })} />
              </Field>
            </div>
          </div>
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

/** 'polaroid' 레거시 레이아웃은 frame 으로 통합 표시. */
function normalizeLayout(layout: MainLayout): MainLayout {
  return layout === 'polaroid' ? 'frame' : layout;
}

/** 현재 레이아웃에 맞는 에디터 디자인 컨트롤을 렌더 (prop-driven 재사용). */
function DesignControls({
  d,
  onMain,
}: {
  d: DesignConfig;
  onMain: (patch: Partial<MainSection>) => void;
}) {
  const setGreeting = (greeting: string) => onMain({ greeting });
  const layout = d.main.layout;
  if (layout === 'poster') {
    return (
      <PosterDesignControls
        design={d.main.posterDesign}
        onChange={(posterDesign) => onMain({ posterDesign })}
        greeting={d.main.greeting}
        onGreetingChange={setGreeting}
      />
    );
  }
  if (layout === 'illustration') {
    return (
      <IllustrationDesignControls
        design={d.main.illustrationDesign}
        onChange={(illustrationDesign) => onMain({ illustrationDesign })}
        greeting={d.main.greeting}
        onGreetingChange={setGreeting}
      />
    );
  }
  if (layout === 'text') {
    return (
      <TextDesignControls
        design={d.main.textDesign}
        onChange={(textDesign) => onMain({ textDesign })}
        greeting={d.main.greeting}
        onGreetingChange={setGreeting}
      />
    );
  }
  return (
    <FrameDesignControls
      design={d.main.frameDesign}
      onChange={(frameDesign) => onMain({ frameDesign })}
      greeting={d.main.greeting}
      onGreetingChange={setGreeting}
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className={labelCls}>{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
