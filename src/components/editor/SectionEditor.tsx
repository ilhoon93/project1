'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface Props {
  title: string;
  description?: string;
  toggle?: { enabled: boolean; onChange: (next: boolean) => void };
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * Collapsible section card. Each invitation slide gets one of these.
 * The optional `toggle` prop wires up an enabled/disabled switch
 * (sections like quiz/vote/video are off by default).
 */
export function SectionEditor({ title, description, toggle, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const enabled = toggle?.enabled ?? true;

  return (
    <section className="overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
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
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-primary' : 'bg-muted-foreground/30'
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
