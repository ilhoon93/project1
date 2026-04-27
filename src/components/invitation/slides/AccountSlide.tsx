'use client';

import { useState } from 'react';
import type { InvitationContent, BankAccount } from '@/types/invitation';

export function AccountSlide({ account }: { account: InvitationContent['account'] }) {
  const [side, setSide] = useState<'groom' | 'bride'>('groom');
  const list = side === 'groom' ? account.groom : account.bride;

  return (
    <section className="flex min-h-full flex-col gap-6 px-6 py-16">
      <header className="text-center">
        <p className="text-xs tracking-[0.3em] text-[#8B7355]">ACCOUNT</p>
        <h2 className="mt-2 text-xl font-light">마음 전하실 곳</h2>
      </header>

      <div className="flex justify-center gap-2">
        <Tab active={side === 'groom'} onClick={() => setSide('groom')}>
          신랑 측
        </Tab>
        <Tab active={side === 'bride'} onClick={() => setSide('bride')}>
          신부 측
        </Tab>
      </div>

      {list.length === 0 ? (
        <p className="text-center text-sm text-[#8B7355]">등록된 계좌가 없습니다</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((acct, i) => (
            <AccountRow key={i} acct={acct} />
          ))}
        </ul>
      )}
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
        <span className="text-sm font-medium tracking-wide text-[#3D2E1F]">{acct.number}</span>
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
