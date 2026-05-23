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
  { value: 'half', label: '반신' },
  { value: 'full', label: '전신' },
];

interface Props {
  value: CatalogFilterState;
  onChange: (next: CatalogFilterState) => void;
  /** chip 위에 보일 결과 카운트 — 옵션 (예: 표시 N / 전체 M) */
  resultCount?: { shown: number; total: number };
}

export function CatalogFilterBar({ value, onChange, resultCount }: Props) {
  const toggle = <T,>(set: ReadonlySet<T>, v: T): Set<T> => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  };

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
    </div>
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
