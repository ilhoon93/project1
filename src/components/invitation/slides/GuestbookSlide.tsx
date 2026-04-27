'use client';

import { useState } from 'react';
import type { InvitationContent } from '@/types/invitation';

export interface GuestbookMessage {
  id: string;
  visitor_name: string;
  message: string;
  created_at: string;
}

interface Props {
  guestbook: InvitationContent['guestbook'];
  invitationId: string;
  initialMessages: GuestbookMessage[];
  isPreview?: boolean;
}

export function GuestbookSlide({ guestbook, invitationId, initialMessages, isPreview }: Props) {
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [messages, setMessages] = useState(initialMessages);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) {
      setErrorMsg('개인정보 수집에 동의해주세요.');
      return;
    }
    setErrorMsg(null);

    if (isPreview) {
      setSubmitted(true);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/guest/guestbook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          invitationId,
          visitorName: name.trim(),
          message: message.trim(),
          consentPersonalInfo: consent,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      // Optimistic prepend
      setMessages((prev) => [data.message as GuestbookMessage, ...prev]);
      setSubmitted(true);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '제출 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="flex min-h-full flex-col gap-6 px-6 py-16">
      <header className="text-center">
        <p className="text-xs tracking-[0.3em] text-[#8B7355]">GUESTBOOK</p>
        <h2 className="mt-2 text-xl font-light">방명록</h2>
      </header>

      {guestbook.coupleMessage && (
        <p className="whitespace-pre-line rounded-md bg-white/60 p-4 text-center text-sm leading-relaxed text-[#5C4633]">
          {guestbook.coupleMessage}
        </p>
      )}

      {submitted ? (
        <p className="text-center text-sm text-[#8B7355]">
          {isPreview
            ? '미리보기에서는 메시지가 저장되지 않습니다'
            : '메시지를 남겨주셔서 감사합니다 🙏'}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            required
            placeholder="이름"
            className="h-11 rounded-md border border-[#D4C5B0] bg-white px-3 text-sm outline-none focus:border-[#8B7355]"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={300}
            required
            rows={3}
            placeholder="축하 메시지를 남겨주세요"
            className="resize-none rounded-md border border-[#D4C5B0] bg-white px-3 py-2 text-sm outline-none focus:border-[#8B7355]"
          />
          <label className="flex items-start gap-2 text-xs text-[#5C4633]">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5"
            />
            <span>개인정보(이름·메시지) 수집에 동의합니다.</span>
          </label>

          {errorMsg && (
            <p role="alert" className="text-xs text-destructive">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="h-11 rounded-md bg-[#8B7355] text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? '저장 중...' : '메시지 남기기'}
          </button>
        </form>
      )}

      {messages.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-medium text-[#8B7355]">
            받은 메시지 ({messages.length})
          </h3>
          <ul className="flex flex-col gap-2">
            {messages.map((m) => (
              <li
                key={m.id}
                className="rounded-md bg-white px-3 py-2.5 ring-1 ring-[#D4C5B0]"
              >
                <p className="text-xs font-medium text-[#8B7355]">{m.visitor_name}</p>
                <p className="mt-0.5 whitespace-pre-line text-sm text-[#3D2E1F]">{m.message}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
