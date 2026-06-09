'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { adjustCredits } from './actions';

export interface AdminUserRow {
  user_id: string;
  email: string | null;
  created_at: string;
  publish_balance: number;
  archive_balance: number;
  snap_balance: number;
  order_count: number;
  order_amount: number;
}

type CreditKind = 'publish' | 'archive' | 'snap';

const KIND_LABEL: Record<CreditKind, string> = {
  publish: '발행권',
  archive: '영구소장',
  snap: '스냅',
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' });
}

export function UsersTable({ rows }: { rows: AdminUserRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(
      (r) => (r.email ?? '').toLowerCase().includes(t) || r.user_id.includes(t),
    );
  }, [rows, q]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="이메일 또는 user_id 검색"
          className="w-full max-w-xs rounded-md border border-[#D4C5B0] bg-white px-3 py-1.5 text-sm placeholder:text-[#B0A088] focus:border-[#8B7355] focus:outline-none"
        />
        <span className="text-[11px] text-[#8B7355]">
          {filtered.length} / {rows.length}명
        </span>
      </div>

      <div className="overflow-x-auto rounded-md border border-[#E8DCC9]">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="bg-[#FAF7F2] text-[11px] text-[#8B7355]">
              <th className="px-3 py-2 text-left font-medium">이메일</th>
              <th className="px-2 py-2 text-right font-medium">발행권</th>
              <th className="px-2 py-2 text-right font-medium">영구소장</th>
              <th className="px-2 py-2 text-right font-medium">스냅</th>
              <th className="px-2 py-2 text-right font-medium">결제</th>
              <th className="px-2 py-2 text-right font-medium">결제액</th>
              <th className="px-2 py-2 text-center font-medium">가입</th>
              <th className="px-2 py-2 text-center font-medium">조정</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <RowGroup
                key={r.user_id}
                row={r}
                open={editing === r.user_id}
                onToggle={() => setEditing((cur) => (cur === r.user_id ? null : r.user_id))}
                onDone={() => {
                  setEditing(null);
                  router.refresh();
                }}
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-xs text-[#8B7355]">
                  검색 결과가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RowGroup({
  row,
  open,
  onToggle,
  onDone,
}: {
  row: AdminUserRow;
  open: boolean;
  onToggle: () => void;
  onDone: () => void;
}) {
  return (
    <>
      <tr className="border-t border-[#E8DCC9]">
        <td className="max-w-[240px] truncate px-3 py-2 text-[#3D2E1F]">
          {row.email ?? <span className="text-[#B0A088]">(이메일 없음)</span>}
        </td>
        <td className="px-2 py-2 text-right tabular-nums">{row.publish_balance}</td>
        <td className="px-2 py-2 text-right tabular-nums">{row.archive_balance}</td>
        <td className="px-2 py-2 text-right tabular-nums">{row.snap_balance}</td>
        <td className="px-2 py-2 text-right tabular-nums text-[#8B7355]">{row.order_count}</td>
        <td className="px-2 py-2 text-right tabular-nums text-[#8B7355]">
          {row.order_amount.toLocaleString()}원
        </td>
        <td className="px-2 py-2 text-center text-[11px] text-[#8B7355]">
          {fmtDate(row.created_at)}
        </td>
        <td className="px-2 py-2 text-center">
          <button
            type="button"
            onClick={onToggle}
            className={`rounded border px-2 py-1 text-[11px] font-medium transition-colors ${
              open
                ? 'border-[#3D2E1F] bg-[#3D2E1F] text-white'
                : 'border-[#D4C5B0] bg-white text-[#5C4633] hover:border-[#8B7355]'
            }`}
          >
            {open ? '닫기' : '조정'}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="bg-[#FAF7F2]">
          <td colSpan={8} className="px-3 py-3">
            <AdjustForm row={row} onDone={onDone} />
          </td>
        </tr>
      )}
    </>
  );
}

function AdjustForm({ row, onDone }: { row: AdminUserRow; onDone: () => void }) {
  const [kind, setKind] = useState<CreditKind>('publish');
  const [delta, setDelta] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const apply = (signMul: 1 | -1) => {
    const n = parseInt(delta, 10);
    if (!Number.isInteger(n) || n <= 0) {
      setMsg({ kind: 'err', text: '1 이상의 정수를 입력하세요' });
      return;
    }
    setMsg(null);
    startTransition(async () => {
      const res = await adjustCredits({
        userId: row.user_id,
        kind,
        delta: n * signMul,
        note: note.trim() || undefined,
      });
      if (res.ok) {
        setMsg({
          kind: 'ok',
          text: `${KIND_LABEL[kind]} ${signMul > 0 ? '지급' : '회수'} 완료 · 잔액 ${res.balance}`,
        });
        setDelta('');
        setNote('');
        // 잠깐 메시지 보여준 뒤 새로고침은 부모에서. 여기선 즉시 refresh 트리거.
        onDone();
      } else {
        setMsg({ kind: 'err', text: res.error ?? '실패' });
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-[#8B7355]">종류</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as CreditKind)}
            className="rounded-md border border-[#D4C5B0] bg-white px-2 py-1.5 text-xs text-[#3D2E1F] focus:border-[#8B7355] focus:outline-none"
          >
            <option value="publish">발행권 (현재 {row.publish_balance})</option>
            <option value="archive">영구소장 (현재 {row.archive_balance})</option>
            <option value="snap">스냅 (현재 {row.snap_balance})</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-[#8B7355]">수량</span>
          <input
            value={delta}
            onChange={(e) => setDelta(e.target.value.replace(/[^0-9]/g, ''))}
            inputMode="numeric"
            placeholder="예: 5"
            className="w-24 rounded-md border border-[#D4C5B0] bg-white px-2 py-1.5 text-xs text-[#3D2E1F] placeholder:text-[#B0A088] focus:border-[#8B7355] focus:outline-none"
          />
        </label>
        <label className="flex min-w-[160px] flex-1 flex-col gap-1">
          <span className="text-[10px] text-[#8B7355]">메모 (선택)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="예: 이벤트 보상 / CS 보전"
            className="w-full rounded-md border border-[#D4C5B0] bg-white px-2 py-1.5 text-xs text-[#3D2E1F] placeholder:text-[#B0A088] focus:border-[#8B7355] focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() => apply(1)}
          disabled={pending}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          지급 +
        </button>
        <button
          type="button"
          onClick={() => apply(-1)}
          disabled={pending}
          className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-40"
        >
          회수 −
        </button>
      </div>
      {msg && (
        <p
          className={`text-[11px] ${msg.kind === 'ok' ? 'text-emerald-700' : 'text-red-600'}`}
        >
          {msg.text}
        </p>
      )}
      <p className="text-[10px] text-[#8B7355]">
        user_id: <code className="text-[#5C4633]">{row.user_id}</code>
      </p>
    </div>
  );
}
