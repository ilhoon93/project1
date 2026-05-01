'use client';

import { useState } from 'react';
import type { InvitationContent } from '@/types/invitation';
import { readGuestIdentity } from '../SignatureGate';

interface Props {
  vote: InvitationContent['vote'];
  invitationId: string;
  isPreview?: boolean;
}

export function VoteSlide({ vote, invitationId, isPreview }: Props) {
  const playable = vote.questions
    .map((q, qi) => ({ q, qi }))
    .filter(({ q }) => q.q.trim() && q.options.every((opt) => opt.trim()));

  if (playable.length === 0) {
    return (
      <section className="flex min-h-full flex-col items-center justify-center gap-3 px-6 py-16">
        <h2 className="text-xl font-light">투표</h2>
        <p className="text-sm opacity-70">등록된 투표가 없습니다</p>
      </section>
    );
  }

  return (
    <section className="flex min-h-full flex-col gap-8 px-6 py-16">
      <header className="text-center">
        <p className="text-xs tracking-[0.3em] opacity-70">VOTE</p>
        <h2 className="mt-2 text-xl font-light">함께 골라보기</h2>
      </header>

      <div className="flex flex-col gap-8">
        {playable.map(({ q, qi }) => (
          <Question
            key={qi}
            qi={qi}
            question={q}
            invitationId={invitationId}
            isPreview={isPreview}
          />
        ))}
      </div>
    </section>
  );
}

function Question({
  qi,
  question,
  invitationId,
  isPreview,
}: {
  qi: number;
  question: InvitationContent['vote']['questions'][number];
  invitationId: string;
  isPreview?: boolean;
}) {
  const [picked, setPicked] = useState<number | null>(null);

  const handlePick = async (oi: number) => {
    if (picked !== null) return; // one vote per question
    setPicked(oi);
    if (isPreview) return;
    const identity = readGuestIdentity(invitationId);
    void fetch('/api/guest/vote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        invitationId,
        visitorName: identity.name ?? undefined,
        questionIndex: qi,
        selectedOption: oi,
      }),
    }).catch(() => {});
  };

  return (
    <article className="flex flex-col gap-3">
      <h3 className="text-center text-sm font-medium">
        Q{qi + 1}. {question.q}
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {question.options.map((opt, oi) => {
          const isPicked = picked === oi;
          return (
            <button
              key={oi}
              type="button"
              disabled={picked !== null}
              onClick={() => void handlePick(oi)}
              className={`rounded-md border px-3 py-6 text-center text-sm font-medium transition-colors ${
                isPicked
                  ? 'border-[var(--mw-accent)] bg-[var(--mw-accent)] text-white'
                  : 'border-[var(--mw-dot)] bg-white/80 text-[var(--mw-fg)] hover:bg-white'
              } disabled:opacity-60`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </article>
  );
}
