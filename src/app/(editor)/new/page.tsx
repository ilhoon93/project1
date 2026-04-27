'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function NewInvitationPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const fd = new FormData(e.currentTarget);
    const payload = {
      groomName: String(fd.get('groomName') ?? '').trim(),
      brideName: String(fd.get('brideName') ?? '').trim(),
      weddingDate: (String(fd.get('weddingDate') ?? '').trim() || null) as string | null,
    };

    if (!payload.groomName || !payload.brideName) {
      setError('이름을 모두 입력해주세요.');
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create');
      router.push(`/edit/${data.invitation.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '알림장 생성에 실패했습니다.');
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">새 알림장 만들기</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          기본 정보를 입력하면 편집기로 이동합니다
        </p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="신랑 이름" name="groomName" placeholder="홍길동" required maxLength={20} />
          <Field label="신부 이름" name="brideName" placeholder="김영희" required maxLength={20} />
        </div>

        <Field label="결혼식 날짜 (선택)" name="weddingDate" type="date" />

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" disabled={submitting} className="mt-2 h-12">
          {submitting ? '생성 중...' : '편집 시작하기'}
        </Button>
      </form>
    </main>
  );
}

function Field({
  label,
  name,
  type = 'text',
  ...rest
}: {
  label: string;
  name: string;
  type?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <input
        name={name}
        type={type}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
        {...rest}
      />
    </label>
  );
}
