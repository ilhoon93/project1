'use client';

import { useMemo, useState } from 'react';

/**
 * 카탈로그 × 모드 통계 표 — 정렬 가능한 client component.
 *
 * 정렬: 컬럼 헤더 클릭 → asc/desc 토글.
 * 필터: mode 토글 (전체 / selfies / couple), gen_count > 0 만 보기 옵션.
 */

export interface StatsRow {
  catalogId: string;
  label: string;
  mode: 'selfies' | 'couple' | 'unknown';
  genCount: number;
  likeCount: number;
  regenCount: number;
  likeRate: number;
  regenRate: number;
}

type SortKey = 'label' | 'mode' | 'genCount' | 'likeCount' | 'likeRate' | 'regenCount' | 'regenRate';
type SortDir = 'asc' | 'desc';

const MODE_LABEL: Record<StatsRow['mode'], string> = {
  selfies: '셀카',
  couple: '커플',
  unknown: '?',
};

export function CatalogStatsTable({ rows }: { rows: StatsRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('genCount');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [modeFilter, setModeFilter] = useState<'all' | 'selfies' | 'couple'>('all');
  const [hideEmpty, setHideEmpty] = useState<boolean>(true);

  const sorted = useMemo(() => {
    const filtered = rows.filter((r) => {
      if (modeFilter !== 'all' && r.mode !== modeFilter) return false;
      if (hideEmpty && r.genCount === 0) return false;
      return true;
    });
    const sign = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === 'string' && typeof vb === 'string') {
        return sign * va.localeCompare(vb, 'ko');
      }
      return sign * ((va as number) - (vb as number));
    });
  }, [rows, sortKey, sortDir, modeFilter, hideEmpty]);

  const headers: Array<{ key: SortKey; label: string; align: 'left' | 'right' }> = [
    { key: 'label', label: '카탈로그', align: 'left' },
    { key: 'mode', label: '모드', align: 'left' },
    { key: 'genCount', label: '생성', align: 'right' },
    { key: 'likeCount', label: '좋아요', align: 'right' },
    { key: 'likeRate', label: '좋아요율', align: 'right' },
    { key: 'regenCount', label: '재생성', align: 'right' },
    { key: 'regenRate', label: '재생성율', align: 'right' },
  ];

  const handleHeaderClick = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // numeric columns default desc, string columns default asc.
      setSortDir(key === 'label' || key === 'mode' ? 'asc' : 'desc');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <div className="flex items-center gap-1">
          <span className="font-medium text-[#5C4633]">모드:</span>
          {(['all', 'selfies', 'couple'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModeFilter(m)}
              aria-pressed={modeFilter === m}
              className={`rounded border px-2 py-1 ${
                modeFilter === m
                  ? 'border-[#3D2E1F] bg-[#3D2E1F] text-white'
                  : 'border-[#D4C5B0] bg-white text-[#5C4633] hover:bg-[#FAF7F2]'
              }`}
            >
              {m === 'all' ? '전체' : m === 'selfies' ? '셀카' : '커플'}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1 text-[#5C4633]">
          <input
            type="checkbox"
            checked={hideEmpty}
            onChange={(e) => setHideEmpty(e.target.checked)}
          />
          생성 0 행 숨기기
        </label>
        <span className="ml-auto text-[11px] text-[#8B7355]">
          {sorted.length}개 / 전체 {rows.length}개
        </span>
      </div>

      <div className="overflow-x-auto rounded border border-[#E8DCC9]">
        <table className="w-full min-w-[640px] text-xs">
          <thead className="bg-[#FAF7F2] text-[#5C4633]">
            <tr>
              {headers.map((h) => (
                <th
                  key={h.key}
                  scope="col"
                  className={`cursor-pointer select-none border-b border-[#E8DCC9] px-3 py-2 font-medium ${
                    h.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                  onClick={() => handleHeaderClick(h.key)}
                >
                  {h.label}
                  {sortKey === h.key && (
                    <span className="ml-1 text-[#8B7355]">
                      {sortDir === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={headers.length}
                  className="px-3 py-6 text-center text-[#8B7355]"
                >
                  해당 조건의 데이터가 없습니다.
                </td>
              </tr>
            ) : (
              sorted.map((r) => (
                <tr
                  key={`${r.catalogId}::${r.mode}`}
                  className="border-b border-[#F0E8D8] last:border-0 hover:bg-[#FAF7F2]"
                >
                  <td className="px-3 py-2 text-[#3D2E1F]">
                    <div className="font-medium">{r.label}</div>
                    <div className="text-[10px] text-[#8B7355]">{r.catalogId}</div>
                  </td>
                  <td className="px-3 py-2 text-[#5C4633]">{MODE_LABEL[r.mode]}</td>
                  <td className="px-3 py-2 text-right text-[#3D2E1F]">{r.genCount}</td>
                  <td className="px-3 py-2 text-right text-[#3D2E1F]">{r.likeCount}</td>
                  <td className="px-3 py-2 text-right text-[#3D2E1F]">
                    {(r.likeRate * 100).toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right text-[#3D2E1F]">{r.regenCount}</td>
                  <td className="px-3 py-2 text-right text-[#3D2E1F]">
                    {(r.regenRate * 100).toFixed(1)}%
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
