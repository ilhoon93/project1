'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SignaturePad, type SignaturePadHandle } from '@/components/shared/SignaturePad';

interface Props {
  invitationId: string;
  /** When true (preview mode for the author), the gate is bypassed entirely. */
  disabled?: boolean;
  children: ReactNode;
}

interface StoredIdentity {
  name: string | null;
  side: 'groom' | 'bride' | null;
}

const storageKey = (id: string) => `wedding-guest:${id}`;

/** Event name MainSlide dispatches when the 입장하기 button is clicked. */
export const SIGNATURE_GATE_OPEN_EVENT = 'wedding:open-signature-gate';

export function openSignatureGate() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(SIGNATURE_GATE_OPEN_EVENT));
}

export function SignatureGate({ invitationId, disabled, children }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [side, setSide] = useState<'groom' | 'bride' | ''>('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const padRef = useRef<SignaturePadHandle>(null);

  // Auto-open on first visit only respects `disabled` (skip in author preview).
  useEffect(() => {
    if (disabled) return;
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(storageKey(invitationId));
    if (!stored) setOpen(true);
  }, [invitationId, disabled]);

  // Manual open via 입장하기 button works even in preview, so authors can
  // verify the popup. Submission is a no-op in preview (handleSubmit below).
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(SIGNATURE_GATE_OPEN_EVENT, handler);
    return () => window.removeEventListener(SIGNATURE_GATE_OPEN_EVENT, handler);
  }, []);

  const persistIdentity = (identity: StoredIdentity) => {
    window.localStorage.setItem(storageKey(invitationId), JSON.stringify(identity));
  };

  const handleSkip = () => {
    if (!disabled) persistIdentity({ name: null, side: null });
    setOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) {
      setErrorMsg('개인정보 수집에 동의해주세요.');
      return;
    }
    if (!name.trim()) {
      setErrorMsg('성함을 입력해주세요.');
      return;
    }
    setErrorMsg(null);

    // Author preview: skip API call entirely so the button feels real but
    // doesn't add bogus signatures to the live invitation.
    if (disabled) {
      setOpen(false);
      return;
    }
    setSubmitting(true);

    const sig = padRef.current?.toDataURL() ?? null;

    try {
      const res = await fetch('/api/guest/signature', {
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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      persistIdentity({ name: name.trim(), side: side || null });
      setOpen(false);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '제출 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {children}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-sm rounded-lg bg-[#FAF7F2] p-5 shadow-2xl"
          >
            <h2 className="text-base font-semibold text-[#3D2E1F]">
              방문해주셔서 감사합니다
            </h2>
            <p className="mt-1 text-xs text-[#8B7355]">
              간단히 서명을 남겨주시면 신랑신부에게 전달됩니다
            </p>

            <div className="mt-4 flex flex-col gap-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                placeholder="성함"
                className="h-10 rounded-md border border-[#D4C5B0] bg-white px-3 text-sm outline-none focus:border-[#8B7355]"
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
                  개인정보(이름·서명) 수집에 동의합니다. 결혼식 후 30일간 보관됩니다.
                </span>
              </label>

              {errorMsg && (
                <p role="alert" className="text-xs text-destructive">
                  {errorMsg}
                </p>
              )}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={handleSkip}
                disabled={submitting}
                className="flex-1 rounded-md border border-[#D4C5B0] bg-white py-2.5 text-sm text-[#5C4633]"
              >
                건너뛰기
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-md bg-[#8B7355] py-2.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {submitting ? '제출 중...' : '서명하기'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

/**
 * Read the guest identity for the given invitation. Returns nulls when
 * the visitor hasn't signed (or skipped).
 */
export function readGuestIdentity(invitationId: string): StoredIdentity {
  if (typeof window === 'undefined') return { name: null, side: null };
  const raw = window.localStorage.getItem(storageKey(invitationId));
  if (!raw) return { name: null, side: null };
  try {
    return JSON.parse(raw) as StoredIdentity;
  } catch {
    return { name: null, side: null };
  }
}
