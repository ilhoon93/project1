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
    <div className="flex h-full flex-col gap-2 rounded-lg border border-[var(--wd-line)] bg-white p-3 shadow-sm">
      {/*
        헤더 — 필터 아이콘 + 라벨 + 결과 카운트 + 초기화. solid 박스 + 명확한
        섹션 분리로 시각적 hierarchy 강화 (기존 dashed border + 회색 배경 → solid
        white 카드).
        h-full + 부모 row 의 items-stretch 로 좌측 CatalogSelectionGuide 와 같은
        height 정렬 (SnapGenerator 카탈로그 섹션 헤더 아래 2-col row).
      */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--wd-line)] pb-1.5">
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--wd-ink)]">
          <FilterIcon />
          필터
        </span>
        <div className="flex items-center gap-2">
          {resultCount && (
            <span className="rounded-full bg-[var(--wd-cream)] px-2 py-0.5 text-[10px] font-medium text-[var(--wd-ink)] ring-1 ring-[var(--wd-line)]">
              {resultCount.shown === resultCount.total
                ? `${resultCount.total}개`
                : `${resultCount.shown} / ${resultCount.total}`}
            </span>
          )}
          {!isEmptyCatalogFilter(value) && (
            <button
              type="button"
              onClick={() => onChange(EMPTY_CATALOG_FILTER)}
              className="text-[10px] text-[var(--wd-mute)] underline underline-offset-2 hover:text-[var(--wd-ink)]"
            >
              초기화
            </button>
          )}
        </div>
      </div>

      {/*
        모드 (추천만 / 전체) — 가장 자주 쓰는 1차 액션. emerald 강조로 명확히
        구별. 정렬과 같은 row 좌우 배치, 좁은 폭에선 wrap.
      */}
      {(showRecommendToggle || showSortChips) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {showRecommendToggle && (
            <div className="inline-flex rounded-full bg-[var(--wd-cream)] p-0.5 ring-1 ring-[var(--wd-line)]">
              <SegmentedButton
                selected={!!onlyRecommended}
                onClick={() => onOnlyRecommendedChange!(true)}
                label="추천만"
                accent="emerald"
              />
              <SegmentedButton
                selected={!onlyRecommended}
                onClick={() => onOnlyRecommendedChange!(false)}
                label="전체"
                accent="emerald"
              />
            </div>
          )}
          {showSortChips && (
            <div className="inline-flex rounded-full bg-[var(--wd-cream)] p-0.5 ring-1 ring-[var(--wd-line)]">
              {(
                [
                  { value: 'default', label: '추천순' },
                  { value: 'popular', label: '인기순' },
                  { value: 'most-liked', label: '좋아요순' },
                ] as Array<{ value: CatalogSortMode; label: string }>
              ).map((opt) => (
                <SegmentedButton
                  key={opt.value}
                  selected={sortMode === opt.value}
                  onClick={() => onSortModeChange!(opt.value)}
                  label={opt.label}
                  accent="brown"
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/*
        세부 필터 (누가/배경/컷) — 인라인 라벨 + chip. 그룹 간 세로 구분선으로
        시각적으로 분리, 좁은 폭에선 wrap 시 구분선 자연 제거.
      */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <InlineChipGroup
          label="누가"
          options={PERSONALITY_OPTIONS}
          selected={value.personalities}
          onToggle={(v) =>
            onChange({ ...value, personalities: toggle(value.personalities, v) })
          }
        />
        <InlineChipGroup
          label="배경"
          options={BACKDROP_OPTIONS}
          selected={value.backdrops}
          onToggle={(v) =>
            onChange({ ...value, backdrops: toggle(value.backdrops, v) })
          }
        />
        <InlineChipGroup
          label="컷"
          options={FRAMING_OPTIONS}
          selected={value.framings}
          onToggle={(v) => onChange({ ...value, framings: toggle(value.framings, v) })}
        />
      </div>
    </div>
  );
}

/** 작은 SVG 깔때기 아이콘 — 필터 라벨 옆 시각적 단서. */
function FilterIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="text-[var(--wd-mute)]"
    >
      <path d="M3 4h14l-5.5 7v5l-3 1v-6L3 4z" />
    </svg>
  );
}

/**
 * 세그먼트 컨트롤 버튼 — 추천만/전체 + 정렬 chip 에 공통 사용. 둥근 캡슐 안에서
 * pill 형태로 선택된 버튼만 강조.
 */
function SegmentedButton({
  selected,
  onClick,
  label,
  accent,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  accent: 'emerald' | 'brown';
}) {
  const activeBg = accent === 'emerald' ? 'bg-emerald-600' : 'bg-[var(--wd-ink)]';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
        selected
          ? `${activeBg} text-white shadow-sm`
          : 'text-[var(--wd-ink)] hover:text-[var(--wd-ink)]'
      }`}
    >
      {label}
    </button>
  );
}

/**
 * 인라인 chip 그룹 — 라벨 + chip 들이 한 row 안에 같이 흐른다. 여러 그룹을 한
 * wrapping container 에 넣으면 자연스럽게 좁은 폭에서 wrap, 넓은 폭에선 한 줄에
 * 같이 보임. (기존 FilterChipGroup 의 row 1 개 = 1 그룹 레이아웃 대비 빈공간 ↓)
 */
function InlineChipGroup<T extends string>({
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
    <div className="flex items-center gap-1">
      <span className="text-[10px] font-medium text-[var(--wd-ink)]">{label}</span>
      {options.map((opt) => {
        const isOn = selected.has(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onToggle(opt.value)}
            aria-pressed={isOn}
            className={`rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
              isOn
                ? 'border-[var(--wd-ink)] bg-[var(--wd-ink)] text-white'
                : 'border-[var(--wd-line)] bg-white text-[var(--wd-ink)] hover:border-[var(--wd-mute)]'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

