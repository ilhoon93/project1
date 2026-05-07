'use client';

import { useState } from 'react';
import type { InvitationContent } from '@/types/invitation';
import { readGuestIdentity } from '../SignatureGate';

interface Props {
  quiz: InvitationContent['quiz'];
  invitationId: string;
  isPreview?: boolean;
}

export function QuizSlide({ quiz, invitationId, isPreview }: Props) {
  // Drafts may include questions without text or full options; only render
  // ones that are actually playable.
  const playable = quiz.questions
    .map((q, qi) => ({ q, qi }))
    .filter(
      ({ q }) => q.q.trim() && q.options.every((opt) => opt.trim()),
    );

  if (playable.length === 0) {
    return <EmptyState message="등록된 퀴즈가 없습니다" />;
  }

  return (
    <section className="flex min-h-full flex-col gap-8 px-6 py-16">
      <header className="text-center">
        <p className="text-xs tracking-[0.3em] opacity-70">QUIZ</p>
        <h2 className="mt-2 text-xl font-light">우리에 대한 퀴즈</h2>
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
  question: InvitationContent['quiz']['questions'][number];
  invitationId: string;
  isPreview?: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const isAnswered = selected !== null;

  const handlePick = async (oi: number) => {
    setSelected(oi);
    if (isPreview) return;
    const identity = readGuestIdentity(invitationId);
    void fetch('/api/guest/quiz', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        invitationId,
        visitorName: identity.name ?? undefined,
        questionIndex: qi,
        selectedOption: oi,
        isCorrect: oi === question.answer,
      }),
    }).catch(() => {});
  };

  return (
    <article className="flex flex-col gap-3">
      <h3 className="text-sm font-medium">
        Q{qi + 1}. {question.q}
      </h3>
      <ul className="flex flex-col gap-2">
        {question.options.map((opt, oi) => {
          const isPicked = selected === oi;
          const isCorrect = oi === question.answer;
          const showState = isAnswered;
          return (
            <li key={oi}>
              <button
                type="button"
                disabled={isAnswered}
                onClick={() => void handlePick(oi)}
                className={`w-full rounded-md border px-3 py-2.5 text-left text-sm transition-colors ${
                  showState && isCorrect
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : showState && isPicked && !isCorrect
                      ? 'border-rose-400 bg-rose-50 text-rose-700'
                      // 흰 배경 + 어두운 글자 고정 — 어두운 테마에서도 가독성 보장.
                      : 'border-[var(--mw-dot)] bg-white text-stone-900 hover:bg-stone-50'
                } disabled:cursor-default`}
              >
                {opt}
              </button>
            </li>
          );
        })}
      </ul>
      {isAnswered && (
        <p className="text-xs text-[var(--mw-accent)]">
          {selected === question.answer ? '정답입니다 🎉' : `정답은 "${question.options[question.answer]}" 였어요`}
        </p>
      )}
    </article>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <section className="flex min-h-full flex-col items-center justify-center gap-3 px-6 py-16">
      <h2 className="text-xl font-light">퀴즈</h2>
      <p className="text-sm opacity-70">{message}</p>
    </section>
  );
}
