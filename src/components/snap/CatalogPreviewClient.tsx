'use client';

/**
 * 랜딩 페이지(/wedding-snap) 카탈로그 미리보기.
 *
 * 서버에서 `getAvailableCatalog()` 으로 받은 visible 항목 전체를 props 로 받고,
 * client-side 에서 chip 필터(personality / backdrop / framing) + 정렬 (추천/인기/
 * 좋아요) 을 적용해 그리드를 다시 그린다. 생성 페이지(/wedding-snap/create) 의
 * picker 와 동일한 필터 컴포넌트(CatalogFilterBar) + 동일한 카드(CatalogCard) 를
 * 써서 두 페이지의 UX 일관성을 유지.
 *
 * stats prop 이 있으면 정렬 chip 노출, 없으면 default (코드 순서) 유지.
 */

import { useMemo, useState } from 'react';
import type { SnapCatalogItem } from '@/lib/snap/catalog';
import { CatalogCard } from '@/components/snap/CatalogCard';
import {
  CatalogFilterBar,
  EMPTY_CATALOG_FILTER,
  applyCatalogFilter,
  type CatalogFilterState,
  type CatalogSortMode,
} from '@/components/snap/CatalogFilterBar';
import type { CatalogStatsMap } from '@/lib/snap/catalog-stats';

export function CatalogPreviewClient({
  items,
  catalogStats,
}: {
  items: SnapCatalogItem[];
  catalogStats?: CatalogStatsMap;
}) {
  const [filter, setFilter] = useState<CatalogFilterState>(EMPTY_CATALOG_FILTER);
  const [sortMode, setSortMode] = useState<CatalogSortMode>('default');

  const sorted = useMemo(() => {
    if (!catalogStats || sortMode === 'default') return items;
    const key: 'genCount' | 'likeCount' =
      sortMode === 'popular' ? 'genCount' : 'likeCount';
    return items
      .map((it, idx) => ({
        it,
        idx,
        v: catalogStats[it.id]?.[key] ?? 0,
      }))
      .sort((a, b) => (b.v - a.v) || (a.idx - b.idx))
      .map((x) => x.it);
  }, [items, catalogStats, sortMode]);

  const filtered = applyCatalogFilter(sorted, filter);

  return (
    <div className="flex flex-col gap-3">
      <CatalogFilterBar
        value={filter}
        onChange={setFilter}
        resultCount={{ shown: filtered.length, total: items.length }}
        sortMode={catalogStats ? sortMode : undefined}
        onSortModeChange={catalogStats ? setSortMode : undefined}
      />
      {filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-[#E8DCC9] bg-white p-6 text-center text-xs text-[#8B7355]">
          선택한 필터 조합에 맞는 카탈로그가 없어요. 필터를 조정해 보세요.
        </p>
      ) : (
        // auto-rows-fr 로 한 row 안의 모든 카드가 동일 height 로 stretch.
        // CatalogCard 의 h-full 과 결합되어 카드 caption 영역까지 정렬 통일.
        <div className="grid auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {filtered.map((item) => (
            <CatalogCard key={item.id} variant="preview" item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
