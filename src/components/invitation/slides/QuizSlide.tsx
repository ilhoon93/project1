'use client';

import { useState } from 'react';
import type { InvitationContent } from '@/types/invitation';
import { readGuestIdentity } from '../SignatureGate';

interface Props {
  quiz: InvitationContent['quiz'];
  invitationId: string;
  isPreview?: boolean;
  mode?: 'guest' | 'owner';
  ownerPicks?: { question_index: number; selected_option: number; is_correct: boolean }[];
}

export function QuizSlide({ quiz, invitationId, isPreview, mode = 'guest', ownerPicks }: Props) {
  // Drafts may include questions without text or full options.
  // 질문(q.q) 만 비어 있지 않으면 렌더한다 — 옵션 일부가 비어 있어도 비어 있지 않은 보기만
  // 노출해 2번째 문항이 자동으로 사라지지 않게 함.
  const playable = quiz.questions
    .map((q, qi) => ({ q, qi }))
    .filter(({ q }) => q.q.trim());

  if (playable.length === 0) {
    return <EmptyState message="등록된 퀴즈가 없습니다" />;
  }

  return (
    <section className="flex min-h-full flex-col gap-8 px-6 py-16">
      <header className="text-center">
        <p className="text-xs tracking-[0.3em] opacity-70">QUIZ</p>
        <h2 className="mt-2 text-xl font-light">
          {mode === 'owner' ? '하객 퀴즈 결과' : '우리의 시간, 얼마나 알고 있나요?'}
        </h2>
      </header>

      <div className="flex flex-col gap-8">
        {playable.map(({ q, qi }) =>
          mode === 'owner' ? (
            <QuestionStats
              key={qi}
              qi={qi}
              question={q}
              picks={(ownerPicks ?? []).filter((p) => p.question_index === qi)}
            />
          ) : (
            <Question
              key={qi}
              qi={qi}
              question={q}
              invitationId={invitationId}
              isPreview={isPreview}
            />
          ),
        )}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// owner 모드 — 선택 기능 대신 정답률 + 보기별 응답 분포 표시.
// ─────────────────────────────────────────────────────────────

function QuestionStats({
  qi,
  question,
  picks,
}: {
  qi: number;
  question: InvitationContent['quiz']['questions'][number];
  picks: { selected_option: number; is_correct: boolean }[];
}) {
  const total = picks.length;
  const correct = picks.filter((p) => p.is_correct).length;
  const correctRate = total === 0 ? 0 : Math.round((correct / total) * 100);
  // 보기별 카운트 분포 (정답 옵션 강조).
  const distribution = question.options.map((_, oi) => picks.filter((p) => p.selected_option === oi).length);
  const max = Math.max(1, ...distribution);

  return (
    <article className="flex flex-col gap-3">
      <h3 className="text-sm font-medium">
        Q{qi + 1}. {question.q}
      </h3>
      <p className="text-xs text-muted-foreground">
        총 {total.toLocaleString()}명 응답 · 정답률{' '}
        <span className="font-semibold text-emerald-600">{correctRate}%</span>
      </p>
      <ul className="flex flex-col gap-2">
        {question.options.map((opt, oi) => {
          if (!opt.trim()) return null;
          const count = distribution[oi];
          const pct = total === 0 ? 0 : Math.round((count / total) * 100);
          const isAnswer = oi === question.answer;
          return (
            <li
              key={oi}
              className={`relative overflow-hidden rounded-md border px-3 py-2 text-sm ${
                isAnswer
                  ? 'border-emerald-500 bg-emerald-50/60 text-emerald-900'
                  : 'border-[var(--mw-dot)] bg-white text-stone-900'
              }`}
            >
              {/* 응답 분포를 막대 그래프 형태의 배경으로 표시 */}
              <span
                aria-hidden
                className={`absolute inset-y-0 left-0 ${
                  isAnswer ? 'bg-emerald-200/60' : 'bg-[var(--mw-accent)]/15'
                }`}
                style={{ width: `${(count / max) * 100}%` }}
              />
              <span className="relative flex items-center justify-between gap-2">
                <span>
                  {opt} {isAnswer && <span className="ml-1 text-[11px] text-emerald-600">정답</span>}
                </span>
                <span className="tabular-nums text-xs text-muted-foreground">
                  {count} ({pct}%)
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </article>
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
          // 비어 있는 보기는 건너뜀 — 2번째 문항이 일부만 채워져 있어도 화면에 보이도록.
          if (!opt.trim()) return null;
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
          {selected === question.answer ? '정답입니다 🎉' : `정답은 "${question.options[question.answer]}" 입니다`}
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
