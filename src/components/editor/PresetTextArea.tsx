'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 추천 문구를 콤보박스처럼 펼쳐 고를 수 있는 텍스트 영역.
 *
 * 동작 핵심:
 *  - "추천 문구" 버튼 바로 아래에서 패널이 열린다 (textarea 아래가 아님).
 *  - 패널은 portal 로 document.body 에 붙어 부모의 overflow / z-index 와
 *    무관하게 잘리지 않고 모두 보인다.
 *  - 항목 사이에는 명확한 구분선 + 적당한 padding 으로 가독성 확보.
 *  - 외부 클릭 / ESC / scroll / resize 시 자동 닫힘. 위치도 매번 재계산.
 *  - 마음에 안 들면 textarea 에서 자유롭게 편집 가능.
 */
export function PresetTextArea({
  label,
  hint,
  value,
  onChange,
  presets,
  presetLabel = '추천 문구',
  rows = 4,
  maxLength,
  placeholder,
  className,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (next: string) => void;
  presets: readonly string[];
  presetLabel?: string;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // 버튼 기준으로 절대 좌표를 계산해 portal 패널 위치를 잡는다.
  const [panelPos, setPanelPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // 위치 계산 — open 일 때마다 buttonRef bounding rect 기반으로 갱신.
  useLayoutEffect(() => {
    if (!open) return;
    const recalc = () => {
      const btn = buttonRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      // 버튼 아래 4px gap. 폭은 패널을 18rem 정도로 충분히 잡되, 화면을 벗어나지 않도록
      // 우측 정렬을 우선하고 좌측 limit 으로 보정.
      const desiredWidth = Math.min(320, window.innerWidth - 16);
      let left = r.right - desiredWidth;
      if (left < 8) left = 8;
      setPanelPos({ top: r.bottom + 4, left, width: desiredWidth });
    };
    recalc();
    window.addEventListener('resize', recalc);
    window.addEventListener('scroll', recalc, true);
    return () => {
      window.removeEventListener('resize', recalc);
      window.removeEventListener('scroll', recalc, true);
    };
  }, [open]);

  // 외부 클릭 / ESC 닫기.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const btn = buttonRef.current;
      const panel = panelRef.current;
      const target = e.target instanceof Node ? e.target : null;
      if (target && btn?.contains(target)) return;
      if (target && panel?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={cn('flex flex-col gap-1.5 text-sm', className)}>
      {/* 라벨 + 추천 문구 토글 — 라벨 줄 우측에 작은 chevron 버튼. */}
      <div className="flex items-center justify-between gap-2">
        {label ? (
          <span className="font-medium text-foreground">{label}</span>
        ) : (
          <span />
        )}
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="listbox"
          className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {presetLabel}
          <ChevronDown
            size={12}
            className={`transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      <textarea
        value={value}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[80px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
      />

      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}

      {/* 패널 — body 로 portal 해 부모 overflow 와 무관하게 보인다.
          위치는 useLayoutEffect 에서 버튼 rect 기준으로 매번 갱신. */}
      {mounted && open && panelPos && createPortal(
        <div
          ref={panelRef}
          role="listbox"
          aria-label={presetLabel}
          className="fixed z-[200] overflow-hidden rounded-md border border-input bg-background shadow-xl"
          style={{
            top: panelPos.top,
            left: panelPos.left,
            width: panelPos.width,
            maxHeight: 'min(60vh, 24rem)',
            overflowY: 'auto',
          }}
        >
          <ul className="flex flex-col divide-y divide-input/70">
            {presets.map((preset, i) => {
              const selected = preset === value;
              return (
                <li key={i}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onChange(preset);
                      setOpen(false);
                    }}
                    className={`flex w-full whitespace-pre-line px-3 py-3 text-left text-[13px] leading-relaxed transition-colors ${
                      selected
                        ? 'bg-foreground text-background'
                        : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    {preset}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  );
}
