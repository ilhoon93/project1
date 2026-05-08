'use client';

import { useEditorStore } from '@/stores/editor';
import { SectionEditor } from '../SectionEditor';
import { TextField } from '../form-fields';
import { PresetTextArea } from '../PresetTextArea';
import { BASIC_GREETING_PRESETS, QUOTE_PRESETS } from '@/lib/presets';
import {
  reconcileBasicSubOrder,
  type BasicSubKey,
  type InvitationContent,
} from '@/types/invitation';

type BasicInfo = InvitationContent['basic'];
type Parent = BasicInfo['family']['groomFather'];

const SUB_LABELS: Record<BasicSubKey, string> = {
  family: '신랑·신부와 가족',
  date: '날짜 표시',
  greeting: '인사말',
  quote: '글귀',
};

export function BasicInfoEditor() {
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
    const header = (
      <SubHeader
        title={SUB_LABELS[key]}
        enabled={subEnabled(basic, key)}
        onToggle={(v) => toggleSub(basic, key, v, set)}
        isFirst={isFirst}
        isLast={isLast}
        onMove={(dir) => moveSub(key, dir)}
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
              <SideBlock title="신랑측">
                <TextField
                  label="신랑 이름"
                  value={meta.groomName}
                  maxLength={20}
                  placeholder="홍길동"
                  onChange={(e) => setMeta({ groomName: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <ParentField
                    label="신랑 아버지"
                    value={basic.family.groomFather}
                    onChange={(p) =>
                      set({ ...basic, family: { ...basic.family, groomFather: p } })
                    }
                  />
                  <ParentField
                    label="신랑 어머니"
                    value={basic.family.groomMother}
                    onChange={(p) =>
                      set({ ...basic, family: { ...basic.family, groomMother: p } })
                    }
                  />
                </div>
              </SideBlock>
              <SideBlock title="신부측">
                <TextField
                  label="신부 이름"
                  value={meta.brideName}
                  maxLength={20}
                  placeholder="김영희"
                  onChange={(e) => setMeta({ brideName: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <ParentField
                    label="신부 아버지"
                    value={basic.family.brideFather}
                    onChange={(p) =>
                      set({ ...basic, family: { ...basic.family, brideFather: p } })
                    }
                  />
                  <ParentField
                    label="신부 어머니"
                    value={basic.family.brideMother}
                    onChange={(p) =>
                      set({ ...basic, family: { ...basic.family, brideMother: p } })
                    }
                  />
                </div>
              </SideBlock>
            </>
          )}
        </SubBox>
      );
    }
    if (key === 'date') {
      return (
        <SubBox key={key} header={header}>
          {basic.showDate && (
            <TextField
              label="결혼식 날짜"
              type="date"
              value={meta.weddingDate ?? ''}
              onChange={(e) => setMeta({ weddingDate: e.target.value || null })}
              hint="발행 후 30일이 만료일이 됩니다"
            />
          )}
        </SubBox>
      );
    }
    if (key === 'greeting') {
      return (
        <SubBox key={key} header={header}>
          {basic.greeting.enabled && (
            <PresetTextArea
              label=""
              value={basic.greeting.text}
              maxLength={500}
              rows={4}
              placeholder="저희 결혼식에 함께해주세요. (결혼식이 따로 없을 경우 그 사실을 적어주셔도 됩니다)"
              onChange={(next) =>
                set({ ...basic, greeting: { ...basic.greeting, text: next } })
              }
              presets={BASIC_GREETING_PRESETS}
              presetLabel="추천 인사말"
            />
          )}
        </SubBox>
      );
    }
    // quote
    return (
      <SubBox key={key} header={header}>
        {basic.quote.enabled && (
          <PresetTextArea
            label=""
            value={basic.quote.text}
            maxLength={200}
            rows={2}
            placeholder="짧은 한 줄 글귀를 적어주세요"
            onChange={(next) =>
              set({ ...basic, quote: { ...basic.quote, text: next } })
            }
            presets={QUOTE_PRESETS}
            presetLabel="추천 글귀"
          />
        )}
      </SubBox>
    );
  };

  return (
    <SectionEditor
      title="기본 정보"
      description="신랑·신부와 가족 · 날짜 · 인사말 · 글귀 (↑ ↓ 로 순서 변경)"
    >
      <div className="flex flex-col gap-3">{order.map((k, i) => renderSub(k, i))}</div>
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
}: {
  title: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  isFirst: boolean;
  isLast: boolean;
  onMove: (dir: -1 | 1) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1">
        <ArrowButton label={`${title} 위로`} disabled={isFirst} onClick={() => onMove(-1)}>
          ↑
        </ArrowButton>
        <ArrowButton label={`${title} 아래로`} disabled={isLast} onClick={() => onMove(1)}>
          ↓
        </ArrowButton>
        <h3 className="ml-2 text-sm font-medium">{title}</h3>
      </div>
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
    <div className="flex flex-col gap-2 rounded-md border border-dashed border-muted-foreground/30 p-3">
      <h4 className="text-xs font-semibold tracking-wide text-muted-foreground">
        {title}
      </h4>
      <div className="flex flex-col gap-2">{children}</div>
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
  return (
    <div className="flex flex-col gap-1.5">
      <TextField
        label={label}
        value={value.name}
        maxLength={20}
        placeholder="이름"
        onChange={(e) => onChange({ ...value, name: e.target.value })}
      />
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
