'use client';

import { useEditorStore } from '@/stores/editor';
import { type AccountPartyKey } from '@/types/invitation';
import { SectionEditor, type SectionDragProps } from '../SectionEditor';
import { SectionHeaderFields } from './SectionHeaderFields';
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

export function AccountEditor({ drag }: { drag?: SectionDragProps }) {
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
      drag={drag}
      title="축의금 계좌"
      description="안내문구 + 신랑·신부·부모님별 계좌 (각 최대 3개)"
      toggle={{
        enabled: account.enabled,
        onChange: (next) => patch('account', { ...account, enabled: next }),
      }}
    >
      <div className="flex flex-col gap-5">
        <SectionHeaderFields sectionKey="account" />
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

        {/* 안내문구는 상단에 1번만 — 각 PartyEditor 의 빈 상태 메시지 중복 제거. */}
        <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          ※ 계좌를 추가하지 않은 항목은 알림장에 표시되지 않습니다.
        </p>

        <div className="flex flex-col gap-3">
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

        <div className="flex flex-col gap-3">
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
    onChange([...list, { ...EMPTY, holder: defaultHolder }]);
  };

  const removeAt = (i: number) => onChange(list.filter((_, idx) => idx !== i));

  return (
    <div className="flex flex-col gap-2 rounded-md border bg-background p-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium">{label}</h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRow}
          disabled={list.length >= 3}
          className="h-7 px-2 text-xs"
        >
          + 추가
        </Button>
      </div>

      {/* 계좌 입력 — 2 줄 레이아웃.
            1) 은행(한글 6자) + 예금주(한글 6자) + × 삭제
            2) 계좌번호(숫자 20자 정도)
          좁은 모바일 화면에서도 가독성/터치 영역을 확보하기 위해 한 줄에
          모두 욱여넣기보다는 분리. */}
      {list.map((acct, i) => (
        <div
          key={i}
          className="flex flex-col gap-1.5 rounded border border-input/60 bg-muted/30 p-2"
        >
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={acct.bank}
              maxLength={20}
              placeholder="은행"
              aria-label="은행"
              onChange={(e) => updateAt(i, { ...acct, bank: e.target.value })}
              className="h-8 w-24 min-w-0 shrink-0 rounded border border-input bg-background px-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
            <input
              type="text"
              value={acct.holder}
              maxLength={20}
              placeholder={defaultHolder || '예금주'}
              aria-label="예금주"
              onChange={(e) => updateAt(i, { ...acct, holder: e.target.value })}
              className="h-8 w-24 min-w-0 shrink-0 rounded border border-input bg-background px-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
            <button
              type="button"
              aria-label="삭제"
              onClick={() => removeAt(i)}
              className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              ×
            </button>
          </div>
          <input
            type="text"
            value={acct.number}
            maxLength={30}
            placeholder="계좌번호"
            aria-label="계좌번호"
            onChange={(e) => updateAt(i, { ...acct, number: e.target.value })}
            className="h-8 w-full min-w-0 rounded border border-input bg-background px-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </div>
      ))}
    </div>
  );
}