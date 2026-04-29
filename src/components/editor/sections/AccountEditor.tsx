'use client';

import { useEditorStore } from '@/stores/editor';
import { ACCOUNT_PARTY_KEYS, type AccountPartyKey } from '@/types/invitation';
import { SectionEditor } from '../SectionEditor';
import { TextField, TextAreaField } from '../form-fields';
import { Button } from '@/components/ui/button';
import type { BankAccount } from '@/types/invitation';

const EMPTY: BankAccount = { bank: '', number: '', holder: '' };

const PARTY_LABELS: Record<AccountPartyKey, string> = {
  groom: '신랑',
  bride: '신부',
  groomFather: '신랑 아버지',
  groomMother: '신랑 어머니',
  brideFather: '신부 아버지',
  brideMother: '신부 어머니',
};

export function AccountEditor() {
  const account = useEditorStore((s) => s.content?.account);
  const patch = useEditorStore((s) => s.patchSection);
  if (!account) return null;

  const setParty = (party: AccountPartyKey, list: BankAccount[]) =>
    patch('account', { ...account, [party]: list });

  return (
    <SectionEditor
      title="축의금 계좌"
      description="안내문구 + 신랑·신부·부모님별 계좌 (각 최대 3개)"
      toggle={{
        enabled: account.enabled,
        onChange: (next) => patch('account', { ...account, enabled: next }),
      }}
    >
      <div className="flex flex-col gap-4">
        <TextAreaField
          label="안내문구"
          value={account.guide}
          maxLength={500}
          rows={3}
          placeholder="축하의 마음을 담아 마음 전하실 분들을 위해 계좌번호를 안내드립니다."
          onChange={(e) => patch('account', { ...account, guide: e.target.value })}
        />

        {ACCOUNT_PARTY_KEYS.map((party) => (
          <PartyEditor
            key={party}
            label={PARTY_LABELS[party]}
            list={account[party]}
            onChange={(l) => setParty(party, l)}
          />
        ))}
      </div>
    </SectionEditor>
  );
}

function PartyEditor({
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
    <div className="flex flex-col gap-2 rounded-md border bg-muted/20 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground">{label}</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRow}
          disabled={list.length >= 3}
        >
          계좌 추가
        </Button>
      </div>
      {list.length === 0 && (
        <p className="text-xs text-muted-foreground">
          계좌를 추가하지 않으면 이 항목은 표시되지 않습니다.
        </p>
      )}
      {list.map((acct, i) => (
        <div
          key={i}
          className="grid grid-cols-[1fr_2fr_1fr_auto] items-end gap-2"
        >
          <TextField
            label="은행"
            value={acct.bank}
            maxLength={20}
            placeholder="국민"
            onChange={(e) => updateAt(i, { ...acct, bank: e.target.value })}
          />
          <TextField
            label="계좌번호"
            value={acct.number}
            maxLength={30}
            placeholder="000-0000-0000"
            onChange={(e) => updateAt(i, { ...acct, number: e.target.value })}
          />
          <TextField
            label="예금주"
            value={acct.holder}
            maxLength={20}
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
    </div>
  );
}
