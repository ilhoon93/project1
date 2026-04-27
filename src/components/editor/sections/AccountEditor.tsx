'use client';

import { useEditorStore } from '@/stores/editor';
import { SectionEditor } from '../SectionEditor';
import { TextField } from '../form-fields';
import { Button } from '@/components/ui/button';
import type { BankAccount } from '@/types/invitation';

const EMPTY: BankAccount = { bank: '', number: '', holder: '' };

export function AccountEditor() {
  const account = useEditorStore((s) => s.content?.account);
  const patch = useEditorStore((s) => s.patchSection);
  if (!account) return null;

  const updateSide = (side: 'groom' | 'bride', list: BankAccount[]) =>
    patch('account', { ...account, [side]: list });

  return (
    <SectionEditor
      title="축의금 계좌"
      description="신랑/신부 측 계좌 (각 최대 3개)"
      toggle={{
        enabled: account.enabled,
        onChange: (next) => patch('account', { ...account, enabled: next }),
      }}
    >
      <div className="flex flex-col gap-4">
        <SideEditor label="신랑 측" list={account.groom} onChange={(l) => updateSide('groom', l)} />
        <SideEditor label="신부 측" list={account.bride} onChange={(l) => updateSide('bride', l)} />
      </div>
    </SectionEditor>
  );
}

function SideEditor({
  label,
  list,
  onChange,
}: {
  label: string;
  list: BankAccount[];
  onChange: (next: BankAccount[]) => void;
}) {
  const updateAt = (i: number, next: BankAccount) => {
    const copy = [...list];
    copy[i] = next;
    onChange(copy);
  };
  const addRow = () => {
    if (list.length >= 3) return;
    onChange([...list, EMPTY]);
  };
  const removeAt = (i: number) => onChange(list.filter((_, idx) => idx !== i));

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold text-muted-foreground">{label}</h3>
      {list.map((acct, i) => (
        <div key={i} className="grid grid-cols-[1fr_2fr_1fr_auto] items-end gap-2">
          <TextField
            label="은행"
            value={acct.bank}
            placeholder="국민"
            onChange={(e) => updateAt(i, { ...acct, bank: e.target.value })}
          />
          <TextField
            label="계좌번호"
            value={acct.number}
            placeholder="000-0000-0000"
            onChange={(e) => updateAt(i, { ...acct, number: e.target.value })}
          />
          <TextField
            label="예금주"
            value={acct.holder}
            placeholder="홍길동"
            onChange={(e) => updateAt(i, { ...acct, holder: e.target.value })}
          />
          <button
            type="button"
            onClick={() => removeAt(i)}
            aria-label="계좌 삭제"
            className="h-10 px-2 text-sm text-destructive hover:underline"
          >
            ×
          </button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addRow}
        disabled={list.length >= 3}
        className="self-start"
      >
        계좌 추가
      </Button>
    </div>
  );
}
