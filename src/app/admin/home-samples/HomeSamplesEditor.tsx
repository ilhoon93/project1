'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import {
  COLOR_THEMES,
  COLOR_THEME_LABELS,
  PETAL_TYPES,
  PETAL_LABELS,
  AVAILABLE_FONT_KEYS,
  FONT_OPTIONS,
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
import {
  Combobox,
  ColorSwatchSm,
  PetalIcon,
} from '@/components/editor/sections/ThemeEditor';
import {
  buildDesign,
  deriveSampleLayoutLabel,
  deriveSampleName,
  type BeforeAfterConfig,
  type BeforeAfterStyle,
  type DesignConfig,
  type HomeSamplesConfig,
  type TemplateChapter,
  type TemplateConfig,
} from '@/lib/marketing/sample-invitations';
import { InvitationPreview } from '@/components/marketing/InvitationPreview';
import { PresetTextArea } from '@/components/editor/PresetTextArea';
import {
  BASIC_GREETING_PRESETS,
  QUOTE_PRESETS,
  GUESTBOOK_GREETING_PRESETS,
  ACCOUNT_GUIDE_PRESETS,
  CLOSING_PRESETS,
} from '@/lib/presets';
import { saveHomeSamplesAction, uploadBeforeAfterAfterImage } from './actions';

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

/** config 저장 공통 훅 — 두 에디터(알림장/AI스냅)가 같은 전체 config 를 저장하되
 *  각자 자기 슬라이스만 편집한다. 저장 시 편집 안 한 슬라이스는 로드된 값 그대로 보존. */
function useHomeSamplesSaver(initialConfig: HomeSamplesConfig) {
  const [config, setConfig] = useState<HomeSamplesConfig>(initialConfig);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const save = (next: HomeSamplesConfig) => {
    setMsg(null);
    startTransition(async () => {
      const res = await saveHomeSamplesAction(next);
      if (res.ok) setConfig(next);
      setMsg(res.ok ? '저장됐습니다.' : `저장 실패: ${res.error ?? '알 수 없음'}`);
    });
  };
  return { config, setConfig, pending, msg, save };
}

function SaveBar({
  pending,
  msg,
  onSave,
}: {
  pending: boolean;
  msg: string | null;
  onSave: () => void;
}) {
  return (
    <div className="sticky bottom-0 flex items-center gap-3 border-t border-[#E8DCC9] bg-[#FAF7F2]/95 py-3 backdrop-blur">
      <button
        type="button"
        onClick={onSave}
        disabled={pending}
        className="rounded-full bg-[#3D2E1F] px-5 py-2 text-[13px] font-medium text-white disabled:opacity-50"
      >
        {pending ? '저장 중…' : '저장'}
      </button>
      {msg && <span className="text-[12px] text-[#5C4633]">{msg}</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 알림장 디자인 샘플 에디터 — 디자인 카드 + 공유 본문 템플릿
// ─────────────────────────────────────────────────────────────

export function InvitationSamplesEditor({
  initialConfig,
  catalog,
}: {
  initialConfig: HomeSamplesConfig;
  catalog: CatalogItem[];
}) {
  const { config, setConfig, pending, msg, save } = useHomeSamplesSaver(initialConfig);
  const [openId, setOpenId] = useState<string | null>(null);

  const byId = useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog]);
  const srcOf = (id: string) => byId.get(id)?.src ?? `/wedding-snap/catalog/${id}.jpg`;

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

  const handleSave = () => {
    // 저장 시점에 layoutLabel 을 현재 데이터 기준으로 자동 재계산.
    save({
      ...config,
      // name 과 layoutLabel 모두 현재 데이터(컬러/레이아웃/배경효과) 기준으로
      // 자동 stamping — 운영자가 수동으로 안 입력해도 일관된 라벨이 DB 에 보장됨.
      designs: config.designs.map((d) => ({
        ...d,
        name: deriveSampleName(d),
        layoutLabel: deriveSampleLayoutLabel(d),
      })),
    });
  };

  return (
    <div className="space-y-8">
      {/* ───────────── 알림장 디자인 ───────────── */}
      <section className="rounded-lg border border-[#E8DCC9] bg-white p-4">
        <h2 className="text-sm font-semibold text-[#3D2E1F]">알림장 디자인 샘플</h2>
        <p className="mt-0.5 text-[11px] text-[#8B7355]">
          노출/순서와 표지(메인 슬라이드)를 실제 에디터 수준으로 편집합니다 — 레이아웃·디자인,
          제목 텍스트/폰트/색/크기/위치, 이름·날짜·인사말 박스까지. 본문(스토리·갤러리 등)은
          아래 &quot;공유 본문 템플릿&quot; 으로 일괄 관리합니다.
        </p>

        {/* 디자인 카드 그리드 — md 2열, xl 3열로 빈 공간 줄임. 카드 클릭으로 펼쳐서
            상세 편집. 펼친 카드는 grid 안에서 그대로 확장 (col-span-full). */}
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                  open ? 'md:col-span-2 xl:col-span-3' : ''
                } ${
                  d.enabled ? 'border-[#E8DCC9] bg-[#FCFAF6]' : 'border-[#EEE6D8] bg-[#F3EFE8]'
                }`}
              >
                {/* 헤더 — 작은 라이브 표지 썸네일 + 메타 */}
                <div className="flex flex-wrap items-center gap-3 p-3">
                  <div className="h-[64px] w-[34px] flex-shrink-0 overflow-hidden rounded border border-[#15110E]/80">
                    <div className="relative aspect-[1/2] w-full">
                      <InvitationPreview design={buildDesign(d, config.template)} cover />
                    </div>
                  </div>
                  {/* 디자인 이름은 입력란 없이 컬러+레이아웃 기반으로 자동 — 컬러/레이아웃을
                      바꾸면 즉시 이 이름이 갱신되고, 저장 시점에 DB에도 stamping 된다. */}
                  <div className="min-w-[120px] flex-1 truncate">
                    <span className="text-[13px] font-medium text-[#3D2E1F]">
                      {deriveSampleName(d)}
                    </span>
                    <span className="ml-2 text-[10px] text-[#8B7355]">자동</span>
                  </div>
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
                  <div className="grid gap-4 border-t border-[#E8DCC9] p-4 lg:grid-cols-[260px_minmax(0,1fr)]">
                    {/* 좌: 큰 표지 미리보기 + (하단) 이름/날짜/표지사진 */}
                    <div className="mx-auto w-full max-w-[260px]">
                      <div className="overflow-hidden rounded-[18px] border-[2px] border-[#15110E] bg-[#15110E]">
                        <div className="relative aspect-[1/2] w-full overflow-hidden">
                          <InvitationPreview design={buildDesign(d, config.template)} cover />
                        </div>
                      </div>
                      <p className="mt-2 text-center text-[10px] text-[#8B7355]">표지 미리보기</p>

                      {/* 미리보기 하단의 데이터 입력 — 신랑/신부/날짜/표지사진 */}
                      <div className="mt-4 grid grid-cols-2 gap-2">
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
                        <Field label="표지 사진">
                          <select
                            className={inputCls}
                            value={d.heroImageId}
                            onChange={(e) => patchDesign(i, { heroImageId: e.target.value })}
                          >
                            {heroOptions.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                      <p className="mt-2 text-center text-[10px] text-[#8B7355]">
                        태그는 저장 시점에{' '}
                        <span className="font-medium text-[#5C4633]">{deriveSampleLayoutLabel(d)}</span>{' '}
                        로 자동 지정됩니다.
                      </p>
                    </div>

                    {/* 우: 레이아웃/색상/배경효과/폰트 + 표지 디자인 컨트롤 */}
                    <div className="min-w-0 space-y-4 overflow-hidden">
                      {/* 레이아웃 + 컬러 + 효과 + 폰트 — 에디터 형식의 콤보박스 */}
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Field label="레이아웃">
                          <Combobox<MainLayout>
                            options={LAYOUT_OPTIONS.map((o) => o.value)}
                            value={normalizeLayout(d.main.layout)}
                            onChange={(layout) => patchMain(i, { layout })}
                            renderItem={(v) => (
                              <span>
                                {LAYOUT_OPTIONS.find((o) => o.value === v)?.label ?? v}
                              </span>
                            )}
                          />
                        </Field>
                        <Field label="컬러 테마">
                          <Combobox<ColorTheme>
                            options={COLOR_THEMES}
                            value={d.colorTheme}
                            onChange={(colorTheme) => patchDesign(i, { colorTheme })}
                            renderItem={(t) => (
                              <>
                                <ColorSwatchSm value={t} />
                                <span>{COLOR_THEME_LABELS[t]}</span>
                              </>
                            )}
                          />
                        </Field>
                        <Field label="배경 효과">
                          <Combobox<PetalType>
                            options={PETAL_TYPES}
                            value={d.petalType}
                            onChange={(petalType) => patchDesign(i, { petalType })}
                            renderItem={(t) => (
                              <>
                                <span className="inline-flex h-5 w-5 items-center justify-center">
                                  <PetalIcon type={t} accent={accent} />
                                </span>
                                <span>{PETAL_LABELS[t]}</span>
                              </>
                            )}
                          />
                        </Field>
                        <Field label="폰트(본문)">
                          <Combobox<FontKey>
                            options={AVAILABLE_FONT_KEYS}
                            value={d.font}
                            onChange={(font) => patchDesign(i, { font })}
                            renderItem={(f) => (
                              <span
                                className="truncate"
                                style={{ fontFamily: FONT_OPTIONS[f].family }}
                              >
                                {FONT_OPTIONS[f].label}
                              </span>
                            )}
                          />
                        </Field>
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
          모든 디자인 샘플이 공유하는 본문(스토리·갤러리·퀴즈·투표·계좌·엔딩 등).
          여기서 바꾸면 모든 샘플에 즉시 반영됩니다.
        </p>

        <div className="mt-4 space-y-5">
          {/* 인사말 / 글귀 — 실제 에디터와 동일한 길이·줄바꿈·추천문구. */}
          <div className="grid gap-4 lg:grid-cols-2">
            <PresetTextArea
              label="기본 인사말(서약 톤)"
              value={config.template.basicGreeting}
              onChange={(v) => patchTpl({ basicGreeting: v })}
              presets={BASIC_GREETING_PRESETS}
              presetLabel="추천 인사말"
              maxLength={500}
              rows={4}
              placeholder="저희 두 사람의 새로운 시작을 함께 축복해 주세요"
            />
            <PresetTextArea
              label="기본 글귀(인용)"
              value={config.template.basicQuote}
              onChange={(v) => patchTpl({ basicQuote: v })}
              presets={QUOTE_PRESETS}
              presetLabel="추천 글귀"
              maxLength={200}
              rows={2}
              placeholder="사랑은 함께 같은 곳을 바라보는 것"
            />
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

          {/* 영상 — 제목 + URL. URL 비우면 영상 슬라이드 미노출. */}
          <div className="grid gap-2 rounded border border-[#E8DCC9] p-3">
            <span className={labelCls}>영상 슬라이드</span>
            <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
              <input
                className={inputCls}
                placeholder="영상 제목 (예: 우리의 프러포즈 영상)"
                maxLength={50}
                value={config.template.videoTitle}
                onChange={(e) => patchTpl({ videoTitle: e.target.value })}
              />
              <input
                className={inputCls}
                placeholder="YouTube/Vimeo URL (비우면 영상 슬라이드 숨김)"
                value={config.template.videoUrl}
                onChange={(e) => patchTpl({ videoUrl: e.target.value })}
              />
            </div>
            <p className="text-[10px] text-[#8B7355]">
              YouTube · Vimeo · Shorts 링크 또는 자체 호스팅 mp4 URL. 비우면 모든 샘플에서 영상 슬라이드가 숨겨집니다.
            </p>
          </div>

          {/* 방명록 / 계좌 / 엔딩 — 실제 에디터와 동일한 길이·줄바꿈·추천문구. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <PresetTextArea
              label="방명록 안내 메시지"
              value={config.template.guestbookMessage}
              onChange={(v) => patchTpl({ guestbookMessage: v })}
              presets={GUESTBOOK_GREETING_PRESETS}
              presetLabel="추천 인사말"
              maxLength={300}
              rows={3}
              placeholder="축하 한마디와 서명을 남겨주세요!"
            />
            <PresetTextArea
              label="엔딩 메시지"
              value={config.template.closing}
              onChange={(v) => patchTpl({ closing: v })}
              presets={CLOSING_PRESETS}
              presetLabel="추천 인사말"
              maxLength={300}
              rows={3}
              placeholder="와주셔서 진심으로 감사합니다"
            />
            <PresetTextArea
              className="sm:col-span-2"
              label="계좌 안내 문구"
              value={config.template.accountGuide}
              onChange={(v) => patchTpl({ accountGuide: v })}
              presets={ACCOUNT_GUIDE_PRESETS}
              presetLabel="추천 안내문구"
              maxLength={500}
              rows={3}
              placeholder="축하의 마음을 담아 마음 전하실 분들을 위해 계좌번호를 안내드립니다."
            />
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

      <SaveBar pending={pending} msg={msg} onSave={handleSave} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AI 스냅 샘플 에디터 — 폴라로이드/스트립 + Before/After
// ─────────────────────────────────────────────────────────────

export function SnapSamplesEditor({
  initialConfig,
  catalog,
}: {
  initialConfig: HomeSamplesConfig;
  catalog: CatalogItem[];
}) {
  const { config, setConfig, pending, msg, save } = useHomeSamplesSaver(initialConfig);

  const byId = useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog]);
  const srcOf = (id: string) => byId.get(id)?.src ?? `/wedding-snap/catalog/${id}.jpg`;

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

  const setBA = (next: BeforeAfterConfig) =>
    setConfig((c) => ({ ...c, beforeAfter: next }));
  const patchStyle = (i: number, patch: Partial<BeforeAfterStyle>) =>
    setBA({
      ...config.beforeAfter,
      styles: config.beforeAfter.styles.map((s, k) =>
        k === i ? { ...s, ...patch } : s,
      ),
    });

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
          왼쪽 슬라이더의 Before 사진(입력 샘플)과, 각 스타일 탭의 After 사진을
          설정합니다. 스타일은 카탈로그에서 고르면 탭 라벨/After 라벨이 자동
          채워지고, After 사진은 그 입력에 카탈로그를 적용한 실제 결과물을
          업로드합니다.
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
            <BeforeAfterStyleEditor
              key={`${s.id}-${i}`}
              style={s}
              index={i}
              catalog={catalog}
              byId={byId}
              onPatch={(patch) => patchStyle(i, patch)}
            />
          ))}
        </div>
      </section>

      <SaveBar pending={pending} msg={msg} onSave={() => save(config)} />
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

/**
 * Before/After 스타일 한 칸 — 카탈로그 스타일 선택(라벨 자동 채움) + 결과 사진
 * 파일 업로드. id 는 영문 식별자(사용자 변경 자유), styleCatalogId 는 카탈로그
 * 컷의 식별자(label 자동 도출).
 */
function BeforeAfterStyleEditor({
  style,
  index,
  catalog,
  byId,
  onPatch,
}: {
  style: BeforeAfterStyle;
  index: number;
  catalog: CatalogItem[];
  byId: Map<string, CatalogItem>;
  onPatch: (patch: Partial<BeforeAfterStyle>) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const styleCatalogId = style.styleCatalogId ?? style.id;
  const catalogItem = byId.get(styleCatalogId);

  const handleCatalogPick = (id: string) => {
    const item = byId.get(id);
    onPatch({
      styleCatalogId: id,
      // 라벨/After 라벨 자동 채움 — 운영자가 추가 수정 가능.
      label: item?.label ?? id,
      afterLabel: item ? `AI · ${item.label}` : style.afterLabel,
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadErr(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('styleId', style.id || styleCatalogId);
      const res = await uploadBeforeAfterAfterImage(fd);
      if (!res.ok) {
        setUploadErr(res.error);
        return;
      }
      onPatch({ afterImage: res.url });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="rounded-md border border-[#E8DCC9] bg-[#FCFAF6] p-3">
      <div className="mb-2 flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={style.afterImage || '/wedding-snap/mode-examples/couple-input-1.jpg'}
          alt={style.label}
          className="h-[48px] w-[72px] flex-shrink-0 rounded bg-[#EFE6DC] object-cover"
        />
        <span className="text-[10px] uppercase tracking-wide text-[#8B7355]">
          스타일 {index + 1}
        </span>
      </div>

      <Field label="카탈로그 스타일 (탭/After 라벨 자동)">
        <select
          className={inputCls}
          value={styleCatalogId}
          onChange={(e) => handleCatalogPick(e.target.value)}
        >
          {!catalogItem && styleCatalogId && (
            <option value={styleCatalogId}>(현재) {styleCatalogId}</option>
          )}
          {catalog.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </Field>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <Field label="id (영문)">
          <input
            className={inputCls}
            value={style.id}
            onChange={(e) => onPatch({ id: e.target.value })}
          />
        </Field>
        <Field label="탭 라벨 (자동 — 수정 가능)">
          <input
            className={inputCls}
            value={style.label}
            onChange={(e) => onPatch({ label: e.target.value })}
          />
        </Field>
        <Field label="After 라벨 (자동 — 수정 가능)">
          <input
            className={inputCls}
            value={style.afterLabel}
            onChange={(e) => onPatch({ afterLabel: e.target.value })}
          />
        </Field>
        <Field label="After 사진 (업로드)">
          <div className="flex flex-col gap-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => void handleFileChange(e)}
              disabled={uploading}
              className="block w-full text-[11px] file:mr-2 file:rounded file:border-0 file:bg-[#3D2E1F] file:px-2 file:py-1 file:text-[11px] file:text-white file:hover:bg-[#5C4633]"
            />
            {uploading && <span className="text-[10px] text-[#8B7355]">업로드 중…</span>}
            {uploadErr && <span className="text-[10px] text-[#B5614F]">{uploadErr}</span>}
            {style.afterImage && !uploading && (
              <span className="truncate text-[10px] text-[#8B7355]" title={style.afterImage}>
                {style.afterImage.split('/').pop()}
              </span>
            )}
          </div>
        </Field>
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-[#8B7355]">
        Before 입력 사진에 위 카탈로그 스타일을 적용한{' '}
        <strong className="text-[#3D2E1F]">실제 생성 결과물</strong>을 업로드하세요.
        JPG/PNG/WEBP · 최대 8MB.
      </p>
    </div>
  );
}
