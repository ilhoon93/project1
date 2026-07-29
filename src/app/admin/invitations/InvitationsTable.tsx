'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatKstDateTime } from '@/lib/utils/datetime';

/**
 * 알림장 목록 테이블 (운영자).
 *
 * - 최신순(created_at) 목록, 생성자 이메일 필터, "발행된 것만" 토글.
 * - 발행된 알림장은 slug 링크로 새 탭에서 바로 열람.
 *
 * 필터·페이지 이동은 URL 쿼리(?email=&published=&page=)로 서버 재조회.
 */
export interface InvitationRow {
  id: string;
  user_id: string;
  email: string | null;
  slug: string;
  groom_name: string;
  bride_name: string;
  wedding_date: string | null;
  is_published: boolean;
  published_at: string | null;
  expires_at: string | null;
  paid_at: string | null;
  total_price: number | null;
  created_at: string;
  updated_at: string;
  /** 활성 publication 의 공개 slug (하객용/소장용 URL 기준). 발행 안 했으면 null. */
  pub_slug: string | null;
  owner_token: string | null;
  archived: boolean | null;
  /** 수정(제작) 여부 — updated_at<>created_at 또는 편집 흔적 존재. 070 마이그 이전이면 null. */
  was_made: boolean | null;
}

function statusOf(r: InvitationRow): {
  label: string;
  cls: string;
} {
  if (!r.is_published) {
    return { label: '미발행', cls: 'bg-stone-100 text-stone-600 ring-stone-200' };
  }
  if (r.archived) {
    return { label: '발행중(영구)', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' };
  }
  const expired = r.expires_at != null && new Date(r.expires_at) < new Date();
  return expired
    ? { label: '발행(만료)', cls: 'bg-amber-50 text-amber-700 ring-amber-200' }
    : { label: '발행중', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' };
}

export function InvitationsTable({
  rows,
  email,
  publishedOnly,
  page,
  hasMore,
}: {
  rows: InvitationRow[];
  email: string;
  publishedOnly: boolean;
  page: number;
  hasMore: boolean;
}) {
  const router = useRouter();
  const [emailInput, setEmailInput] = useState(email);

  const go = (nextEmail: string, nextPublished: boolean, nextPage: number) => {
    const params = new URLSearchParams();
    if (nextEmail.trim()) params.set('email', nextEmail.trim());
    if (nextPublished) params.set('published', '1');
    if (nextPage > 0) params.set('page', String(nextPage));
    const qs = params.toString();
    router.push(`/admin/invitations${qs ? `?${qs}` : ''}`);
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    go(emailInput, publishedOnly, 0);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* 필터 */}
      <form onSubmit={submitSearch} className="flex flex-wrap items-center gap-2">
        <input
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          placeholder="생성자 이메일로 검색 (Enter)"
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
              go('', publishedOnly, 0);
            }}
            className="rounded-md border border-[#D4C5B0] px-3 py-1.5 text-sm text-[#8B7355]"
          >
            초기화
          </button>
        )}
        <label className="ml-2 inline-flex cursor-pointer items-center gap-1.5 text-sm text-[#5C4633]">
          <input
            type="checkbox"
            checked={publishedOnly}
            onChange={(e) => go(emailInput, e.target.checked, 0)}
            className="h-4 w-4 accent-[#8B7355]"
          />
          발행된 것만
        </label>
        <span className="ml-auto text-[11px] text-[#8B7355]">
          {page + 1}페이지 · {rows.length}건
        </span>
      </form>

      <div className="overflow-x-auto rounded-md border border-[#E8DCC9]">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="bg-[#FAF7F2] text-[11px] text-[#8B7355]">
              <th className="px-3 py-2 text-left font-medium">생성일시</th>
              <th className="px-3 py-2 text-left font-medium">최종 수정</th>
              <th className="px-3 py-2 text-left font-medium">이메일</th>
              <th className="px-3 py-2 text-left font-medium">신랑 · 신부</th>
              <th className="px-3 py-2 text-left font-medium">예식일</th>
              <th className="px-2 py-2 text-center font-medium">수정 여부</th>
              <th className="px-2 py-2 text-center font-medium">상태</th>
              <th className="px-3 py-2 text-left font-medium">보기</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const st = statusOf(r);
              return (
                <tr key={r.id} className="border-t border-[#E8DCC9]">
                  <td className="whitespace-nowrap px-3 py-2 text-[11px] text-[#5C4633]">
                    {formatKstDateTime(r.created_at)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-[11px] text-[#5C4633]">
                    {formatKstDateTime(r.updated_at)}
                  </td>
                  <td className="px-3 py-2 text-[12px] text-[#3D2E1F]">
                    {r.email ?? (
                      <span className="text-[#B0A088]">{r.user_id.slice(0, 8)}…</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[12px] text-[#5C4633]">
                    {r.groom_name || '-'} · {r.bride_name || '-'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-[12px] text-[#5C4633]">
                    {r.wedding_date ?? '-'}
                  </td>
                  <td className="px-2 py-2 text-center">
                    {r.was_made == null ? (
                      <span className="text-[10px] text-[#B0A088]">-</span>
                    ) : r.was_made ? (
                      <span className="inline-block rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 ring-1 ring-sky-200">
                        수정됨
                      </span>
                    ) : (
                      <span className="inline-block rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500 ring-1 ring-stone-200">
                        미수정
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${st.cls}`}
                    >
                      {st.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[12px]">
                    <div className="flex flex-col gap-0.5">
                      {/* 미발행 포함 모든 알림장을 운영자 미리보기로 열람 */}
                      <a
                        href={`/admin/invitations/${r.id}/preview`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#8B7355] underline hover:text-[#5C4633]"
                      >
                        미리보기 ↗
                      </a>
                      {r.is_published && r.pub_slug && (
                        <a
                          href={`/${r.pub_slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-[#8B7355] hover:text-[#5C4633]"
                        >
                          하객용 ↗
                        </a>
                      )}
                      {r.is_published && r.pub_slug && r.owner_token && (
                        <a
                          href={`/${r.pub_slug}/o/${r.owner_token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-[#8B7355] hover:text-[#5C4633]"
                        >
                          소장용 ↗
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-xs text-[#8B7355]">
                  알림장이 없습니다.
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
          onClick={() => go(email, publishedOnly, page - 1)}
          className="rounded-md border border-[#D4C5B0] px-3 py-1.5 text-sm text-[#5C4633] disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← 이전
        </button>
        <span className="text-[12px] text-[#8B7355]">{page + 1}페이지</span>
        <button
          type="button"
          disabled={!hasMore}
          onClick={() => go(email, publishedOnly, page + 1)}
          className="rounded-md border border-[#D4C5B0] px-3 py-1.5 text-sm text-[#5C4633] disabled:cursor-not-allowed disabled:opacity-40"
        >
          다음 →
        </button>
      </div>
    </div>
  );
}
