'use client';

import { useState, type PointerEvent, type ReactNode } from 'react';
import { ChevronDown, GripVertical } from 'lucide-react';

/**
 * 섹션 카드를 드래그앤드롭으로 재배치하기 위한 props.
 * 부모(에디터 클라이언트)가 pageOrder 를 관리한다. 마우스·터치를 모두 지원하기
 * 위해 네이티브 HTML5 DnD 대신 Pointer Events 를 쓴다 — 카드가 닫혀 있을 때만
 * 그립 핸들을 눌러 드래그를 시작하고(부모가 window 리스너로 이동/드롭 추적),
 * 카드 element 의 `data-section-key` 로 드롭 대상을 식별한다. 메인/엔딩처럼
 * 위치 고정 섹션은 `enabled: false` 로 내려와 핸들이 표시되지 않는다.
 */
export interface SectionDragProps {
  enabled: boolean;
  /** 이 카드가 지금 드래그 중인 원본인지 — 원본은 자리만 비워두는 placeholder 로 흐려진다. */
  dragging: boolean;
  /** getBoundingClientRect / 드롭 위치 계산을 위한 식별자(섹션 키). */
  sectionKey: string;
  /** 그립 핸들에 포인터가 눌렸을 때(마우스/터치 공통) 드래그 시작 — 시작 좌표 전달. */
  onDragStart: (clientX: number, clientY: number) => void;
}

interface Props {
  title: string;
  description?: string;
  toggle?: { enabled: boolean; onChange: (next: boolean) => void };
  defaultOpen?: boolean;
  drag?: SectionDragProps;
  children: ReactNode;
}

/**
 * Collapsible section card. Each invitation slide gets one of these.
 * The optional `toggle` prop wires up an enabled/disabled switch
 * (sections like quiz/vote/video are off by default).
 */
export function SectionEditor({ title, description, toggle, defaultOpen = false, drag, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const enabled = toggle?.enabled ?? true;

  // 카드가 닫혀 있을 때만 그립을 노출 — 열려 있으면 입력 폼과 충돌하지 않도록 숨긴다.
  const showGrip = !!drag?.enabled && !open;

  const handleGripPointerDown = (e: PointerEvent) => {
    // 마우스는 좌클릭만. 터치/펜은 그대로 시작.
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // 텍스트 선택/스크롤 시작 방지(그립의 touch-action:none 과 함께 동작).
    e.preventDefault();
    drag?.onDragStart(e.clientX, e.clientY);
  };

  return (
    <section
      data-section-key={drag?.enabled ? drag.sectionKey : undefined}
      className={`overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm transition-all ${
        drag?.dragging ? 'opacity-40' : ''
      }`}
    >
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        {showGrip && (
          <button
            type="button"
            aria-label={`${title} 순서 변경 핸들 — 길게 눌러 드래그하세요`}
            title="드래그해서 순서 변경"
            onPointerDown={handleGripPointerDown}
            className="-ml-1 touch-none cursor-grab text-muted-foreground/60 active:cursor-grabbing"
          >
            <GripVertical size={16} />
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center justify-between text-left"
          aria-expanded={open}
        >
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <ChevronDown
            size={16}
            className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {toggle && (
          <SwitchControl
            checked={enabled}
            onChange={toggle.onChange}
            label={`${title} 사용 여부`}
          />
        )}
      </header>

      {open && enabled && (
        <div className="border-t bg-background px-4 py-4">{children}</div>
      )}
      {open && !enabled && (
        <div className="border-t bg-background px-4 py-4 text-xs text-muted-foreground">
          이 섹션은 꺼져 있습니다. 위 스위치를 켜면 편집할 수 있습니다.
        </div>
      )}
    </section>
  );
}

function SwitchControl({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`inline-flex h-5 w-9 shrink-0 items-center overflow-hidden rounded-full p-0.5 transition-colors ${
        checked ? 'bg-primary' : 'bg-muted-foreground/30'
      }`}
    >
      <span
        className={`block h-4 w-4 rounded-full bg-background shadow-sm transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
