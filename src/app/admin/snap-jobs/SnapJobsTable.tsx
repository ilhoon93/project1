'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * AI 웨딩스냅 생성내역 + 반응 테이블 (운영자).
 *
 * - 최신순 목록, 이메일 필터(서버 쿼리), limit/offset 페이지네이션.
 * - 입력/결과 썸네일 클릭 시 라이트박스로 원본 확대.
 * - 반응: 좋아요(♥) + 재생성 사유/메모 표시.
 *
 * 필터·페이지 이동은 URL 쿼리(?email=&page=)로 서버 재조회. (snap_jobs 는
 * 이벤트 스케일이라 클라 전량 로드 대신 서버 페이지네이션 채택.)
 */
export interface SnapJobRow {
  id: string;
  user_id: string;
  email: string | null;
  catalog_id: string | null;
  catalog_path: string | null;
  status: string;
  submitted_at: string;
  completed_at: string | null;
  result_url: string | null;
  /** 서버에서 모드별로 해석한 입력 이미지 URL (couple=재서명, selfie=셀카). */
  input_url: string | null;
  input_kind: 'couple' | 'selfie' | null;
  image_reference: string | null;
  quality: string | null;
  credit_delta: number | null;
  fal_cost_usd: number | null;
  liked: boolean;
  liked_at: string | null;
  regen_reason: string | null;
  regen_reason_text: string | null;
  regen_to_job_id: string | null;
  error_message: string | null;
}

const REGEN_LABELS: Record<string, string> = {
  face_unnatural: '얼굴 어색',
  pose_diff: '포즈/구도 다름',
  outfit_bg: '의상/배경',
  other: '기타',
};

const STATUS_STYLE: Record<string, string> = {
  completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  submitted: 'bg-amber-50 text-amber-700 ring-amber-200',
  in_progress: 'bg-amber-50 text-amber-700 ring-amber-200',
  failed: 'bg-red-50 text-red-700 ring-red-200',
  timeout: 'bg-red-50 text-red-700 ring-red-200',
};

function modeLabel(path: string | null): string {
  if (path === 'couple') return '커플사진';
  if (path === 'anchored' || path === 'selfies') return '셀카';
  return path ?? '-';
}

function fmtTime(iso: string): string {
  // timestamptz(UTC 저장)를 항상 KST 로 표시 — timeZone 미지정 시 SSR(서버 UTC)
  // 과 클라이언트(브라우저)가 달라져 9시간 어긋나거나 hydration 불일치가 난다.
  return new Date(iso).toLocaleString('ko-KR', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Seoul',
  });
}

export function SnapJobsTable({
  rows,
  email,
  page,
  hasMore,
}: {
  rows: SnapJobRow[];
  email: string;
  page: number;
  hasMore: boolean;
}) {
  const router = useRouter();
  const [emailInput, setEmailInput] = useState(email);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const go = (nextEmail: string, nextPage: number) => {
    const params = new URLSearchParams();
    if (nextEmail.trim()) params.set('email', nextEmail.trim());
    if (nextPage > 0) params.set('page', String(nextPage));
    const qs = params.toString();
    router.push(`/admin/snap-jobs${qs ? `?${qs}` : ''}`);
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    go(emailInput, 0); // 이메일 변경 시 1페이지부터.
  };

  return (
    <div className="flex flex-col gap-3">
      {/* 이메일 필터 */}
      <form onSubmit={submitSearch} className="flex items-center gap-2">
        <input
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          placeholder="이메일로 검색 (Enter)"
          className="w-full max-w-xs rounded-md border border-[#D4C5B0] bg-white px-3 py-1.5 text-sm placeholder:text-[#B0A088] focus:border-[#8B7355] focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md bg-[#8B7355] px-3 py-1.5 text-sm font-medium text-white"
        >
          검색
        </button>
        {email && (
          <button
            type="button"
            onClick={() => {
              setEmailInput('');
              go('', 0);
            }}
            className="rounded-md border border-[#D4C5B0] px-3 py-1.5 text-sm text-[#8B7355]"
          >
            초기화
          </button>
        )}
        <span className="ml-auto text-[11px] text-[#8B7355]">
          {page + 1}페이지 · {rows.length}건
          {email ? ` · "${email}"` : ''}
        </span>
      </form>

      <div className="overflow-x-auto rounded-md border border-[#E8DCC9]">
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead>
            <tr className="bg-[#FAF7F2] text-[11px] text-[#8B7355]">
              <th className="px-3 py-2 text-left font-medium">일시</th>
              <th className="px-3 py-2 text-left font-medium">이메일</th>
              <th className="px-3 py-2 text-left font-medium">카탈로그 / 모드</th>
              <th className="px-2 py-2 text-center font-medium">상태</th>
              <th className="px-2 py-2 text-center font-medium">입력</th>
              <th className="px-2 py-2 text-center font-medium">결과</th>
              <th className="px-3 py-2 text-left font-medium">반응</th>
              <th className="px-2 py-2 text-right font-medium">비용($)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[#E8DCC9] align-top">
                <td className="whitespace-nowrap px-3 py-2 text-[11px] text-[#5C4633]">
                  {fmtTime(r.submitted_at)}
                </td>
                <td className="px-3 py-2 text-[12px] text-[#3D2E1F]">
                  {r.email ?? (
                    <span className="text-[#B0A088]">{r.user_id.slice(0, 8)}…</span>
                  )}
                </td>
                <td className="px-3 py-2 text-[12px] text-[#5C4633]">
                  <div className="font-medium">{r.catalog_id ?? '-'}</div>
                  <div className="text-[11px] text-[#8B7355]">
                    {modeLabel(r.catalog_path)}
                    {r.image_reference ? ` · ${r.image_reference}` : ''}
                  </div>
                </td>
                <td className="px-2 py-2 text-center">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${
                      STATUS_STYLE[r.status] ?? 'bg-stone-100 text-stone-600 ring-stone-200'
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-2 py-2 text-center">
                  <Thumb url={r.input_url} onOpen={setLightbox} label="입력 없음" />
                </td>
                <td className="px-2 py-2 text-center">
                  <Thumb url={r.result_url} onOpen={setLightbox} label="결과 없음" />
                </td>
                <td className="px-3 py-2 text-[12px]">
                  <div className="flex flex-col gap-1">
                    {r.liked && (
                      <span className="inline-flex w-fit items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-600 ring-1 ring-rose-200">
                        ♥ 좋아요
                      </span>
                    )}
                    {r.regen_reason && (
                      <span className="inline-flex w-fit items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">
                        ↻ {REGEN_LABELS[r.regen_reason] ?? r.regen_reason}
                      </span>
                    )}
                    {r.regen_reason_text && (
                      <span className="max-w-[220px] whitespace-pre-wrap break-words text-[11px] text-[#8B7355]">
                        “{r.regen_reason_text}”
                      </span>
                    )}
                    {!r.liked && !r.regen_reason && (
                      <span className="text-[11px] text-[#B0A088]">-</span>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-right text-[11px] text-[#5C4633]">
                  {typeof r.fal_cost_usd === 'number'
                    ? r.fal_cost_usd.toFixed(3)
                    : '-'}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-xs text-[#8B7355]">
                  생성내역이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          disabled={page <= 0}
          onClick={() => go(email, page - 1)}
          className="rounded-md border border-[#D4C5B0] px-3 py-1.5 text-sm text-[#5C4633] disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← 이전
        </button>
        <span className="text-[12px] text-[#8B7355]">{page + 1}페이지</span>
        <button
          type="button"
          disabled={!hasMore}
          onClick={() => go(email, page + 1)}
          className="rounded-md border border-[#D4C5B0] px-3 py-1.5 text-sm text-[#5C4633] disabled:cursor-not-allowed disabled:opacity-40"
        >
          다음 →
        </button>
      </div>

      {/* 라이트박스 */}
      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="이미지 크게 보기"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            aria-label="닫기"
            onClick={(e) => {
              e.stopPropagation();
              setLightbox(null);
            }}
            className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/15 text-xl text-white hover:bg-white/30"
          >
            ✕
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt=""
            className="block max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function Thumb({
  url,
  onOpen,
  label,
}: {
  url: string | null;
  onOpen: (url: string) => void;
  label: string;
}) {
  if (!url) {
    return (
      <span className="inline-grid h-12 w-12 place-items-center rounded border border-dashed border-[#E8DCC9] text-[9px] text-[#B0A088]">
        {label}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onOpen(url)}
      className="inline-block h-12 w-12 overflow-hidden rounded border border-[#E8DCC9] transition-opacity hover:opacity-80"
      title="클릭하여 크게 보기"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
    </button>
  );
}
