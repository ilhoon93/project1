'use client';

import { MAIN_LAYOUTS, type PosterDesign } from '@/types/invitation';
import { useEditorStore } from '@/stores/editor';
import {
  TITLE_FONT_KEYS,
  TITLE_FONT_OPTIONS,
  TITLE_TEXT_PRESETS,
} from '@/lib/theme';
import { SectionEditor } from '../SectionEditor';
import { TextAreaField } from '../form-fields';
import { ImageUploader } from '../ImageUploader';

const LAYOUT_LABELS: Record<(typeof MAIN_LAYOUTS)[number], { name: string; hint: string }> = {
  poster: { name: '풀이미지형', hint: '풀이미지 배경' },
  polaroid: { name: '폴라로이드', hint: '액자 프레임' },
  illustration: { name: '일러스트', hint: '신랑신부 그림' },
  text: { name: '텍스트', hint: '이미지 없이' },
};

const TITLE_COLOR_PRESETS = ['#FFFFFF', '#000000', '#3D2E1F', '#5C2A2E', '#2D4A33', '#1A2238'];

export function MainEditor() {
  const main = useEditorStore((s) => s.content?.main);
  const invitationId = useEditorStore((s) => s.invitationId);
  const patch = useEditorStore((s) => s.patchSection);
  if (!main || !invitationId) return null;

  const layout = main.layout ?? 'poster';
  const showImagePicker = layout !== 'text' && layout !== 'illustration';
  const isPoster = layout === 'poster';
  const design = main.posterDesign;

  const patchDesign = (next: PosterDesign) => patch('main', { ...main, posterDesign: next });

  return (
    <SectionEditor title="메인 화면" description="첫 슬라이드의 레이아웃과 인사말">
      <div className="flex flex-col gap-4">
        {/* 레이아웃 선택 */}
        <div className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-foreground">레이아웃</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MAIN_LAYOUTS.map((key) => {
              const selected = layout === key;
              const meta = LAYOUT_LABELS[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => patch('main', { ...main, layout: key })}
                  aria-pressed={selected}
                  className={`flex flex-col items-center gap-1 rounded-md border px-2 py-3 text-xs transition-colors ${
                    selected
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-input bg-background text-foreground hover:bg-muted'
                  }`}
                >
                  <span className="font-medium">{meta.name}</span>
                  <span className={selected ? 'opacity-80' : 'text-muted-foreground'}>
                    {meta.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {showImagePicker && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">메인 사진</span>
            <ImageUploader
              value={main.heroImage ?? null}
              onChange={(url) => patch('main', { ...main, heroImage: url })}
              invitationId={invitationId}
              folder="main"
              previewAspect="aspect-[3/4]"
              label="사진 선택하기"
            />
            {isPoster && (
              <div className="rounded-md border border-dashed border-input bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                <p className="mb-1 font-medium text-foreground">권장 이미지 규격</p>
                <ul className="list-disc space-y-0.5 pl-4">
                  <li>해상도: <strong>1080 × 1920 px</strong> (9:16 세로형)</li>
                  <li>형식: JPG · PNG · WEBP (최대 25MB)</li>
                  <li>중요한 인물·소품은 화면 중앙에 — 상하 약 15%는 그라데이션·텍스트가 덮을 수 있어요.</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {isPoster && design && (
          <PosterDesignControls design={design} onChange={patchDesign} />
        )}

        <TextAreaField
          label="인사말"
          value={main.greeting}
          maxLength={500}
          rows={4}
          placeholder="저희 두 사람의 약속을 함께 축복해주세요"
          onChange={(e) => patch('main', { ...main, greeting: e.target.value })}
        />
      </div>
    </SectionEditor>
  );
}

// ─────────────────────────────────────────────────────────────
// 풀이미지형 디자인 컨트롤
// ─────────────────────────────────────────────────────────────

interface DesignProps {
  design: PosterDesign;
  onChange: (next: PosterDesign) => void;
}

function PosterDesignControls({ design, onChange }: DesignProps) {
  return (
    <div className="flex flex-col gap-5 rounded-md border border-input bg-muted/20 p-3">
      <h3 className="text-sm font-semibold text-foreground">풀이미지형 디자인</h3>

      {/* 1. 이미지 효과 */}
      <Group label="이미지 효과">
        <ToggleRow
          label="하단 그라데이션"
          hint="배경색 톤으로 자연스럽게 페이드"
          checked={design.effects.gradient}
          onChange={(v) =>
            onChange({ ...design, effects: { ...design.effects, gradient: v } })
          }
        />
        <ToggleRow
          label="가장자리 테두리"
          hint="이미지 가장자리에서 살짝 띄운 테두리"
          checked={design.effects.border}
          onChange={(v) =>
            onChange({ ...design, effects: { ...design.effects, border: v } })
          }
        />
      </Group>

      {/* 2. 제목 텍스트 */}
      <Group label="제목 텍스트">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">문구</span>
          <input
            list="title-text-presets"
            value={design.title.text}
            maxLength={60}
            onChange={(e) =>
              onChange({ ...design, title: { ...design.title, text: e.target.value } })
            }
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
            placeholder="문구를 선택하거나 직접 입력"
          />
          <datalist id="title-text-presets">
            {TITLE_TEXT_PRESETS.map((preset) => (
              <option key={preset} value={preset} />
            ))}
          </datalist>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">폰트</span>
          <select
            value={design.title.font}
            onChange={(e) =>
              onChange({
                ...design,
                title: { ...design.title, font: e.target.value as PosterDesign['title']['font'] },
              })
            }
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
          >
            {TITLE_FONT_KEYS.map((key) => (
              <option
                key={key}
                value={key}
                style={{ fontFamily: TITLE_FONT_OPTIONS[key].family }}
              >
                {TITLE_FONT_OPTIONS[key].label}
              </option>
            ))}
          </select>
          <span
            className="mt-1 truncate rounded bg-background px-2 py-2 text-base"
            style={{ fontFamily: TITLE_FONT_OPTIONS[design.title.font].family }}
          >
            {design.title.text || 'Preview'}
          </span>
        </label>

        <ColorPicker
          label="색상"
          value={design.title.color}
          onChange={(color) =>
            onChange({ ...design, title: { ...design.title, color } })
          }
          presets={TITLE_COLOR_PRESETS}
        />

        <ToggleRow
          label="애니메이션 효과"
          hint="왼쪽에서 오른쪽으로 써지는 느낌"
          checked={design.title.animate}
          onChange={(v) =>
            onChange({ ...design, title: { ...design.title, animate: v } })
          }
        />

        <PositionSliders
          position={design.title.position}
          onChange={(position) =>
            onChange({ ...design, title: { ...design.title, position } })
          }
        />
      </Group>

      {/* 3. 날짜 박스 */}
      <Group
        label="날짜 박스"
        toggle={{
          checked: design.dateBox.enabled,
          onChange: (v) =>
            onChange({ ...design, dateBox: { ...design.dateBox, enabled: v } }),
        }}
      >
        <p className="text-xs text-muted-foreground">
          전체 디자인의 폰트와 색상을 그대로 사용합니다.
        </p>
        {design.dateBox.enabled && (
          <PositionSliders
            position={design.dateBox.position}
            onChange={(position) =>
              onChange({ ...design, dateBox: { ...design.dateBox, position } })
            }
          />
        )}
      </Group>

      {/* 4. 이름 박스 */}
      <Group
        label="이름 박스"
        toggle={{
          checked: design.nameBox.enabled,
          onChange: (v) =>
            onChange({ ...design, nameBox: { ...design.nameBox, enabled: v } }),
        }}
      >
        <p className="text-xs text-muted-foreground">
          신랑·신부 이름만 표시됩니다. 폰트와 색상은 전체 디자인을 따릅니다.
        </p>
        {design.nameBox.enabled && (
          <PositionSliders
            position={design.nameBox.position}
            onChange={(position) =>
              onChange({ ...design, nameBox: { ...design.nameBox, position } })
            }
          />
        )}
      </Group>

      {/* 5. 메시지 박스 */}
      <Group label="메시지 박스">
        <p className="text-xs text-muted-foreground">
          인사말이 표시됩니다. 폰트와 색상은 전체 디자인을 따릅니다.
        </p>
        <PositionSliders
          position={design.messageBox.position}
          onChange={(position) =>
            onChange({ ...design, messageBox: { ...design.messageBox, position } })
          }
        />
      </Group>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 공용 서브 컴포넌트
// ─────────────────────────────────────────────────────────────

function Group({
  label,
  toggle,
  children,
}: {
  label: string;
  toggle?: { checked: boolean; onChange: (v: boolean) => void };
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-input bg-background p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {toggle && <Switch checked={toggle.checked} onChange={toggle.onChange} label={label} />}
      </div>
      {(toggle ? toggle.checked : true) && (
        <div className="flex flex-col gap-3">{children}</div>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-col">
        <span className="text-sm text-foreground">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`inline-flex h-5 w-9 shrink-0 items-center overflow-hidden rounded-full p-0.5 transition-colors ${
        checked ? 'bg-primary' : 'bg-muted-foreground/30'
      }`}
    >
      <span
        className={`block h-4 w-4 rounded-full bg-background shadow-sm transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function PositionSliders({
  position,
  onChange,
}: {
  position: { x: number; y: number };
  onChange: (next: { x: number; y: number }) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <SliderRow
        label="좌우"
        value={position.x}
        onChange={(x) => onChange({ ...position, x })}
        leftHint="좌"
        rightHint="우"
      />
      <SliderRow
        label="상하"
        value={position.y}
        onChange={(y) => onChange({ ...position, y })}
        leftHint="상"
        rightHint="하"
      />
    </div>
  );
}

function SliderRow({
  label,
  value,
  onChange,
  leftHint,
  rightHint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  leftHint: string;
  rightHint: string;
}) {
  return (
    <label className="flex items-center gap-3 text-xs">
      <span className="w-8 shrink-0 text-muted-foreground">{label}</span>
      <span className="text-muted-foreground">{leftHint}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-foreground"
      />
      <span className="text-muted-foreground">{rightHint}</span>
      <span className="w-8 shrink-0 text-right tabular-nums text-muted-foreground">
        {Math.round(value)}
      </span>
    </label>
  );
}

function ColorPicker({
  label,
  value,
  onChange,
  presets,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  presets: string[];
}) {
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((preset) => {
          const selected = preset.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(preset)}
              aria-label={`색상 ${preset}`}
              aria-pressed={selected}
              className={`h-7 w-7 rounded-full border-2 transition-shadow ${
                selected ? 'border-foreground shadow' : 'border-input'
              }`}
              style={{ backgroundColor: preset }}
            />
          );
        })}
        <input
          type="color"
          value={normalizeHex(value)}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          aria-label="사용자 지정 색상"
          className="h-7 w-9 cursor-pointer rounded border border-input bg-background p-0.5"
        />
      </div>
    </div>
  );
}

function normalizeHex(input: string) {
  // <input type="color"> 는 #rrggbb 만 허용 — 다른 포맷이면 흰색으로 폴백.
  if (/^#[0-9a-fA-F]{6}$/.test(input)) return input;
  return '#FFFFFF';
}
