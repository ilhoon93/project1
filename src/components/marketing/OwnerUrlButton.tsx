'use client';

import { useEffect, useState } from 'react';

/**
 * 가격 카드의 "소장용 URL 예시" 보기 버튼 + 팝업 모달.
 *
 * 발행 후 신랑·신부에게 부여되는 owner_token URL 의 예시를 보여줘
 * "어떤 게 평생 남는지" 를 시각적으로 전달한다.
 */
export function OwnerUrlButton({ exampleUrl }: { exampleUrl?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--wd-ink)]/25 px-5 py-2.5 text-[13px] font-medium text-[var(--wd-ink)] transition-colors hover:border-[var(--wd-ink)]/50"
      >
        소장용 URL 예시 보기 →
      </button>

      {open && <OwnerUrlModal onClose={() => setOpen(false)} exampleUrl={exampleUrl} />}
    </>
  );
}

/** 관리자에서 세팅한 실 예시 owner URL 이 비었을 때 보여줄 placeholder. */
const PLACEHOLDER_URL =
  'https://wooridaun.com/i/minjun-seoyeon-2026?own=8a4f2c91-d3e7-4b06-9c2f-7e1a8b5d6e4f';

export function OwnerUrlModal({
  onClose,
  exampleUrl: exampleUrlProp,
}: {
  onClose: () => void;
  /** 관리자(/admin/home-samples)에서 세팅한 owner URL. 비면 placeholder. */
  exampleUrl?: string;
}) {
  const trimmed = (exampleUrlProp ?? '').trim();
  const exampleUrl = trimmed || PLACEHOLDER_URL;
  const hasReal = !!trimmed;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exampleUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard API 비지원 — 무시
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="owner-url-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl bg-[var(--wd-paper)] shadow-[0_40px_80px_rgba(31,27,23,0.32)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-[var(--wd-ink)]/65 transition-colors hover:bg-[var(--wd-ink)]/8 hover:text-[var(--wd-ink)]"
        >
          ✕
        </button>

        <div className="px-7 pb-7 pt-8 text-center">
          <p className="font-italiana text-[11px] tracking-[0.32em] text-[var(--wd-coral)]">
            OWNER URL
          </p>
          <h3
            id="owner-url-title"
            className="mt-3 text-[20px] font-semibold leading-[1.4] tracking-tight text-[var(--wd-ink)]"
          >
            발행 후 받는 신랑·신부 소장용 URL
          </h3>
          <p className="mt-2 break-keep text-[13px] leading-[1.7] text-[var(--wd-mute)]">
            공개 링크와 별개로, 두 사람만 접속할 수 있는 전용 URL 이 발급돼요.
            하객 메시지·서명·퀴즈/투표 결과·축하 카운트가 모두 모인 페이지를
            평생 간직할 수 있습니다.
          </p>

          {/* URL 미리보기 박스 */}
          <div className="mt-5 rounded-xl border border-[var(--wd-line)] bg-[var(--wd-cream)] p-3 text-left">
            <p className="font-italiana text-[9px] uppercase tracking-[0.3em] text-[var(--wd-mute)]">
              example
            </p>
            <p className="mt-1.5 break-all font-mono text-[11.5px] leading-[1.6] text-[var(--wd-ink)]">
              {exampleUrl}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--wd-ink)] px-3 py-1.5 text-[11px] font-medium text-[var(--wd-cream)] transition-transform active:scale-[0.96]"
              >
                {copied ? '복사됨 ✓' : 'URL 복사'}
              </button>
              {/* "예시 열기" — 관리자에서 세팅한 실 예시 URL 이 있을 때만 활성 */}
              {hasReal && (
                <a
                  href={exampleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--wd-ink)]/30 bg-[var(--wd-paper)] px-3 py-1.5 text-[11px] font-medium text-[var(--wd-ink)] transition-colors hover:bg-[var(--wd-ink)]/8"
                >
                  예시 열기 →
                </a>
              )}
            </div>
          </div>

          {/* 안에 뭐가 있는지 */}
          <ul className="mt-5 flex flex-col gap-1.5 text-left text-[12.5px] text-[var(--wd-mute)] [&>li]:break-keep [&>li]:flex [&>li]:items-start [&>li]:gap-1.5">
            <li>
              <Dot />
              하객의 축하 메시지 · 손글씨 서명 모음
            </li>
            <li>
              <Dot />
              퀴즈 · A/B 투표의 응답 결과와 통계
            </li>
            <li>
              <Dot />
              축하하기 카운트 + 방문 기록
            </li>
            <li>
              <Dot />
              혼인서약서 PDF · 메인 사진 영구 다운로드
            </li>
          </ul>

          <p className="mt-5 text-[11px] text-[var(--wd-mute)]">
            공개 링크는 발행 후 30일 만료, 소장용 URL 은 만료 없이 평생 유지.
          </p>
        </div>
      </div>
    </div>
  );
}

function Dot() {
  return (
    <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-[var(--wd-coral)]" />
  );
}

