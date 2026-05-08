'use client';

import { type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function TextField({
  label,
  hint,
  className,
  ...props
}: {
  label: string;
  hint?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <input
        className={cn(
          'h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-50',
          className,
        )}
        {...props}
      />
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function TextAreaField({
  label,
  hint,
  className,
  ...props
}: {
  label: string;
  hint?: string;
} & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const value = typeof props.value === 'string' ? props.value : '';
  const maxLength = typeof props.maxLength === 'number' ? props.maxLength : undefined;
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      {label && <span className="font-medium text-foreground">{label}</span>}
      <textarea
        className={cn(
          'min-h-[80px] resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30',
          className,
        )}
        {...props}
      />
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{hint}</span>
        {maxLength !== undefined && (
          <span
            className={cn(
              'tabular-nums',
              value.length >= maxLength * 0.9 && 'text-foreground/80',
              value.length >= maxLength && 'text-destructive',
            )}
          >
            {value.length} / {maxLength}
          </span>
        )}
      </div>
    </label>
  );
}
