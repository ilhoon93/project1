'use client';

import { useState } from 'react';
import type { InvitationContent } from '@/types/invitation';
import { readGuestIdentity } from '../SignatureGate';

interface Props {
  vote: InvitationContent['vote'];
  invitationId: string;
  isPreview?: boolean;
  mode?: 'guest' | 'owner';
  ownerPicks?: { question_index: number; selected_option: number }[];
}

export function VoteSlide({ vote, invitationId, isPreview, mode = 'guest', ownerPicks }: Props) {
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
        <h2 className="mt-2 text-xl font-light">
          {mode === 'owner' ? '하객 투표 결과' : '함께 골라보기'}
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
// owner 모드 — 보기별 응답 분포 막대 그래프.
// ─────────────────────────────────────────────────────────────

function QuestionStats({
  qi,
  question,
  picks,
}: {
  qi: number;
  question: InvitationContent['vote']['questions'][number];
  picks: { selected_option: number }[];
}) {
  const total = picks.length;
  const distribution = question.options.map((_, oi) => picks.filter((p) => p.selected_option === oi).length);
  return (
    <article className="flex flex-col gap-3">
      <h3 className="text-center text-sm font-medium">
        Q{qi + 1}. {question.q}
      </h3>
      <p className="text-center text-xs text-muted-foreground">
        총 {total.toLocaleString()}명 응답
      </p>
      <div className="grid grid-cols-1 gap-2">
        {question.options.map((opt, oi) => {
          if (!opt.trim()) return null;
          const count = distribution[oi];
          const pct = total === 0 ? 0 : Math.round((count / total) * 100);
          return (
            <div
              key={oi}
              className="relative overflow-hidden rounded-md border border-[var(--mw-dot)] bg-white px-3 py-2.5 text-sm text-stone-900"
            >
              {/* 진행바 — 선택 비율(전체 응답 대비 %)에 비례한 폭. 0%면 폭 0. */}
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 bg-[var(--mw-accent)]/25 transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
              <span className="relative flex items-center justify-between gap-2">
                <span className="font-medium">{opt}</span>
                <span className="tabular-nums text-xs text-muted-foreground">
                  {count} ({pct}%)
                </span>
              </span>
            </div>
          );
        })}
      </div>
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
                  // 흰 배경 + 어두운 글자 고정 — 어두운 테마에서도 가독성 보장.
                  : 'border-[var(--mw-dot)] bg-white text-stone-900 hover:bg-stone-50'
              } disabled:opacity-60`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {/* 투표 완료 안내 — 클릭 직후 하객에게 응답이 잘 전달됐다는 피드백.
          aria-live=polite 로 스크린리더에도 알림. */}
      {picked !== null && (
        <p
          role="status"
          aria-live="polite"
          className="text-center text-xs font-medium text-[var(--mw-accent)]"
        >
          ✓ 투표가 완료되었습니다. 참여해주셔서 감사합니다!
        </p>
      )}
    </article>
  );
}
