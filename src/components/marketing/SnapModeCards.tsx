'use client';

/**
 * `/wedding-snap` 소개 페이지의 "HOW TO INPUT" 섹션 — 사진을 모두 빼고 모드별
 * 설명 + "예시 보기" 버튼만. 클릭 시 ExampleFlowModal 이 띄움.
 *
 * 사진은 사용자가 보기에 정적이고 무거우니 만들기 페이지에서 쓰던 풍부한
 * 시퀀스 모달(ExampleFlowModal)에 위임 — 같은 자산을 일관되게 보여줌.
 */

import { useState } from 'react';
import {
  ExampleFlowModal,
  type ExampleFlowMode,
} from '@/components/snap/ExampleFlowModal';

export function SnapModeCards() {
  const [openMode, setOpenMode] = useState<ExampleFlowMode | null>(null);
  return (
    <>
      <div className="grid gap-3 lg:grid-cols-2">
        {/* MODE A — 커플사진 (강조: 가입 1크레딧 즉시 체험 가능). */}
        <article className="relative flex flex-col gap-3 overflow-hidden rounded-2xl border-[1.5px] border-[var(--wd-coral)] bg-[var(--wd-cream)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-italiana text-[10px] tracking-[0.24em] text-[var(--wd-coral)]">
                MODE A
              </p>
              <h3 className="mt-1 text-[15px] font-medium text-[var(--wd-ink)]">
                커플사진 한 장으로
              </h3>
            </div>
            <ExampleButton onClick={() => setOpenMode('couple')} variant="primary" />
          </div>
          <div>
            <p className="text-[12px] leading-relaxed text-[var(--wd-mute)]">
              커플사진을 바로 카탈로그에 적용해 한 컷당 1크레딧으로 만들어요.
            </p>
          </div>
        </article>

        {/* MODE B — 셀카 + 앵커. 솔로/함께 흐름 안내. */}
        <article className="flex flex-col gap-3 rounded-2xl border border-[var(--wd-line)] bg-[var(--wd-paper)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-italiana text-[10px] tracking-[0.24em] text-[var(--wd-coral)]">
                MODE B
              </p>
              <h3 className="mt-1 text-[15px] font-medium text-[var(--wd-ink)]">
                각자 셀카로 — 솔로 · 함께 컷 모두
              </h3>
            </div>
            <ExampleButton onClick={() => setOpenMode('selfies')} />
          </div>
          <div>
            <p className="text-[12px] leading-relaxed text-[var(--wd-mute)]">
              신랑·신부 각각의 사진을 올리면 AI가 <strong>앵커</strong>(나만의 기준
              얼굴)을 만들어요. 이 앵커를 카탈로그 컷에 적용해{' '}
              <strong>신랑 단독 · 신부 단독 · 함께 컷</strong> 3 가지를 모두 만들 수
              있어요.
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--wd-ink)]/70">
              ※ <strong>결제 사용자에게 최초 1회</strong> 앵커 무료 생성 혜택이
              제공됩니다.
            </p>
          </div>
        </article>
      </div>

      <ExampleFlowModal mode={openMode} onClose={() => setOpenMode(null)} />
    </>
  );
}

function ExampleButton({
  onClick,
  variant,
}: {
  onClick: () => void;
  variant?: 'primary';
}) {
  const cls =
    variant === 'primary'
      ? 'bg-[var(--wd-ink)] text-[var(--wd-cream)] hover:bg-[var(--wd-ink)]/90'
      : 'border border-[var(--wd-ink)]/25 bg-[var(--wd-paper)] text-[var(--wd-ink)] hover:bg-[var(--wd-ink)]/8';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 self-start whitespace-nowrap rounded-full px-3.5 py-2 text-[12px] font-medium transition-colors ${cls}`}
    >
      예시 보기 →
    </button>
  );
}
