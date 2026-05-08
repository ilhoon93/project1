'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 추천 문구를 콤보박스처럼 펼쳐 고를 수 있는 텍스트 영역.
 *
 * - 폰트 콤보박스(MainEditor 의 TitleTextCombobox/FontPicker) 와 같은 패턴
 * - 추천 문구 항목을 클릭하면 즉시 textarea 에 채워지고 패널 닫힘
 * - 마음에 안 들면 그대로 textarea 에서 자유롭게 편집 가능
 *
 * 외부 클릭 / ESC 로도 패널이 닫힌다. 항목이 길어도 panel 자체가 스크롤되지 않게
 * max-h + overflow-y-auto 를 제공.
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
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      const node = wrapRef.current;
      if (!node) return;
      if (e.target instanceof Node && node.contains(e.target)) return;
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
  }, []);

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

      <div ref={wrapRef} className="relative">
        <textarea
          value={value}
          rows={rows}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          // 콤보박스 본체 — 일반 TextAreaField 와 동일한 스타일.
          className="min-h-[80px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
        />

        {open && (
          <ul
            role="listbox"
            aria-label={presetLabel}
            className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-md border border-input bg-background shadow-lg"
          >
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
                    className={`flex w-full flex-col items-start gap-0.5 whitespace-pre-line border-b border-input/40 px-3 py-2 text-left text-[13px] leading-relaxed transition-colors last:border-b-0 ${
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
        )}
      </div>

      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}
