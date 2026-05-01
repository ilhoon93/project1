'use client';

import { useEditorStore } from '@/stores/editor';
import { SectionEditor } from '../SectionEditor';
import { TextField, TextAreaField } from '../form-fields';
import type { InvitationContent } from '@/types/invitation';

type BasicInfo = InvitationContent['basic'];
type Parent = BasicInfo['family']['groomFather'];

export function BasicInfoEditor() {
  const basic = useEditorStore((s) => s.content?.basic);
  const meta = useEditorStore((s) => s.meta);
  const patch = useEditorStore((s) => s.patchSection);
  const setMeta = useEditorStore((s) => s.setMeta);
  if (!basic || !meta) return null;

  const set = (next: BasicInfo) => patch('basic', next);

  return (
    <SectionEditor
      title="기본 정보"
      description="신랑·신부와 가족 · 날짜 · 인사말 · 글귀"
    >
      <div className="flex flex-col gap-5">
        {/* 1) 신랑·신부와 가족 — 토글 없이 항상 입력 */}
        <SubSection
          title="신랑·신부와 가족"
          enabled={basic.family.enabled}
          onToggle={(v) =>
            set({ ...basic, family: { ...basic.family, enabled: v } })
          }
        >
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
                  set({
                    ...basic,
                    family: { ...basic.family, groomFather: p },
                  })
                }
              />
              <ParentField
                label="신랑 어머니"
                value={basic.family.groomMother}
                onChange={(p) =>
                  set({
                    ...basic,
                    family: { ...basic.family, groomMother: p },
                  })
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
                  set({
                    ...basic,
                    family: { ...basic.family, brideFather: p },
                  })
                }
              />
              <ParentField
                label="신부 어머니"
                value={basic.family.brideMother}
                onChange={(p) =>
                  set({
                    ...basic,
                    family: { ...basic.family, brideMother: p },
                  })
                }
              />
            </div>
          </SideBlock>
        </SubSection>

        {/* 2) 날짜 표시 */}
        <SubSection
          title="날짜 표시"
          enabled={basic.showDate}
          onToggle={(v) => set({ ...basic, showDate: v })}
        >
          <TextField
            label="결혼식 날짜"
            type="date"
            value={meta.weddingDate ?? ''}
            onChange={(e) => setMeta({ weddingDate: e.target.value || null })}
            hint="발행 후 30일이 만료일이 됩니다"
          />
        </SubSection>

        {/* 3) 인사말 */}
        <SubSection
          title="인사말"
          enabled={basic.greeting.enabled}
          onToggle={(v) =>
            set({ ...basic, greeting: { ...basic.greeting, enabled: v } })
          }
        >
          <TextAreaField
            label=""
            value={basic.greeting.text}
            maxLength={500}
            rows={4}
            placeholder="저희 결혼식에 함께해주세요. (결혼식이 따로 없을 경우 그 사실을 적어주셔도 됩니다)"
            onChange={(e) =>
              set({ ...basic, greeting: { ...basic.greeting, text: e.target.value } })
            }
          />
        </SubSection>

        {/* 4) 글귀 */}
        <SubSection
          title="글귀"
          enabled={basic.quote.enabled}
          onToggle={(v) => set({ ...basic, quote: { ...basic.quote, enabled: v } })}
        >
          <TextAreaField
            label=""
            value={basic.quote.text}
            maxLength={200}
            rows={2}
            placeholder="짧은 한 줄 글귀를 적어주세요"
            onChange={(e) =>
              set({ ...basic, quote: { ...basic.quote, text: e.target.value } })
            }
          />
        </SubSection>
      </div>
    </SectionEditor>
  );
}

function SubSection({
  title,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border bg-background p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
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
      {enabled && <div className="flex flex-col gap-2">{children}</div>}
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
