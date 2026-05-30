'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useEditorStore } from '@/stores/editor';
import { createClient } from '@/lib/supabase/client';
import { nanoid } from '@/lib/utils/nanoid';
import {
  AVAILABLE_FONT_KEYS,
  COLOR_THEMES,
  COLOR_THEME_LABELS,
  FONT_OPTIONS,
  PETAL_GLYPHS,
  PETAL_IS_TEXTURE,
  PETAL_LABELS,
  PETAL_TYPES,
  SECTION_LABELS,
  THEME_PALETTES,
  reconcilePageOrder,
  type ColorTheme,
  type PetalType,
  type SectionKey,
} from '@/lib/theme';
import { PetalShape } from '@/components/shared/FallingPetals';
import { Button } from '@/components/ui/button';
import { SectionEditor } from '../SectionEditor';
import { TextField } from '../form-fields';
import { AUDIO_LIMITS, formatBytes } from '@/lib/uploads';

export function ThemeEditor() {
  const content = useEditorStore((s) => s.content);
  const invitationId = useEditorStore((s) => s.invitationId);
  const patch = useEditorStore((s) => s.patchSection);
  // Guard against stale persisted state from before the theme field existed.
  // EditorClient.init() will overwrite with parsed server data on mount.
  if (!content || !content.theme || !invitationId) return null;
  const theme = content.theme;
  const bgm = theme.bgm ?? { enabled: false, url: null };

  const setTheme = (next: typeof theme) => patch('theme', next);
  const order = reconcilePageOrder(theme.pageOrder);

  const moveSection = (key: SectionKey, dir: -1 | 1) => {
    const i = order.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    const nextOrder = [...order];
    [nextOrder[i], nextOrder[j]] = [nextOrder[j], nextOrder[i]];
    setTheme({ ...theme, pageOrder: nextOrder });
  };

  return (
    <SectionEditor title="디자인" description="색상, 효과, 폰트, 페이지 순서">
      <div className="flex flex-col gap-5">
        {/* 색상 — 콤보박스: 트리거에 현재 스와치+이름, 드롭다운에 전체 목록. */}
        <Field label="색상">
          <Combobox
            options={COLOR_THEMES}
            value={theme.colorTheme}
            onChange={(c) => setTheme({ ...theme, colorTheme: c })}
            renderItem={(c) => (
              <>
                <ColorSwatchSm value={c} />
                <span>{COLOR_THEME_LABELS[c]}</span>
              </>
            )}
          />
        </Field>

        {/* 배경 효과 — 콤보박스: 트리거/드롭다운에 아이콘 + 이름.
            picker 아이콘 색은 실제 알림장에서 보이는 색과 일치시키기 위해
            테마 petals[0] 을 우선 쓰고, 그 외엔 accent 폴백. */}
        <Field label="배경 효과" hint="2D 글리프 또는 질감(텍스처) 효과를 고르세요">
          <Combobox
            options={PETAL_TYPES}
            value={theme.petalType}
            onChange={(t) => setTheme({ ...theme, petalType: t })}
            renderItem={(t) => {
              const pal = THEME_PALETTES[theme.colorTheme];
              const iconColor = pal.petals[0] ?? pal.accent;
              return (
                <>
                  <span className="inline-flex h-5 w-5 items-center justify-center">
                    <PetalIcon type={t} accent={iconColor} />
                  </span>
                  <span>{PETAL_LABELS[t]}</span>
                </>
              );
            }}
          />
        </Field>

        {/* 폰트 — 콤보박스: 각 옵션을 그 폰트로 렌더해 실제 모양 확인. */}
        <Field label="폰트">
          <Combobox
            options={AVAILABLE_FONT_KEYS}
            value={theme.font}
            onChange={(f) => setTheme({ ...theme, font: f })}
            renderItem={(f) => (
              <span style={{ fontFamily: FONT_OPTIONS[f].family }}>
                {FONT_OPTIONS[f].label} · 우리 결혼해요
              </span>
            )}
          />
        </Field>

        {/* 페이지 순서 */}
        <Field label="페이지 순서" hint="↑ ↓ 버튼으로 순서를 바꿀 수 있어요">
          <ul className="flex flex-col gap-1.5">
            {order.map((key, i) => (
              <li
                key={key}
                className="flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  <span className="w-5 text-xs text-muted-foreground">{i + 1}</span>
                  <span>{SECTION_LABELS[key]}</span>
                </span>
                <span className="flex gap-1">
                  <ArrowButton
                    label={`${SECTION_LABELS[key]} 위로`}
                    disabled={i === 0}
                    onClick={() => moveSection(key, -1)}
                  >
                    ↑
                  </ArrowButton>
                  <ArrowButton
                    label={`${SECTION_LABELS[key]} 아래로`}
                    disabled={i === order.length - 1}
                    onClick={() => moveSection(key, 1)}
                  >
                    ↓
                  </ArrowButton>
                </span>
              </li>
            ))}
          </ul>
        </Field>

        {/* 배경 음악 */}
        <BgmField
          invitationId={invitationId}
          enabled={bgm.enabled}
          url={bgm.url}
          onChange={(next) => setTheme({ ...theme, bgm: next })}
        />
      </div>
    </SectionEditor>
  );
}

function BgmField({
  invitationId,
  enabled,
  url,
  onChange,
}: {
  invitationId: string;
  enabled: boolean;
  url: string | null;
  onChange: (next: { enabled: boolean; url: string | null }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setErrorMsg(null);
    if (!AUDIO_LIMITS.acceptMime.includes(file.type as (typeof AUDIO_LIMITS.acceptMime)[number])) {
      setErrorMsg(`${AUDIO_LIMITS.acceptExtLabel} 형식만 지원됩니다.`);
      return;
    }
    if (file.size > AUDIO_LIMITS.maxBytes) {
      setErrorMsg(`음악 파일은 ${formatBytes(AUDIO_LIMITS.maxBytes)} 이하여야 합니다.`);
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop()?.toLowerCase() || 'mp3';
      const path = `invitations/${invitationId}/bgm/${nanoid(10)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('public-images')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        setErrorMsg(`업로드 실패: ${upErr.message}`);
        return;
      }
      const { data } = supabase.storage.from('public-images').getPublicUrl(path);
      if (data?.publicUrl) {
        onChange({ enabled: true, url: data.publicUrl });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Field
      label="배경 음악"
      hint="브라우저 정책상 첫 화면 터치 후에 자동으로 재생되며, 우측 상단 버튼으로 끄거나 켤 수 있습니다."
    >
      <div className="flex flex-col gap-2 rounded-md border bg-background p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">사용 여부</span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="배경 음악 사용 여부"
            onClick={() => onChange({ enabled: !enabled, url })}
            className={`inline-flex h-5 w-9 shrink-0 items-center overflow-hidden rounded-full p-0.5 transition-colors ${
              enabled ? 'bg-primary' : 'bg-muted-foreground/30'
            }`}
          >
            <span
              className={`block h-4 w-4 rounded-full bg-background shadow-sm transition-transform ${
                enabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {enabled && (
          <>
            <TextField
              label="음악 URL (직접 입력)"
              type="url"
              value={url ?? ''}
              placeholder="https://example.com/song.mp3"
              onChange={(e) => onChange({ enabled, url: e.target.value || null })}
              hint="MP3 등 외부 URL을 붙여넣을 수 있습니다"
            />

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">또는 직접 업로드</span>
              <input
                ref={inputRef}
                type="file"
                accept={AUDIO_LIMITS.acceptMime.join(',')}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                  e.target.value = '';
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
                className="self-start"
              >
                {busy ? '업로드 중...' : '음악 파일 선택'}
              </Button>
              <p className="text-xs text-muted-foreground">
                MP3 · M4A · AAC · WAV · OGG, 최대 15MB
              </p>
            </div>

            {url && (
              <div className="flex items-center gap-2">
                <audio src={url} controls className="h-9 w-full" preload="metadata" />
                <button
                  type="button"
                  onClick={() => onChange({ enabled, url: null })}
                  className="text-xs text-destructive hover:underline"
                >
                  제거
                </button>
              </div>
            )}

            {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}
          </>
        )}
      </div>
    </Field>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

/**
 * 콤보박스 — 트리거 + 드롭다운 옵션 리스트.
 * 트리거에 선택된 옵션의 renderItem 결과를 그대로 표시, 드롭다운에는
 * 전체 옵션을 같은 renderItem 으로 표시. 바깥 클릭/Escape 시 닫힘.
 */
function Combobox<T extends string>({
  options,
  value,
  onChange,
  renderItem,
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  renderItem: (v: T) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors hover:bg-muted"
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {renderItem(value)}
        </span>
        <ChevronDown
          size={14}
          className={`flex-shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-[280px] overflow-y-auto rounded-md border border-input bg-background shadow-lg"
        >
          {options.map((opt) => {
            const selected = opt === value;
            return (
              <button
                key={opt}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                  selected ? 'bg-muted font-medium' : 'hover:bg-muted/50'
                }`}
              >
                {renderItem(opt)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** 콤보박스 트리거/옵션 안에 들어가는 작은 색 스와치. */
function ColorSwatchSm({ value }: { value: ColorTheme }) {
  const palette = THEME_PALETTES[value];
  const hasPattern = !!palette.bgPattern;
  return (
    <span
      aria-hidden
      className="relative inline-block h-5 w-5 flex-shrink-0 overflow-hidden rounded-full border border-input"
      style={{
        backgroundColor: palette.bg,
        backgroundImage: palette.bgPattern,
        backgroundRepeat: hasPattern ? 'repeat' : undefined,
      }}
    >
      <span
        className="absolute bottom-0 left-0 h-1/2 w-full"
        style={{ backgroundColor: palette.accent, opacity: hasPattern ? 0.85 : 1 }}
      />
    </span>
  );
}

export function ColorSwatch({
  value,
  selected,
  onClick,
}: {
  value: ColorTheme;
  selected: boolean;
  onClick: () => void;
}) {
  const palette = THEME_PALETTES[value];
  const hasPattern = !!palette.bgPattern;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={COLOR_THEME_LABELS[value]}
      title={COLOR_THEME_LABELS[value]}
      className={`relative h-12 w-12 overflow-hidden rounded-full border-2 transition-all ${
        selected ? 'border-foreground scale-110' : 'border-transparent'
      }`}
      style={{
        backgroundColor: palette.bg,
        backgroundImage: palette.bgPattern,
        backgroundRepeat: hasPattern ? 'repeat' : undefined,
      }}
    >
      <span
        className="absolute bottom-0 left-0 h-1/2 w-full"
        style={{ backgroundColor: palette.accent, opacity: hasPattern ? 0.85 : 1 }}
      />
    </button>
  );
}

/**
 * Inline preview for the petal-effect picker. Glyph types render the unicode
 * glyph; texture types render the same SVG used by the falling animation so
 * the picker matches what guests will actually see.
 */
export function PetalIcon({ type, accent }: { type: PetalType; accent: string }) {
  if (type === 'none') {
    return <span className="text-base text-muted-foreground">∅</span>;
  }
  // 별빛 — 작은 별 + 트레일로 정적 미리보기 (실제 효과는 별똥별 + 트윙클).
  if (type === 'starlight') {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center align-middle text-base leading-none" style={{ color: accent }}>
        ✦
      </span>
    );
  }
  // 보케 — 큰 블러 원 미리보기. radial-gradient + blur 로 실제 효과 톤 일치.
  if (type === 'bokeh') {
    return (
      <span
        className="inline-block h-4 w-4 rounded-full align-middle"
        style={{
          background: `radial-gradient(circle, ${accent} 0%, transparent 75%)`,
          filter: 'blur(2px)',
          opacity: 0.85,
        }}
      />
    );
  }
  if (PETAL_IS_TEXTURE[type]) {
    return (
      <span className="inline-block h-5 w-5 align-middle">
        <PetalShape type={type} color={accent} />
      </span>
    );
  }
  return <span className="text-base">{PETAL_GLYPHS[type]}</span>;
}


function ArrowButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded border border-input bg-background text-sm text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}

