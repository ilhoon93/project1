'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { SampleDesign } from '@/lib/marketing/sample-invitations';
import { InvitationPreview } from './InvitationPreview';

/**
 * 디자인 샘플 카탈로그 — 사진 있는 디자인 / 사진 없는 디자인 두 그룹을 스위치로
 * 전환하며 본다(기본값: 사진 있는 디자인). 각 그룹의 디자인·순서는 관리자
 * 샘플 설정에서 관리된다(레이아웃 기반 hasPhoto 분류).
 *
 * 카드는 실제 알림장 표지(메인 슬라이드)를 띄우고, 누르면 전체 알림장을 폰 프레임
 * 모달로 스크롤하며 둘러볼 수 있다. 모두 실제 렌더러 + 정적 샘플 데이터(서버 호출 없음).
 */
export function DesignCatalogClient({ designs }: { designs: SampleDesign[] }) {
  const [view, setView] = useState<'photo' | 'nophoto'>('photo');
  const [openId, setOpenId] = useState<string | null>(null);

  const photo = useMemo(() => designs.filter((d) => d.hasPhoto), [designs]);
  const nophoto = useMemo(() => designs.filter((d) => !d.hasPhoto), [designs]);
  const shown = view === 'photo' ? photo : nophoto;
  // 두 그룹 모두 있을 때만 전환 스위치를 노출. 전환 대상 그룹 이름을 버튼 라벨로.
  const canToggle = photo.length > 0 && nophoto.length > 0;
  const toggleLabel = view === 'photo' ? '사진 없는 디자인 모아보기' : '사진있는 디자인 모아보기';

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
      {/* 소개글 좌 + (CTA + 사진/무사진 전환 스위치) 우 — 진입 즉시 액션이 보이게. */}
      <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:gap-6">
        <div className="min-w-0 flex-1">
          <div className="font-italiana text-[11px] font-medium tracking-[0.18em] text-[var(--wd-coral)]">
            DESIGN SAMPLES
          </div>
          <h1 className="mt-2 max-w-[20ch] text-balance break-keep text-[24px] font-medium leading-[1.4] tracking-tight sm:text-[28px]">
            마음에 드는 디자인을 고르고, 우리답게 바꾸세요
          </h1>
          <p className="mt-2 max-w-[540px] break-keep text-[14px] leading-[1.75] text-[var(--wd-mute)]">
            컬러 테마와 움직이는 배경 효과, 레이아웃 디자인을 자유롭게 조합해 만든 실제
            알림장 미리보기예요. 카드를 누르면 다양한 폰트와 텍스트 애니메이션까지 입힌
            전체 알림장을 폰 화면 그대로 둘러볼 수 있습니다.
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col items-start gap-2 sm:mt-1 sm:w-auto sm:items-end">
          <Link
            href="/new"
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--wd-ink)] px-5 py-3 text-[13px] font-medium text-[var(--wd-cream)] transition-transform active:scale-[0.97]"
          >
            무료로 내 알림장 만들기 →
          </Link>
          {canToggle && (
            <button
              type="button"
              onClick={() => setView((v) => (v === 'photo' ? 'nophoto' : 'photo'))}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--wd-ink)]/25 px-4 py-2 text-[12px] font-medium text-[var(--wd-ink)] transition-colors hover:border-[var(--wd-ink)]/50"
            >
              {toggleLabel} →
            </button>
          )}
        </div>
      </div>

      <div className="mt-8">
        {shown.length === 0 ? (
          <p className="py-12 text-center text-sm text-[var(--wd-mute)]">
            등록된 디자인이 없습니다.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map((d) => (
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
                <div className="overflow-hidden rounded-[20px] border-[2px] border-[#15110E] bg-[#15110E] shadow-[0_14px_34px_rgba(31,27,23,0.16)] transition-transform group-hover:-translate-y-1 group-focus-visible:-translate-y-1">
                  <div className="relative aspect-[1/2] w-full overflow-hidden">
                    <InvitationPreview design={d} cover />
                    <div className="absolute inset-0 z-10" />
                    <span className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-center justify-center bg-gradient-to-t from-black/55 to-transparent pb-2.5 pt-7 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                      전체 미리보기 →
                    </span>
                  </div>
                </div>
                <div className="mt-2.5 px-1">
                  <div className="flex items-center gap-1.5">
                    {d.number != null && (
                      <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--wd-ink)] px-1 text-[10px] font-semibold leading-none text-[var(--wd-cream)]">
                        {d.number}
                      </span>
                    )}
                    <span className="truncate text-[13px] font-medium text-[var(--wd-ink)]">{d.name}</span>
                  </div>
                  <div className="text-[11px] text-[var(--wd-mute)]">{d.layoutLabel}</div>
                </div>
              </div>
            ))}
          </div>
        )}
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
        className="absolute right-3 top-3 z-[60] grid h-7 w-7 place-items-center rounded-full bg-white/90 text-[13px] text-[var(--wd-ink)] shadow-md"
      >
        ✕
      </button>

      <div
        className="overflow-hidden rounded-[1.6rem] border-[3px] border-[#15110E] bg-[#15110E] shadow-2xl"
        style={{ height: 'min(82vh, 800px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-[1/2] h-full overflow-hidden">
          <InvitationPreview design={design} withBgm />
        </div>
      </div>

      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <span className="rounded-full bg-white/90 px-3 py-1.5 text-[12px] font-medium text-[var(--wd-ink)]">
          {design.number != null && `No.${design.number} · `}
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
