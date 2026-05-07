'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  // Default to '신랑' (groom) — the "선택 안 함" option was dropped per the
  // design pass; if a guest doesn't want to pick, they can still leave a
  // message and the side just defaults.
  const [side, setSide] = useState<'groom' | 'bride'>('groom');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // 서명은 팝업에서 작성 → 확인 시 dataURL 을 state 에 캐싱한 뒤 폼 제출 시 사용.
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [showSigPopup, setShowSigPopup] = useState(false);

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

    try {
      // 1) Signature first — gives the couple the visitor's name + side + signature
      const sigRes = await fetch('/api/guest/signature', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          invitationId,
          visitorName: name.trim(),
          visitorSide: side,
          signatureData,
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
        side,
      });
      setSubmitted(true);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '제출 실패');
    } finally {
      setSubmitting(false);
    }
  };

  // 입력 필드 공용 클래스 — 어두운 테마에서도 글씨가 잘 보이도록 강제 텍스트 색을
  // stone-900 으로 고정. 흰 배경 + 짙은 글자 조합은 모든 테마에서 안전하다.
  const inputBaseClass =
    'rounded-md border border-[var(--mw-dot)] bg-white text-stone-900 placeholder:text-stone-400 outline-none focus:border-[var(--mw-accent)]';

  return (
    // 입력부를 전체적으로 아래로 내리기 위해 상단 패딩을 늘리고 헤더 마진을 추가.
    <section className="flex min-h-full flex-col gap-6 px-6 pb-16 pt-24">
      <header className="text-center">
        <p className="text-xs tracking-[0.3em] opacity-70">GUESTBOOK</p>
        <h2 className="mt-2 text-xl font-light">방명록</h2>
      </header>

      {guestbook.coupleMessage && (
        <>
          {/* 메시지 상단 디바이더 — 헤더와 메시지를 시각적으로 구분 */}
          <GuestbookDivider />
          <p className="whitespace-pre-line text-center text-sm leading-relaxed">
            {guestbook.coupleMessage}
          </p>
        </>
      )}

      {/* 신랑신부 메시지와 입력부 사이 디바이더 — 가는 라인 + 가운데 ✦ */}
      <GuestbookDivider />

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
          {/* 이름 + 신랑/신부 + 서명하기 버튼을 한 줄에 배치.
              이름 박스는 고정 너비(w-20) 로 줄이고 나머지 버튼은 가용 공간을 자연스럽게 차지. */}
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              required
              placeholder="이름"
              className={`h-9 w-20 shrink-0 px-2 text-sm ${inputBaseClass}`}
            />
            {[
              { v: 'groom', label: '신랑측' },
              { v: 'bride', label: '신부측' },
            ].map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setSide(opt.v as 'groom' | 'bride')}
                className={`h-9 shrink-0 rounded-md border px-2 text-[11px] font-medium transition-colors ${
                  side === opt.v
                    ? 'border-[var(--mw-accent)] bg-[var(--mw-accent)] text-white shadow-sm'
                    : 'border-[var(--mw-dot)] bg-white text-stone-700 hover:bg-stone-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowSigPopup(true)}
              className={`ml-auto h-9 shrink-0 rounded-md border px-2.5 text-[11px] font-medium transition-colors ${
                signatureData
                  ? 'border-[var(--mw-accent)] bg-[var(--mw-accent)] text-white shadow-sm'
                  : 'border-[var(--mw-accent)] bg-white text-[var(--mw-accent)] hover:bg-[var(--mw-accent)] hover:text-white'
              }`}
            >
              {signatureData ? '서명하기 ✓' : '서명하기 (선택)'}
            </button>
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={300}
            required
            rows={3}
            placeholder="축하 메시지를 남겨주세요"
            className={`resize-none px-3 py-2 text-sm ${inputBaseClass}`}
          />

          <label className="flex items-start gap-2 text-xs opacity-80">
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
            className="mx-auto h-9 rounded-md bg-[var(--mw-accent)] px-6 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? '저장 중...' : '메시지 남기기'}
          </button>
        </form>
      )}

      {showSigPopup && (
        <SignaturePopup
          initialData={signatureData}
          onClose={() => setShowSigPopup(false)}
          onConfirm={(data) => {
            setSignatureData(data);
            setShowSigPopup(false);
          }}
        />
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// 디바이더 — 신랑신부 메시지와 입력부를 시각적으로 구분
// ─────────────────────────────────────────────────────────────

function GuestbookDivider() {
  return (
    <div
      aria-hidden
      className="mx-auto flex w-full max-w-[12rem] items-center justify-center gap-3 opacity-60"
    >
      <span className="h-px flex-1 bg-current" style={{ opacity: 0.55 }} />
      <span className="text-[0.85em] leading-none">✦</span>
      <span className="h-px flex-1 bg-current" style={{ opacity: 0.55 }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 서명 팝업 — 서명의 의미 안내 + SignaturePad. 확인 시 dataURL 을 부모로 전달.
// ─────────────────────────────────────────────────────────────

function SignaturePopup({
  initialData,
  onClose,
  onConfirm,
}: {
  initialData: string | null;
  onClose: () => void;
  onConfirm: (data: string | null) => void;
}) {
  const padRef = useRef<SignaturePadHandle>(null);
  const [mounted, setMounted] = useState(false);

  // SSR 시 document 가 없으므로 마운트 후에만 portal 을 렌더한다.
  // 슬라이드 컨테이너의 transform / containerType 이 fixed positioning 을
  // 가두기 때문에 body 로 portal 해야 화면 전체에 모달이 깔린다.
  useEffect(() => {
    setMounted(true);
  }, []);

  // ESC 닫기 + 배경 스크롤 잠금.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  if (!mounted) return null;

  const node = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="서명"
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      data-noswipe
    >
      {/* 백드롭 — 클릭 시 닫기 */}
      <button
        type="button"
        aria-label="서명 닫기"
        onClick={onClose}
        className="absolute inset-0 bg-black/55"
      />

      {/* 팝업 본체 — 카드. 흰 배경 고정으로 모든 테마에서 가독성 보장. */}
      <div className="relative z-10 flex w-full max-w-md flex-col gap-3 rounded-xl bg-white p-5 text-stone-900 shadow-2xl">
        <header className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold">서명 남기기</h3>
            <p className="mt-1 text-xs leading-relaxed text-stone-600">
              서명은 신랑신부에게 마음을 담아 전하는 작은 인사입니다. 작성하신 서명은
              다른 분들에게는 보이지 않고, 신랑신부에게만 전달됩니다.
            </p>
          </div>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-lg leading-none text-stone-500 hover:bg-stone-100"
          >
            ×
          </button>
        </header>

        {/* SignaturePad — 팝업이 열릴 때만 마운트되므로 캔버스 ref 도 새로 생성된다. */}
        <SignaturePad ref={padRef} height={160} />

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => padRef.current?.clear()}
            className="text-xs font-medium text-stone-500 hover:underline"
          >
            지우기
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-md border border-stone-300 px-3 text-xs font-medium text-stone-700 hover:bg-stone-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => {
                const data = padRef.current?.toDataURL() ?? null;
                onConfirm(data);
              }}
              className="h-9 rounded-md bg-[var(--mw-accent)] px-4 text-xs font-medium text-white hover:opacity-90"
            >
              확인
            </button>
          </div>
        </div>

        {initialData && (
          <p className="text-[11px] text-stone-500">
            기존 서명이 있습니다. 새로 그리지 않고 닫으면 기존 서명이 유지됩니다.
          </p>
        )}
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
