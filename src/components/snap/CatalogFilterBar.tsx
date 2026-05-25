'use client';

/**
 * 카탈로그 검색/필터 chip 바.
 *
 * 세 그룹의 필터를 chip 토글로 노출 — 모두 OR within group, AND across groups.
 *   1. personality : 신랑 단독 / 신부 단독 / 함께
 *   2. backdrop    : 스튜디오 / 야외 (한옥·도심·해변 모두 야외 통합)
 *   3. framing     : 클로즈업 / 반신 / 전신
 *
 * 사용처: 랜딩 페이지(/wedding-snap) 미리보기 + 생성 페이지(/wedding-snap/create)
 * 카탈로그 picker. 두 곳이 같은 컴포넌트 + 동일 필터 상태 모델을 공유해 일관된
 * 사용자 경험을 보장.
 *
 * 비어 있는(아무 chip 도 안 켜진) 그룹은 "전부 허용" 으로 간주 → 사용자가 한 번도
 * 만진 적 없는 카탈로그도 그대로 노출되는 게 디폴트.
 */

import type {
  CatalogBackdrop,
  CatalogFraming,
  CatalogPersonality,
  SnapCatalogItem,
} from '@/lib/snap/catalog';
import { backdropOf, framingOf } from '@/lib/snap/catalog';

export interface CatalogFilterState {
  personalities: ReadonlySet<CatalogPersonality>;
  backdrops: ReadonlySet<CatalogBackdrop>;
  framings: ReadonlySet<CatalogFraming>;
}

export const EMPTY_CATALOG_FILTER: CatalogFilterState = {
  personalities: new Set(),
  backdrops: new Set(),
  framings: new Set(),
};

/**
 * 정렬 옵션 — 사용자 페이지에서 추천 4단계 외에 인기/좋아요 기반 정렬 추가.
 *   default       : 기존 추천 > 기본 > 주의 > 비추 + 코드 정의 순서
 *   popular       : gen_count 내림차순 (많이 생성된 카탈로그 우선)
 *   most-liked    : like_count 내림차순 (가장 좋아요 많은 카탈로그 우선)
 *
 * snap_catalog_stats view (031) 가 popular/most-liked 의 source. stats 없는
 * 카탈로그는 0 으로 간주되어 뒤로 밀림. tie-break 는 코드 정의 순서.
 */
export type CatalogSortMode = 'default' | 'popular' | 'most-liked';

/**
 * `EMPTY_CATALOG_FILTER` (모든 그룹 비어 있음) 인지. true 면 "필터 없음" 으로
 * 안내 텍스트를 다르게 그릴 수 있음.
 */
export function isEmptyCatalogFilter(f: CatalogFilterState): boolean {
  return f.personalities.size === 0 && f.backdrops.size === 0 && f.framings.size === 0;
}

/**
 * 카탈로그 배열에 필터 적용. 빈 그룹은 무시(전부 허용).
 */
export function applyCatalogFilter(
  items: SnapCatalogItem[],
  f: CatalogFilterState,
): SnapCatalogItem[] {
  return items.filter((it) => {
    if (f.personalities.size > 0 && !f.personalities.has(it.personality)) return false;
    if (f.backdrops.size > 0 && !f.backdrops.has(backdropOf(it))) return false;
    if (f.framings.size > 0 && !f.framings.has(framingOf(it))) return false;
    return true;
  });
}

const PERSONALITY_OPTIONS: Array<{ value: CatalogPersonality; label: string }> = [
  { value: 'groom-solo', label: '신랑' },
  { value: 'bride-solo', label: '신부' },
  { value: 'together', label: '함께' },
];

const BACKDROP_OPTIONS: Array<{ value: CatalogBackdrop; label: string }> = [
  { value: 'studio', label: '스튜디오' },
  { value: 'outdoor', label: '야외' },
];

const FRAMING_OPTIONS: Array<{ value: CatalogFraming; label: string }> = [
  { value: 'closeup', label: '클로즈업' },
  { value: 'full', label: '전신' },
];

interface Props {
  value: CatalogFilterState;
  onChange: (next: CatalogFilterState) => void;
  /** chip 위에 보일 결과 카운트 — 옵션 (예: 표시 N / 전체 M) */
  resultCount?: { shown: number; total: number };
  /**
   * "추천만 보기" 모드 (있으면 추천 태그 카탈로그만 노출, 주의/비추 숨김).
   * undefined = 토글 UI 자체 안 보임 (admin 태그 없는 환경에서 사용).
   */
  onlyRecommended?: boolean;
  onOnlyRecommendedChange?: (next: boolean) => void;
  /**
   * 정렬 모드 — 옵션. 전달 시 정렬 chip 그룹 노출.
   * undefined = 정렬 chip 자체 안 보임 (legacy 사용처 호환).
   */
  sortMode?: CatalogSortMode;
  onSortModeChange?: (next: CatalogSortMode) => void;
}

export function CatalogFilterBar({
  value,
  onChange,
  resultCount,
  onlyRecommended,
  onOnlyRecommendedChange,
  sortMode,
  onSortModeChange,
}: Props) {
  const toggle = <T,>(set: ReadonlySet<T>, v: T): Set<T> => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  };

  const showRecommendToggle =
    typeof onlyRecommended === 'boolean' && !!onOnlyRecommendedChange;
  const showSortChips = !!sortMode && !!onSortModeChange;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed border-[#E8DCC9] bg-[#FAF7F2]/60 p-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[11px] font-medium text-[#3D2E1F]">검색 필터</span>
        <div className="flex items-center gap-2">
          {resultCount && (
            <span className="text-[10px] text-[#8B7355]">
              {resultCount.shown === resultCount.total
                ? `전체 ${resultCount.total}개`
                : `${resultCount.shown}개 / 전체 ${resultCount.total}개`}
            </span>
          )}
          {!isEmptyCatalogFilter(value) && (
            <button
              type="button"
              onClick={() => onChange(EMPTY_CATALOG_FILTER)}
              className="text-[10px] text-[#8B7355] underline underline-offset-2 hover:text-[#3D2E1F]"
            >
              필터 초기화
            </button>
          )}
        </div>
      </div>

      {/* 추천만 보기 / 전체 보기 — 가장 자주 쓰는 1차 필터라 맨 위. */}
      {showRecommendToggle && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-9 shrink-0 text-[10px] font-medium text-[#5C4633]">
            모드
          </span>
          <PrimaryToggle
            selected={!!onlyRecommended}
            onClick={() => onOnlyRecommendedChange!(true)}
            label="추천만 보기"
          />
          <PrimaryToggle
            selected={!onlyRecommended}
            onClick={() => onOnlyRecommendedChange!(false)}
            label="전체 보기"
          />
        </div>
      )}

      <FilterChipGroup
        label="누가"
        options={PERSONALITY_OPTIONS}
        selected={value.personalities}
        onToggle={(v) => onChange({ ...value, personalities: toggle(value.personalities, v) })}
      />
      <FilterChipGroup
        label="배경"
        options={BACKDROP_OPTIONS}
        selected={value.backdrops}
        onToggle={(v) => onChange({ ...value, backdrops: toggle(value.backdrops, v) })}
      />
      <FilterChipGroup
        label="컷"
        options={FRAMING_OPTIONS}
        selected={value.framings}
        onToggle={(v) => onChange({ ...value, framings: toggle(value.framings, v) })}
      />

      {/* 정렬 — 추천/인기/좋아요 중 단일 선택. snap_catalog_stats view 기반. */}
      {showSortChips && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-9 shrink-0 text-[10px] font-medium text-[#5C4633]">정렬</span>
          {(
            [
              { value: 'default', label: '추천순' },
              { value: 'popular', label: '인기순' },
              { value: 'most-liked', label: '좋아요순' },
            ] as Array<{ value: CatalogSortMode; label: string }>
          ).map((opt) => {
            const isOn = sortMode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onSortModeChange!(opt.value)}
                aria-pressed={isOn}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
                  isOn
                    ? 'border-[#3D2E1F] bg-[#3D2E1F] text-white'
                    : 'border-[#D4C5B0] bg-white text-[#5C4633] hover:border-[#8B7355] hover:text-[#3D2E1F]'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PrimaryToggle({
  selected,
  onClick,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
        selected
          ? 'border-emerald-700 bg-emerald-600 text-white'
          : 'border-[#D4C5B0] bg-white text-[#5C4633] hover:border-[#8B7355] hover:text-[#3D2E1F]'
      }`}
    >
      {label}
    </button>
  );
}

function FilterChipGroup<T extends string>({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  selected: ReadonlySet<T>;
  onToggle: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-9 shrink-0 text-[10px] font-medium text-[#5C4633]">{label}</span>
      {options.map((opt) => {
        const isOn = selected.has(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onToggle(opt.value)}
            aria-pressed={isOn}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
              isOn
                ? 'border-[#3D2E1F] bg-[#3D2E1F] text-white'
                : 'border-[#D4C5B0] bg-white text-[#5C4633] hover:border-[#8B7355] hover:text-[#3D2E1F]'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
