'use client';

import { useState, useTransition } from 'react';
import { confirmReviewEvent } from './actions';

export interface ReviewEventRow {
  userId: string;
  email: string | null;
  imageUrl: string;
  status: 'submitted' | 'confirmed';
  createdAt: string;
}

export function ReviewEventsAdmin({ rows }: { rows: ReviewEventRow[] }) {
  const [items, setItems] = useState(rows);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const confirm = (userId: string) => {
    setMsg(null);
    setBusyId(userId);
    startTransition(async () => {
      const res = await confirmReviewEvent(userId);
      if (res.ok) {
        setItems((prev) =>
          prev.map((r) => (r.userId === userId ? { ...r, status: 'confirmed' } : r)),
        );
        setMsg('확인 완료 — 영구소장권이 적립되었습니다.');
      } else {
        setMsg(`실패: ${res.error ?? 'unknown'}`);
      }
      setBusyId(null);
    });
  };

  if (items.length === 0) {
    return (
      <p className="rounded-md border border-[#E8DCC9] bg-[#FAF7F2] p-4 text-xs text-[#8B7355]">
        아직 제출된 포토리뷰 이벤트가 없습니다.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {msg && (
        <p
          className={`rounded-md px-3 py-2 text-[12px] ${
            msg.startsWith('실패')
              ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
              : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
          }`}
        >
          {msg}
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {items.map((r) => (
          <li
            key={r.userId}
            className="flex gap-3 rounded-md border border-[#E8DCC9] bg-white p-3"
          >
            <a
              href={r.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block h-24 w-24 flex-shrink-0 overflow-hidden rounded border border-[#E8DCC9] bg-[#FAF7F2]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.imageUrl} alt="리뷰 캡처" className="h-full w-full object-cover" />
            </a>
            <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-[#3D2E1F]">
                  {r.email ?? r.userId}
                </p>
                <p className="mt-0.5 text-[11px] text-[#8B7355]">
                  제출 {new Date(r.createdAt).toLocaleString('ko-KR')}
                </p>
                <span
                  className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10.5px] font-medium ${
                    r.status === 'confirmed'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {r.status === 'confirmed' ? '확인완료' : '입력완료(확인 대기)'}
                </span>
              </div>
              <div>
                {r.status === 'confirmed' ? (
                  <span className="text-[11px] text-[#8B7355]">영구소장권 적립 완료</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => confirm(r.userId)}
                    disabled={pending && busyId === r.userId}
                    className="rounded-md bg-[#2E7D5B] px-4 py-1.5 text-[12.5px] font-medium text-white disabled:opacity-50"
                  >
                    {pending && busyId === r.userId ? '처리 중…' : '확인 · 영구소장권 적립'}
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
