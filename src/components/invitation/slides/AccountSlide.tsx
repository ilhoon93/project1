'use client';

import { useState } from 'react';
import type { InvitationContent, BankAccount } from '@/types/invitation';

interface PartyGroup {
  label: string;
  accounts: BankAccount[];
}

const isComplete = (a: BankAccount) =>
  a.bank.trim() && a.number.trim() && a.holder.trim();

export function AccountSlide({ account }: { account: InvitationContent['account'] }) {
  const [side, setSide] = useState<'groom' | 'bride'>('groom');

  const groomGroups: PartyGroup[] = [
    { label: '신랑', accounts: account.groom.filter(isComplete) },
    { label: '신랑 아버지', accounts: account.groomFather.filter(isComplete) },
    { label: '신랑 어머니', accounts: account.groomMother.filter(isComplete) },
  ].filter((g) => g.accounts.length > 0);

  const brideGroups: PartyGroup[] = [
    { label: '신부', accounts: account.bride.filter(isComplete) },
    { label: '신부 아버지', accounts: account.brideFather.filter(isComplete) },
    { label: '신부 어머니', accounts: account.brideMother.filter(isComplete) },
  ].filter((g) => g.accounts.length > 0);

  const groups = side === 'groom' ? groomGroups : brideGroups;
  const showSideTabs = groomGroups.length > 0 && brideGroups.length > 0;

  // If only one side has accounts, force-select it so the empty side isn't
  // shown by accident.
  if (!showSideTabs && groomGroups.length === 0 && brideGroups.length === 0) {
    return (
      <section className="flex min-h-full flex-col items-center justify-center gap-3 px-6 py-16">
        <h2 className="text-xl font-light">마음 전하실 곳</h2>
        <p className="text-sm opacity-70">등록된 계좌가 없습니다</p>
      </section>
    );
  }

  const activeGroups = showSideTabs
    ? groups
    : groomGroups.length > 0
      ? groomGroups
      : brideGroups;

  return (
    <section className="flex min-h-full flex-col gap-5 px-6 py-16">
      <header className="text-center">
        <p className="text-xs tracking-[0.3em] opacity-70">ACCOUNT</p>
        <h2 className="mt-2 text-xl font-light">마음 전하실 곳</h2>
      </header>

      {account.guide.trim() && (
        <p className="whitespace-pre-line text-center text-sm leading-relaxed opacity-90">
          {account.guide}
        </p>
      )}

      {showSideTabs && (
        <div className="flex justify-center gap-2">
          <Tab active={side === 'groom'} onClick={() => setSide('groom')}>
            신랑 측
          </Tab>
          <Tab active={side === 'bride'} onClick={() => setSide('bride')}>
            신부 측
          </Tab>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {activeGroups.map((group) => (
          <div key={group.label} className="flex flex-col gap-2">
            <h3 className="text-xs font-medium opacity-70">{group.label}</h3>
            <ul className="flex flex-col gap-2">
              {group.accounts.map((acct, i) => (
                <AccountRow key={i} acct={acct} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
        active
          ? 'bg-[#8B7355] text-white'
          : 'bg-white text-[#8B7355] ring-1 ring-[#D4C5B0]'
      }`}
    >
      {children}
    </button>
  );
}

function AccountRow({ acct }: { acct: BankAccount }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(acct.number);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <li className="flex items-center justify-between rounded-md bg-white px-4 py-3 ring-1 ring-[#D4C5B0]">
      <div className="flex flex-col">
        <span className="text-xs text-[#8B7355]">
          {acct.bank} · {acct.holder}
        </span>
        <span className="text-sm font-medium tracking-wide text-[#3D2E1F]">
          {acct.number}
        </span>
      </div>
      <button
        type="button"
        onClick={copy}
        className="rounded-md bg-[#F4E5D6] px-3 py-1.5 text-xs font-medium text-[#5C4633] transition-colors hover:bg-[#E8D5C0]"
      >
        {copied ? '복사됨' : '복사'}
      </button>
    </li>
  );
}
