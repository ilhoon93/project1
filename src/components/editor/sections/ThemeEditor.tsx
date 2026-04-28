'use client';

import { useEditorStore } from '@/stores/editor';
import {
  COLOR_THEMES,
  COLOR_THEME_LABELS,
  FONT_KEYS,
  FONT_OPTIONS,
  PETAL_GLYPHS,
  PETAL_LABELS,
  PETAL_TYPES,
  SECTION_LABELS,
  THEME_PALETTES,
  reconcilePageOrder,
  type ColorTheme,
  type SectionKey,
} from '@/lib/theme';
import { SectionEditor } from '../SectionEditor';

export function ThemeEditor() {
  const content = useEditorStore((s) => s.content);
  const patch = useEditorStore((s) => s.patchSection);
  // Guard against stale persisted state from before the theme field existed.
  // EditorClient.init() will overwrite with parsed server data on mount.
  if (!content || !content.theme) return null;
  const theme = content.theme;

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
        {/* 색상 */}
        <Field label="색상">
          <div className="flex flex-wrap gap-2">
            {COLOR_THEMES.map((c) => (
              <ColorSwatch
                key={c}
                value={c}
                selected={theme.colorTheme === c}
                onClick={() => setTheme({ ...theme, colorTheme: c })}
              />
            ))}
          </div>
        </Field>

        {/* 떨어지는 효과 */}
        <Field label="배경 효과">
          <div className="flex flex-wrap gap-2">
            {PETAL_TYPES.map((t) => (
              <Choice
                key={t}
                selected={theme.petalType === t}
                onClick={() => setTheme({ ...theme, petalType: t })}
              >
                <span className="text-base">{PETAL_GLYPHS[t] || '∅'}</span>
                <span>{PETAL_LABELS[t]}</span>
              </Choice>
            ))}
          </div>
        </Field>

        {/* 폰트 */}
        <Field label="폰트">
          <div className="flex flex-wrap gap-2">
            {FONT_KEYS.map((f) => (
              <Choice
                key={f}
                selected={theme.font === f}
                onClick={() => setTheme({ ...theme, font: f })}
                style={{ fontFamily: FONT_OPTIONS[f].family }}
              >
                {FONT_OPTIONS[f].label}
              </Choice>
            ))}
          </div>
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
      </div>
    </SectionEditor>
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

function ColorSwatch({
  value,
  selected,
  onClick,
}: {
  value: ColorTheme;
  selected: boolean;
  onClick: () => void;
}) {
  const palette = THEME_PALETTES[value];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={COLOR_THEME_LABELS[value]}
      className={`relative h-12 w-12 overflow-hidden rounded-full border-2 transition-all ${
        selected ? 'border-foreground scale-110' : 'border-transparent'
      }`}
      style={{ backgroundColor: palette.bg }}
    >
      <span
        className="absolute bottom-0 left-0 h-1/2 w-full"
        style={{ backgroundColor: palette.accent }}
      />
    </button>
  );
}

function Choice({
  selected,
  onClick,
  children,
  style,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${
        selected
          ? 'border-foreground bg-foreground text-background'
          : 'border-input bg-background text-foreground hover:bg-muted'
      }`}
      style={style}
    >
      {children}
    </button>
  );
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

