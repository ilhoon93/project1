'use client';

import { useRef, useState } from 'react';
import type { InvitationContent } from '@/types/invitation';
import { SignaturePad, type SignaturePadHandle } from '@/components/shared/SignaturePad';
import { persistGuestIdentity } from '../SignatureGate';

export interface GuestbookMessage {
  id: string;
  visitor_name: string;
  message: string;
  created_at: string;
}

interface Props {
  guestbook: InvitationContent['guestbook'];
  invitationId: string;
  /**
   * Kept for backwards compatibility with the prop signature; per the plan,
   * visitor messages are now PRIVATE — only the couple sees them in their
   * own admin view, never on the public invitation. We accept the prop but
   * never render the list to other guests.
   */
  initialMessages?: GuestbookMessage[];
  isPreview?: boolean;
}

export function GuestbookSlide({ guestbook, invitationId, isPreview }: Props) {
  const [name, setName] = useState('');
  const [side, setSide] = useState<'groom' | 'bride' | ''>('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const padRef = useRef<SignaturePadHandle>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) {
      setErrorMsg('개인정보 수집에 동의해주세요.');
      return;
    }
    if (!name.trim()) {
      setErrorMsg('이름을 입력해주세요.');
      return;
    }
    setErrorMsg(null);

    if (isPreview) {
      setSubmitted(true);
      return;
    }

    setSubmitting(true);
    const sig = padRef.current?.toDataURL() ?? null;

    try {
      // 1) Signature first — gives the couple the visitor's name + side + signature
      const sigRes = await fetch('/api/guest/signature', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          invitationId,
          visitorName: name.trim(),
          visitorSide: side || undefined,
          signatureData: sig,
          consentPersonalInfo: consent,
        }),
      });
      if (!sigRes.ok) {
        const data = await sigRes.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${sigRes.status}`);
      }

      // 2) Then the actual guestbook message
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

      persistGuestIdentity(invitationId, {
        name: name.trim(),
        side: side || null,
      });
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
        <p className="text-xs tracking-[0.3em] opacity-70">GUESTBOOK</p>
        <h2 className="mt-2 text-xl font-light">방명록</h2>
      </header>

      {guestbook.coupleMessage && (
        <p className="whitespace-pre-line rounded-md bg-white/60 p-4 text-center text-sm leading-relaxed text-[#5C4633]">
          {guestbook.coupleMessage}
        </p>
      )}

      <p className="text-center text-xs opacity-70">
        남기시는 메시지는 신랑신부에게만 전달되며, 다른 분들에게는 보이지 않습니다.
      </p>

      {submitted ? (
        <p className="text-center text-sm opacity-80">
          {isPreview
            ? '미리보기에서는 메시지가 저장되지 않습니다'
            : '메시지를 남겨주셔서 감사합니다 🙏'}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3" data-noswipe>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            required
            placeholder="이름"
            className="h-11 rounded-md border border-[#D4C5B0] bg-white px-3 text-sm outline-none focus:border-[#8B7355]"
          />

          <div className="flex gap-1.5">
            {[
              { v: 'groom', label: '신랑 측' },
              { v: 'bride', label: '신부 측' },
              { v: '', label: '선택 안 함' },
            ].map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setSide(opt.v as 'groom' | 'bride' | '')}
                className={`flex-1 rounded-md border px-2 py-2 text-xs ${
                  side === opt.v
                    ? 'border-[#8B7355] bg-[#8B7355] text-white'
                    : 'border-[#D4C5B0] bg-white text-[#3D2E1F]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={300}
            required
            rows={3}
            placeholder="축하 메시지를 남겨주세요"
            className="resize-none rounded-md border border-[#D4C5B0] bg-white px-3 py-2 text-sm outline-none focus:border-[#8B7355]"
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-[#8B7355]">서명 (선택)</span>
            <SignaturePad ref={padRef} width={304} height={120} />
            <button
              type="button"
              onClick={() => padRef.current?.clear()}
              className="self-end text-xs text-[#8B7355] hover:underline"
            >
              지우기
            </button>
          </div>

          <label className="flex items-start gap-2 text-xs text-[#5C4633]">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              개인정보(이름·메시지·서명) 수집에 동의합니다. 결혼식 후 30일간 보관됩니다.
            </span>
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
    </section>
  );
}
