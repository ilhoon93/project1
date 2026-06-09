'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveCatalogOrder, resetCatalogOrder } from './actions';

interface OrderItem {
  id: string;
  label: string;
  image: string;
}

/**
 * 카탈로그 순서 재배치 UI.
 * - 위/아래 버튼 또는 맨위/맨아래로 이동.
 * - 로컬 state 로 순서를 바꾼 뒤 [순서 저장] 으로 일괄 반영.
 * - dirty(변경됨) 상태를 표시해 저장 전 이탈을 인지하게 함.
 */
export function CatalogOrderTable({ items }: { items: OrderItem[] }) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderItem[]>(items);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    setOrder((prev) => {
      const next = [...prev];
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it);
      return next;
    });
    setDirty(true);
    setMsg(null);
  };

  const save = () => {
    setMsg(null);
    startTransition(async () => {
      const res = await saveCatalogOrder(order.map((o) => o.id));
      if (res.ok) {
        setDirty(false);
        setMsg({ kind: 'ok', text: '순서를 저장했습니다. 사용자 화면에 반영됩니다.' });
        router.refresh();
      } else {
        setMsg({ kind: 'err', text: res.error ?? '저장 실패' });
      }
    });
  };

  const reset = () => {
    if (!confirm('운영자 지정 순서를 모두 지우고 기본(코드) 순서로 되돌릴까요?')) return;
    setMsg(null);
    startTransition(async () => {
      const res = await resetCatalogOrder();
      if (res.ok) {
        setDirty(false);
        setMsg({ kind: 'ok', text: '기본 순서로 초기화했습니다.' });
        router.refresh();
      } else {
        setMsg({ kind: 'err', text: res.error ?? '초기화 실패' });
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-[#E8DCC9] bg-[#FAF7F2]/95 py-2 backdrop-blur">
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className="rounded-md bg-[#3D2E1F] px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#5C4633] disabled:opacity-40"
        >
          {pending ? '저장 중…' : '순서 저장'}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={pending}
          className="rounded-md border border-[#D4C5B0] bg-white px-3 py-1.5 text-xs font-medium text-[#5C4633] hover:bg-white/70 disabled:opacity-40"
        >
          기본 순서로 초기화
        </button>
        {dirty && (
          <span className="text-[11px] text-amber-700">● 변경됨 (저장 전)</span>
        )}
        {msg && (
          <span
            className={`text-[11px] ${msg.kind === 'ok' ? 'text-emerald-700' : 'text-red-600'}`}
          >
            {msg.text}
          </span>
        )}
        <span className="ml-auto text-[11px] text-[#8B7355]">총 {order.length}개</span>
      </div>

      <ul className="flex flex-col gap-1.5">
        {order.map((it, idx) => (
          <li
            key={it.id}
            className="flex items-center gap-3 rounded-md border border-[#E8DCC9] bg-white p-2"
          >
            <span className="w-7 shrink-0 text-center text-xs font-semibold tabular-nums text-[#8B7355]">
              {idx + 1}
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={it.image}
              alt={it.label}
              className="h-12 w-9 shrink-0 rounded object-cover ring-1 ring-[#E8DCC9]"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[#3D2E1F]">{it.label}</p>
              <p className="truncate text-[10px] text-[#8B7355]">{it.id}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => move(idx, 0)}
                disabled={idx === 0}
                title="맨 위로"
                className="rounded border border-[#E8DCC9] bg-white px-1.5 py-1 text-[11px] text-[#5C4633] hover:bg-[#FAF7F2] disabled:opacity-30"
              >
                ⤒
              </button>
              <button
                type="button"
                onClick={() => move(idx, idx - 1)}
                disabled={idx === 0}
                title="위로"
                className="rounded border border-[#E8DCC9] bg-white px-1.5 py-1 text-[11px] text-[#5C4633] hover:bg-[#FAF7F2] disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(idx, idx + 1)}
                disabled={idx === order.length - 1}
                title="아래로"
                className="rounded border border-[#E8DCC9] bg-white px-1.5 py-1 text-[11px] text-[#5C4633] hover:bg-[#FAF7F2] disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => move(idx, order.length - 1)}
                disabled={idx === order.length - 1}
                title="맨 아래로"
                className="rounded border border-[#E8DCC9] bg-white px-1.5 py-1 text-[11px] text-[#5C4633] hover:bg-[#FAF7F2] disabled:opacity-30"
              >
                ⤓
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
