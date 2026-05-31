'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { SampleDesign } from '@/lib/marketing/sample-invitations';
import { InvitationPreview } from './InvitationPreview';

/**
 * 디자인 샘플 카탈로그 — 카드는 실제 알림장 표지(메인 슬라이드)를 띄우고,
 * 카드를 누르면 전체 알림장을 폰 프레임 모달로 스크롤하며 둘러볼 수 있다.
 * 모두 실제 렌더러(InvitationSlides) + 정적 샘플 데이터로 동작 (서버 호출 없음).
 */
export function DesignCatalogClient({ designs }: { designs: SampleDesign[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = designs.find((d) => d.id === openId) ?? null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenId(null);
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
      <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 lg:grid-cols-4">
        {designs.map((d) => (
          <div
            key={d.id}
            role="button"
            tabIndex={0}
            onClick={() => setOpenId(d.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setOpenId(d.id);
              }
            }}
            className="group cursor-pointer text-left outline-none"
          >
            {/* 카드 bg 를 베젤(#15110E) 과 동일하게 — 다크 테마 표지일 때
                베젤/스크린 경계의 흰색 seam(rounded radius 안티에일리어싱) 제거.
                라이트 테마는 InvitationPreview 가 자기 palette.bg 로 가득 덮음. */}
            <div className="overflow-hidden rounded-[26px] border-[6px] border-[#15110E] bg-[#15110E] shadow-[0_14px_34px_rgba(31,27,23,0.16)] transition-transform group-hover:-translate-y-1 group-focus-visible:-translate-y-1">
              {/* 화면 = 정확히 9:18 → 표지 미리보기가 왜곡 없이 가득 채움 */}
              <div className="relative aspect-[9/18] w-full overflow-hidden">
                <InvitationPreview design={d} cover />
                {/* 클릭 캡처 — 표지 안 인터랙티브 요소 대신 카드 전체가 모달을 연다. */}
                <div className="absolute inset-0 z-10" />
                <span className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-center justify-center bg-gradient-to-t from-black/55 to-transparent pb-2.5 pt-7 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  전체 미리보기 →
                </span>
              </div>
            </div>
            <div className="mt-2.5 px-1">
              <div className="text-[13px] font-medium text-[var(--wd-ink)]">{d.name}</div>
              <div className="text-[11px] text-[var(--wd-mute)]">{d.layoutLabel}</div>
            </div>
          </div>
        ))}
      </div>

      {open && <PreviewModal design={open} onClose={() => setOpenId(null)} />}
    </>
  );
}

function PreviewModal({ design, onClose }: { design: SampleDesign; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/65 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="닫기"
        className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-lg text-[var(--wd-ink)] shadow-md"
      >
        ✕
      </button>

      <div
        className="overflow-hidden rounded-[2.2rem] border-[10px] border-[#15110E] bg-[#15110E] shadow-2xl"
        style={{ height: 'min(82vh, 800px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-[9/18] h-full overflow-hidden">
          <InvitationPreview design={design} />
        </div>
      </div>

      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <span className="rounded-full bg-white/90 px-3 py-1.5 text-[12px] font-medium text-[var(--wd-ink)]">
          {design.name} · {design.layoutLabel}
        </span>
        <Link
          href={`/new?preset=${design.id}`}
          className="rounded-full bg-[var(--wd-coral)] px-4 py-1.5 text-[12px] font-medium text-white"
        >
          비슷하게 만들기 →
        </Link>
      </div>
    </div>
  );
}
