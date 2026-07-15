'use client';

import { useEditorStore } from '@/stores/editor';
import { SectionEditor, type SectionDragProps } from '../SectionEditor';
import { SectionHeaderFields } from './SectionHeaderFields';
import { TextAreaField } from '../form-fields';
import { PresetPickerButton } from '../PresetTextArea';
import { BASIC_GREETING_PRESETS, QUOTE_PRESETS } from '@/lib/presets';
import {
  DATE_FORMATS,
  reconcileBasicSubOrder,
  type BasicSubKey,
  type DateFormat,
  type InvitationContent,
} from '@/types/invitation';
import { formatWeddingDate, normalizeDateInput } from '@/lib/utils/format-date';

type BasicInfo = InvitationContent['basic'];
type Parent = BasicInfo['family']['groomFather'];

const SUB_LABELS: Record<BasicSubKey, string> = {
  family: '신랑·신부와 가족',
  date: '날짜 표시',
  greeting: '인사말',
  quote: '글귀',
};

export function BasicInfoEditor({ drag }: { drag?: SectionDragProps }) {
  const basic = useEditorStore((s) => s.content?.basic);
  const meta = useEditorStore((s) => s.meta);
  const patch = useEditorStore((s) => s.patchSection);
  const setMeta = useEditorStore((s) => s.setMeta);
  if (!basic || !meta) return null;

  const set = (next: BasicInfo) => patch('basic', next);
  const order = reconcileBasicSubOrder(basic.subOrder);

  const moveSub = (key: BasicSubKey, dir: -1 | 1) => {
    const i = order.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    set({ ...basic, subOrder: next });
  };

  const renderSub = (key: BasicSubKey, i: number) => {
    const isFirst = i === 0;
    const isLast = i === order.length - 1;
    // 인사말 / 글귀는 SubHeader 우측(토글 옆) 에 추천 버튼을 배치한다.
    const presetSlot =
      key === 'greeting' ? (
        <PresetPickerButton
          label="추천 인사말"
          presets={BASIC_GREETING_PRESETS}
          value={basic.greeting.text}
          onPick={(next) => set({ ...basic, greeting: { ...basic.greeting, text: next } })}
          size="xs"
        />
      ) : key === 'quote' ? (
        <PresetPickerButton
          label="추천 글귀"
          presets={QUOTE_PRESETS}
          value={basic.quote.text}
          onPick={(next) => set({ ...basic, quote: { ...basic.quote, text: next } })}
          size="xs"
        />
      ) : null;
    const header = (
      <SubHeader
        title={SUB_LABELS[key]}
        enabled={subEnabled(basic, key)}
        onToggle={(v) => toggleSub(basic, key, v, set)}
        isFirst={isFirst}
        isLast={isLast}
        onMove={(dir) => moveSub(key, dir)}
        action={presetSlot}
      />
    );

    if (key === 'family') {
      return (
        <SubBox key={key} header={header}>
          {basic.family.enabled && (
            <>
              <p className="text-xs text-muted-foreground">
                ※ 故 표시는 이름 앞에 자동으로 붙습니다.
              </p>
              {/* 신랑측 / 신부측 — sm 이상에서 좌우 나란히. 입력 폭은 SideBlock
                  내부에서 자동으로 컬럼 폭에 맞춰져 짧아진다. */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <SideBlock title="신랑측">
                  <CompactNameField
                    label="신랑"
                    value={meta.groomName}
                    onChange={(v) => setMeta({ groomName: v })}
                  />
                  <ParentField
                    label="아버지"
                    value={basic.family.groomFather}
                    onChange={(p) =>
                      set({ ...basic, family: { ...basic.family, groomFather: p } })
                    }
                  />
                  <ParentField
                    label="어머니"
                    value={basic.family.groomMother}
                    onChange={(p) =>
                      set({ ...basic, family: { ...basic.family, groomMother: p } })
                    }
                  />
                </SideBlock>
                <SideBlock title="신부측">
                  <CompactNameField
                    label="신부"
                    value={meta.brideName}
                    onChange={(v) => setMeta({ brideName: v })}
                  />
                  <ParentField
                    label="아버지"
                    value={basic.family.brideFather}
                    onChange={(p) =>
                      set({ ...basic, family: { ...basic.family, brideFather: p } })
                    }
                  />
                  <ParentField
                    label="어머니"
                    value={basic.family.brideMother}
                    onChange={(p) =>
                      set({ ...basic, family: { ...basic.family, brideMother: p } })
                    }
                  />
                </SideBlock>
              </div>
            </>
          )}
        </SubBox>
      );
    }
    if (key === 'date') {
      return (
        <SubBox key={key} header={header}>
          {basic.showDate && (
            <div className="flex flex-col gap-2">
              {/* 날짜 입력 + 출력 형식 — sm 이상 같은 줄, 모바일은 stack. */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:items-end">
                <DateInput
                  value={meta.weddingDate}
                  onChange={(iso) => setMeta({ weddingDate: iso })}
                />
                <label className="flex min-w-0 flex-col gap-1.5 text-sm">
                  <span className="text-xs text-muted-foreground">출력 형식</span>
                  <select
                    className="w-full min-w-0 rounded border border-input bg-background px-2 py-1.5 text-sm"
                    value={basic.dateFormat}
                    onChange={(e) =>
                      set({ ...basic, dateFormat: e.target.value as DateFormat })
                    }
                  >
                    {DATE_FORMATS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {meta.weddingDate && (
                <p className="text-[11px] text-muted-foreground">
                  미리보기:{' '}
                  <span className="font-medium text-foreground">
                    {formatWeddingDate(meta.weddingDate, basic.dateFormat)}
                  </span>
                </p>
              )}
            </div>
          )}
        </SubBox>
      );
    }
    if (key === 'greeting') {
      return (
        <SubBox key={key} header={header}>
          {basic.greeting.enabled && (
            <TextAreaField
              label=""
              value={basic.greeting.text}
              maxLength={500}
              rows={4}
              onChange={(e) =>
                set({ ...basic, greeting: { ...basic.greeting, text: e.target.value } })
              }
            />
          )}
        </SubBox>
      );
    }
    // quote
    return (
      <SubBox key={key} header={header}>
        {basic.quote.enabled && (
          <TextAreaField
            label=""
            value={basic.quote.text}
            maxLength={200}
            rows={2}
            onChange={(e) =>
              set({ ...basic, quote: { ...basic.quote, text: e.target.value } })
            }
          />
        )}
      </SubBox>
    );
  };

  return (
    <SectionEditor
      drag={drag}
      title="기본 정보"
      description="신랑·신부와 가족 · 날짜 · 인사말 · 글귀 (↑ ↓ 로 순서 변경)"
    >
      <div className="flex flex-col gap-3">
        <SectionHeaderFields sectionKey="basic" />
        {order.map((k, i) => renderSub(k, i))}
      </div>
    </SectionEditor>
  );
}

// ─────────────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────────────

function subEnabled(basic: BasicInfo, key: BasicSubKey): boolean {
  switch (key) {
    case 'family':
      return basic.family.enabled;
    case 'date':
      return basic.showDate;
    case 'greeting':
      return basic.greeting.enabled;
    case 'quote':
      return basic.quote.enabled;
  }
}

function toggleSub(
  basic: BasicInfo,
  key: BasicSubKey,
  v: boolean,
  set: (next: BasicInfo) => void,
) {
  switch (key) {
    case 'family':
      set({ ...basic, family: { ...basic.family, enabled: v } });
      return;
    case 'date':
      set({ ...basic, showDate: v });
      return;
    case 'greeting':
      set({ ...basic, greeting: { ...basic.greeting, enabled: v } });
      return;
    case 'quote':
      set({ ...basic, quote: { ...basic.quote, enabled: v } });
      return;
  }
}

function SubHeader({
  title,
  enabled,
  onToggle,
  isFirst,
  isLast,
  onMove,
  action,
}: {
  title: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  isFirst: boolean;
  isLast: boolean;
  onMove: (dir: -1 | 1) => void;
  /** 토글 좌측에 배치되는 추가 액션(예: 추천 문구 버튼). */
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1">
        <ArrowButton label={`${title} 위로`} disabled={isFirst} onClick={() => onMove(-1)}>
          ↑
        </ArrowButton>
        <ArrowButton label={`${title} 아래로`} disabled={isLast} onClick={() => onMove(1)}>
          ↓
        </ArrowButton>
        <h3 className="ml-2 truncate text-sm font-medium">{title}</h3>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {/* 추천 문구 버튼 — 토글 바로 옆 */}
        {action}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={`${title} 사용 여부`}
          onClick={() => onToggle(!enabled)}
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
    </div>
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
      className="grid h-6 w-6 place-items-center rounded border border-input bg-background text-xs text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function SubBox({
  header,
  children,
}: {
  header: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border bg-background p-3">
      {header}
      {children && <div className="flex flex-col gap-2">{children}</div>}
    </div>
  );
}

function SideBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-md border border-dashed border-muted-foreground/30 p-3">
      <h4 className="text-xs font-semibold tracking-wide text-muted-foreground">
        {title}
      </h4>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function CompactNameField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  // 부모님 입력칸(ParentField)은 우측에 故 체크박스(약 36~40px) 가 붙어 있어서
  // input 의 실제 폭이 그만큼 좁다. 신랑/신부 입력칸은 故 체크박스가 없지만
  // 시각적으로 같은 폭을 유지하도록 같은 너비의 invisible 스페이서를 둔다.
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-xs text-muted-foreground">{label}</span>
      <input
        type="text"
        value={value}
        maxLength={20}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
      />
      {/* 故 체크박스 자리 — invisible 더미. ParentField 의 라벨과 같은 구조/너비. */}
      <span aria-hidden className="flex shrink-0 items-center gap-1 text-xs invisible">
        <span className="inline-block h-3 w-3" />
        故
      </span>
    </div>
  );
}

function ParentField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Parent;
  onChange: (next: Parent) => void;
}) {
  // 컴팩트 1줄 형식 — 라벨 + 입력 + 故 체크박스를 한 줄에 배치해 화면 공간 절약.
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-xs text-muted-foreground">{label}</span>
      <input
        type="text"
        value={value.name}
        maxLength={20}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
        className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
      />
      <label className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={value.deceased}
          onChange={(e) => onChange({ ...value, deceased: e.target.checked })}
        />
        故
      </label>
    </div>
  );
}

/**
 * 날짜 입력 — type="date" 대신 숫자 자유 입력 + 즉시 정규화.
 * 사용자가 "20260523" 처럼 8자리 숫자만 쳐도 자동으로 "2026-05-23" ISO 로 저장.
 * blur 시 검증, 잘못된 입력은 null 로(=날짜 미설정).
 */
function DateInput({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (iso: string | null) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">
        결혼식 날짜{' '}
        <span className="text-[10px]">(YYYYMMDD · 숫자만 입력해도 됨)</span>
      </span>
      <input
        type="text"
        inputMode="numeric"
        placeholder="20260523"
        defaultValue={value ?? ''}
        onBlur={(e) => {
          const raw = e.target.value.trim();
          if (!raw) {
            onChange(null);
            return;
          }
          // 이미 ISO 면 그대로, 8자리 숫자면 정규화.
          if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            onChange(raw);
            return;
          }
          const normalized = normalizeDateInput(raw);
          if (normalized) {
            onChange(normalized);
            e.target.value = normalized;
          } else {
            // 잘못된 입력 → 이전 값 복원.
            e.target.value = value ?? '';
          }
        }}
        className="w-full min-w-0 rounded border border-input bg-background px-2 py-1.5 text-sm"
      />
    </label>
  );
}
