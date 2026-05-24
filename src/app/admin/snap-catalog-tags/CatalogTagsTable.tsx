'use client';

/**
 * admin 페이지의 메인 테이블 — 카탈로그 행 × 입력 조건 2컬럼 × 태그 select.
 *
 * 변경 즉시 server action 호출 → DB 저장 → revalidatePath 로 페이지 fresh.
 * 사용자가 빠르게 여러 카탈로그를 일괄 세팅할 수 있게 inline edit.
 */

import { useState, useTransition } from 'react';
import type { SnapCatalogItem } from '@/lib/snap/catalog';
import type {
  CatalogAdminTag,
  CatalogAdminTagMap,
  CatalogInputCondition,
} from '@/lib/snap/catalog-admin-tags';
import { setCatalogTag } from './actions';

const TAG_OPTIONS: Array<{
  value: CatalogAdminTag | '';
  label: string;
  className: string;
}> = [
  { value: '', label: '— 미설정', className: 'text-[#8B7355]' },
  { value: 'recommend', label: '추천', className: 'text-emerald-700 font-medium' },
  { value: 'caution', label: '주의', className: 'text-amber-700 font-medium' },
  { value: 'risky', label: '비추', className: 'text-red-700 font-medium' },
  { value: 'hidden', label: '숨김', className: 'text-[#5C4633] font-medium' },
];

const COLUMNS: Array<{ cond: CatalogInputCondition; label: string }> = [
  { cond: 'selfies', label: '셀카 모드' },
  { cond: 'couple-fullbody', label: '커플 (전신 입력)' },
];

interface RowStatus {
  saving: boolean;
  error?: string;
}

export function CatalogTagsTable({
  catalog,
  tagMap,
}: {
  catalog: SnapCatalogItem[];
  tagMap: CatalogAdminTagMap;
}) {
  const [filter, setFilter] = useState('');
  const visible = filter
    ? catalog.filter(
        (c) =>
          c.id.toLowerCase().includes(filter.toLowerCase()) ||
          c.label.includes(filter),
      )
    : catalog;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 text-xs text-[#5C4633]">
        <input
          type="search"
          placeholder="id 또는 라벨로 검색"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-64 rounded-md border border-[#D4C5B0] bg-white px-3 py-1.5 text-xs"
        />
        <span className="text-[#8B7355]">
          {visible.length === catalog.length
            ? `전체 ${catalog.length}개`
            : `${visible.length} / ${catalog.length}개`}
        </span>
      </div>

      <div className="overflow-x-auto rounded-md border border-[#E8DCC9] bg-white">
        <table className="w-full text-xs">
          <thead className="border-b border-[#E8DCC9] bg-[#FAF7F2] text-[#5C4633]">
            <tr>
              <th className="sticky left-0 z-10 bg-[#FAF7F2] px-3 py-2 text-left">
                카탈로그
              </th>
              <th className="px-3 py-2 text-left">id</th>
              {COLUMNS.map((col) => (
                <th key={col.cond} className="px-3 py-2 text-left">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => (
              <CatalogRow
                key={item.id}
                item={item}
                tags={tagMap[item.id] ?? {}}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CatalogRow({
  item,
  tags,
}: {
  item: SnapCatalogItem;
  tags: Partial<Record<CatalogInputCondition, CatalogAdminTag>>;
}) {
  return (
    <tr className="border-b border-[#F3EBD9] last:border-0">
      <td className="sticky left-0 z-10 bg-white px-3 py-2">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.image}
            alt={item.label}
            className="h-12 w-9 shrink-0 rounded border border-[#E8DCC9] object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
            }}
          />
          <div className="flex flex-col">
            <span className="font-medium text-[#3D2E1F]">{item.label}</span>
            <span className="text-[10px] text-[#8B7355]">
              {item.personality} · {item.framing ?? 'full'}
              {item.hasSideAngle ? ' · 측면' : ''}
              {item.isSeated ? ' · 앉음' : ''}
            </span>
          </div>
        </div>
      </td>
      <td className="px-3 py-2 font-mono text-[10px] text-[#8B7355]">
        {item.id}
      </td>
      {COLUMNS.map((col) => (
        <td key={col.cond} className="px-3 py-2">
          <TagSelect
            catalogId={item.id}
            inputCondition={col.cond}
            currentTag={tags[col.cond] ?? null}
          />
        </td>
      ))}
    </tr>
  );
}

function TagSelect({
  catalogId,
  inputCondition,
  currentTag,
}: {
  catalogId: string;
  inputCondition: CatalogInputCondition;
  currentTag: CatalogAdminTag | null;
}) {
  const [value, setValue] = useState<string>(currentTag ?? '');
  const [status, setStatus] = useState<RowStatus>({ saving: false });
  const [, startTransition] = useTransition();

  const onChange = (nextValue: string) => {
    const prev = value;
    setValue(nextValue);
    setStatus({ saving: true });
    startTransition(async () => {
      const res = await setCatalogTag({
        catalogId,
        inputCondition,
        tag: nextValue === '' ? null : (nextValue as CatalogAdminTag),
      });
      if (!res.ok) {
        setValue(prev);
        setStatus({ saving: false, error: res.error ?? '저장 실패' });
      } else {
        setStatus({ saving: false });
      }
    });
  };

  const selectedOpt =
    TAG_OPTIONS.find((o) => o.value === value) ?? TAG_OPTIONS[0];

  return (
    <div className="flex flex-col gap-0.5">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={status.saving}
        className={`rounded border border-[#D4C5B0] bg-white px-2 py-1 text-[11px] ${selectedOpt.className}`}
      >
        {TAG_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {status.error && (
        <span className="text-[9px] text-red-600">{status.error}</span>
      )}
      {status.saving && (
        <span className="text-[9px] text-[#8B7355]">저장 중…</span>
      )}
    </div>
  );
}
