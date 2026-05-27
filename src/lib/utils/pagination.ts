/**
 * 페이지네이션 표시 항목 계산 — 공용 유틸.
 *
 * 총 6 페이지 이하면 전체 번호를, 그 이상이면 현재 페이지를 중심으로 한
 * 윈도우(±1) + 첫/마지막 페이지를 보여 주고 그 사이에 'ellipsis' 를 삽입한다.
 *
 * 예시 (total=12, current=5): [0, 'ellipsis', 4, 5, 6, 'ellipsis', 11]
 *
 * 카탈로그 미리보기(CatalogPreviewClient) · 카탈로그 picker(SnapGenerator) ·
 * 마이페이지 갤러리(mypage-client) 가 동일 로직을 공유 (이전엔 세 곳에 복붙).
 */
export function computePageItems(
  current: number,
  total: number,
): Array<number | 'ellipsis'> {
  if (total <= 6) return Array.from({ length: total }, (_, i) => i);
  const items: Array<number | 'ellipsis'> = [];
  const windowStart = Math.max(1, current - 1);
  const windowEnd = Math.min(total - 2, current + 1);
  items.push(0);
  if (windowStart > 1) items.push('ellipsis');
  for (let i = windowStart; i <= windowEnd; i++) items.push(i);
  if (windowEnd < total - 2) items.push('ellipsis');
  items.push(total - 1);
  return items;
}

/** 카탈로그 그리드 한 페이지당 항목 수 — 미리보기·picker 공통. */
export const CATALOG_PAGE_SIZE = 24;
