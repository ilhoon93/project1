'use client';

import { useEditorStore } from '@/stores/editor';
import { type AccountPartyKey } from '@/types/invitation';
import { SectionEditor } from '../SectionEditor';
import { TextField } from '../form-fields';
import { PresetTextArea } from '../PresetTextArea';
import { ACCOUNT_GUIDE_PRESETS } from '@/lib/presets';
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
  const meta = useEditorStore((s) => s.meta);
  const basic = useEditorStore((s) => s.content?.basic);
  const patch = useEditorStore((s) => s.patchSection);
  if (!account || !meta || !basic) return null;

  const setParty = (party: AccountPartyKey, list: BankAccount[]) =>
    patch('account', { ...account, [party]: list });

  // 신랑·신부 본인은 meta 에서, 부모님은 basic.family 에서 이름을 끌어와
  // 새 계좌 추가 시 예금주에 자동 매핑.
  const holderFor = (party: AccountPartyKey): string => {
    switch (party) {
      case 'groom':
        return meta.groomName.trim();
      case 'bride':
        return meta.brideName.trim();
      case 'groomFather':
        return basic.family.groomFather.name.trim();
      case 'groomMother':
        return basic.family.groomMother.name.trim();
      case 'brideFather':
        return basic.family.brideFather.name.trim();
      case 'brideMother':
        return basic.family.brideMother.name.trim();
    }
  };

  // 👇 신랑 / 신부 분리
  const groomKeys: AccountPartyKey[] = ['groom', 'groomFather', 'groomMother'];
  const brideKeys: AccountPartyKey[] = ['bride', 'brideFather', 'brideMother'];

  return (
    <SectionEditor
      title="축의금 계좌"
      description="안내문구 + 신랑·신부·부모님별 계좌 (각 최대 3개)"
      toggle={{
        enabled: account.enabled,
        onChange: (next) => patch('account', { ...account, enabled: next }),
      }}
    >
      <div className="flex flex-col gap-6">
        <PresetTextArea
          label="안내문구"
          value={account.guide}
          maxLength={500}
          rows={3}
          placeholder="축하의 마음을 담아 마음 전하실 분들을 위해 계좌번호를 안내드립니다."
          onChange={(next) => patch('account', { ...account, guide: next })}
          presets={ACCOUNT_GUIDE_PRESETS}
          presetLabel="추천 안내문구"
        />

        {/* 👇 신랑 측 */}
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">신랑 측</h3>
          {groomKeys.map((party) => (
            <PartyEditor
              key={party}
              label={PARTY_LABELS[party]}
              list={account[party]}
              defaultHolder={holderFor(party)}
              onChange={(l) => setParty(party, l)}
            />
          ))}
        </div>

        {/* 👇 신부 측 */}
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">신부 측</h3>
          {brideKeys.map((party) => (
            <PartyEditor
              key={party}
              label={PARTY_LABELS[party]}
              list={account[party]}
              defaultHolder={holderFor(party)}
              onChange={(l) => setParty(party, l)}
            />
          ))}
        </div>
      </div>
    </SectionEditor>
  );
}

function PartyEditor({
  label,
  list,
  defaultHolder,
  onChange,
}: {
  label: string;
  list: BankAccount[];
  /** 기본정보에서 끌어온 예금주 이름 — 신규 행 추가 시 자동 채움. */
  defaultHolder: string;
  onChange: (next: BankAccount[]) => void;
}) {
  const updateAt = (i: number, next: BankAccount) => {
    const copy = [...list];
    copy[i] = next;
    onChange(copy);
  };

  const addRow = () => {
    if (list.length >= 3) return;
    // defaultHolder 가 있으면 해당 사람의 이름을 자동 매핑.
    onChange([...list, { ...EMPTY, holder: defaultHolder }]);
  };

  const removeAt = (i: number) => onChange(list.filter((_, idx) => idx !== i));

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-muted-foreground">{label}</h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRow}
          disabled={list.length >= 3}
        >
          + 계좌 추가
        </Button>
      </div>

      {list.length === 0 && (
        <p className="text-xs text-muted-foreground">
          계좌를 추가하지 않으면 이 항목은 표시되지 않습니다.
        </p>
      )}

      {/* 👇 핵심: 세로 입력 구조 */}
      {list.map((acct, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 rounded-md border bg-white p-3"
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
            onChange={(e) => updateAt(i, { ...acct, number: e.target.value })}
          />

          <TextField
            label="예금주"
            value={acct.holder}
            maxLength={20}
            placeholder={defaultHolder || '홍길동'}
            onChange={(e) => updateAt(i, { ...acct, holder: e.target.value })}
          />

          <button
            type="button"
            onClick={() => removeAt(i)}
            className="self-end text-xs text-destructive hover:underline"
          >
            삭제
          </button>
        </div>
      ))}
    </div>
  );
}