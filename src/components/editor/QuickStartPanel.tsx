'use client';

import { useState } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';
import { DesignPreset } from './DesignPreset';
import { CompositionPreset } from './CompositionPreset';

/**
 * "추천으로 시작하기" — 에디터 맨 위 접이식 패널.
 *
 * 추천 디자인(표지 룩)과 추천 구성(슬라이드 묶음)을 각각 골라 빠르게 시작한다.
 * 두 선택 모두 내용(이름·사진·계좌·글)은 보존하고 스타일/노출만 바꾼다.
 *
 * defaultOpen: 한 번도 저장 안 된 신규 알림장이면 펼쳐서 안내, 그 외엔 접힘.
 */
export function QuickStartPanel({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    // 다른 섹션 카드(중립 bg-card)와 구분되도록 프라이머리 톤으로 강조한다.
    <section className="overflow-hidden rounded-lg border border-primary/40 bg-primary/5 text-card-foreground shadow-sm ring-1 ring-primary/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-primary">
            <Sparkles size={14} className="shrink-0" />
            추천으로 시작하기
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            추천 디자인·구성을 골라 빠르게 시작해요.
          </p>
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-primary/70 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div className="flex flex-col gap-5 border-t border-primary/20 bg-background px-4 py-4">
          <DesignPreset />
          <CompositionPreset />
        </div>
      )}
    </section>
  );
}
