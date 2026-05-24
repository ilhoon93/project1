'use client';

/**
 * 스냅 생성 페이지 상단의 진행 단계 인디케이터.
 *
 * 사용자가 어디까지 했고 다음에 뭐가 남았는지 한눈에 보여줘 "어디서 멈춰야 하지?"
 * 불안을 줄인다. 세로 섹션 레이아웃은 그대로 유지하고 위에 시각적 step bar 만 추가.
 *
 * 각 step 은 다음 4상태 중 하나:
 *   - 'done'     : 완료 (체크 + 강조 색)
 *   - 'active'   : 현재 진행 중 (테두리 강조)
 *   - 'pending'  : 아직 안 함 (회색)
 *   - 'skipped'  : 모드상 건너뛰는 단계 (예: couple 모드에서 앵커 단계 — dim 표시)
 *
 * mobile 에서도 한 줄에 들어가도록 라벨은 짧게.
 */

export interface SnapStep {
  n: number;
  label: string;
  status: 'done' | 'active' | 'pending' | 'skipped';
}

export function StepIndicator({ steps }: { steps: SnapStep[] }) {
  return (
    <ol
      aria-label="스냅 생성 진행 단계"
      className="flex items-center gap-2 overflow-x-auto rounded-md border border-[#E8DCC9] bg-white p-2.5"
    >
      {steps.map((s, idx) => {
        const isLast = idx === steps.length - 1;
        return (
          <li
            key={s.n}
            className="flex shrink-0 items-center gap-2 sm:flex-1 sm:shrink"
          >
            <div className="flex shrink-0 items-center gap-1.5">
              <StepDot status={s.status} n={s.n} />
              <span
                className={`whitespace-nowrap text-[11px] ${
                  s.status === 'done'
                    ? 'font-medium text-[#3D2E1F]'
                    : s.status === 'active'
                      ? 'font-medium text-[#3D2E1F]'
                      : s.status === 'skipped'
                        ? 'text-[#B0A289] line-through'
                        : 'text-[#8B7355]'
                }`}
              >
                {s.label}
              </span>
            </div>
            {!isLast && (
              <span
                aria-hidden
                className={`shrink-0 select-none text-base font-light leading-none ${
                  s.status === 'done' ? 'text-[#3D2E1F]' : 'text-[#D4C5B0]'
                } sm:ml-auto`}
              >
                →
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * 단계 인디케이터의 원형 dot.
 *   done    : 다크 배경 + 흰 ✓ (완료 표시 유지)
 *   active  : 두꺼운 다크 테두리 + 흰 배경 + 다크 숫자 (현재 단계 강조)
 *   pending : 연한 배경 + 회색 숫자 (아직 안 함, 숫자 명시)
 *   skipped : 연한 배경 + 회색 — (모드상 건너뛴 단계, 예: couple 모드의 앵커)
 */
function StepDot({ status, n }: { status: SnapStep['status']; n: number }) {
  const base =
    'grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold leading-none';
  if (status === 'done') {
    return <span className={`${base} bg-[#3D2E1F] text-white`} aria-hidden>✓</span>;
  }
  if (status === 'active') {
    return (
      <span
        className={`${base} border-2 border-[#3D2E1F] bg-white text-[#3D2E1F]`}
        aria-hidden
      >
        {n}
      </span>
    );
  }
  if (status === 'skipped') {
    return <span className={`${base} bg-[#F5EDE0] text-[#B0A289]`} aria-hidden>—</span>;
  }
  return (
    <span className={`${base} bg-[#F5EDE0] text-[#8B7355]`} aria-hidden>
      {n}
    </span>
  );
}
