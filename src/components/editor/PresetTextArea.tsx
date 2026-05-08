'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 추천 문구 콤보박스 버튼 — 클릭하면 portal 패널이 펼쳐지고 항목을 클릭하면 onPick 호출.
 *
 * 단독 사용:
 *   <PresetPickerButton label="추천 인사말" presets={...} value={text} onPick={setText} />
 *
 * PresetTextArea 도 내부적으로 이 컴포넌트를 사용한다 — 라벨 옆 우측에 자동 배치.
 */
export function PresetPickerButton({
  label,
  presets,
  value,
  onPick,
  size = 'sm',
  className,
}: {
  label: string;
  presets: readonly string[];
  /** 선택된 항목 강조용 (선택사항). */
  value?: string;
  onPick: (preset: string) => void;
  size?: 'xs' | 'sm';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // 위치 계산 — 화면 아래 공간이 부족하면 자동으로 위쪽으로 띄움 (flip-up).
  useLayoutEffect(() => {
    if (!open) return;
    const recalc = () => {
      const btn = buttonRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const desiredWidth = Math.min(320, window.innerWidth - 16);
      let left = r.right - desiredWidth;
      if (left < 8) left = 8;

      const GAP = 4;
      const PADDING = 8;
      const spaceBelow = window.innerHeight - r.bottom - GAP - PADDING;
      const spaceAbove = r.top - GAP - PADDING;
      const placeAbove = spaceBelow < 200 && spaceAbove > spaceBelow;
      const maxH = Math.max(160, Math.min(384, placeAbove ? spaceAbove : spaceBelow));
      const top = placeAbove ? r.top - GAP - maxH : r.bottom + GAP;
      setPanelPos({ top, left, width: desiredWidth, maxHeight: maxH });
    };
    recalc();
    window.addEventListener('resize', recalc);
    window.addEventListener('scroll', recalc, true);
    return () => {
      window.removeEventListener('resize', recalc);
      window.removeEventListener('scroll', recalc, true);
    };
  }, [open]);

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

  const sizeClasses =
    size === 'xs'
      ? 'h-6 gap-0.5 px-1.5 text-[10px]'
      : 'gap-1 px-2 py-1 text-[11px]';

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          'inline-flex items-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
          sizeClasses,
          className,
        )}
      >
        {label}
        <ChevronDown
          size={size === 'xs' ? 10 : 12}
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {mounted && open && panelPos &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            aria-label={label}
            className="fixed z-[200] overflow-hidden rounded-md border border-input bg-background shadow-xl"
            style={{
              top: panelPos.top,
              left: panelPos.left,
              width: panelPos.width,
              maxHeight: panelPos.maxHeight,
              overflowY: 'auto',
            }}
          >
            <ul className="flex flex-col divide-y divide-input/70">
              {presets.map((preset, i) => {
                const selected = value !== undefined && preset === value;
                return (
                  <li key={i}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        onPick(preset);
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
    </>
  );
}

/**
 * 라벨 + 추천 문구 버튼 + textarea 를 한 묶음으로 보여 주는 헬퍼.
 *
 * 라벨이 없는 자리(예: 기본정보 SubHeader 안에 추천 버튼을 직접 배치) 에서는
 * 이 컴포넌트 대신 PresetPickerButton + TextAreaField 를 따로 조합하면 된다.
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
  return (
    <div className={cn('flex flex-col gap-1.5 text-sm', className)}>
      <div className="flex items-center justify-between gap-2">
        {label ? (
          <span className="font-medium text-foreground">{label}</span>
        ) : (
          <span />
        )}
        <PresetPickerButton
          label={presetLabel}
          presets={presets}
          value={value}
          onPick={onChange}
        />
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
    </div>
  );
}
