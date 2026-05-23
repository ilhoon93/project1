'use client';

/**
 * 카탈로그 1장을 그리는 공통 카드.
 *
 * 랜딩(/wedding-snap) 미리보기와 생성 페이지(/wedding-snap/create) 의 카탈로그
 * picker 양쪽이 같은 카드를 쓰도록 분리. 모든 카드가 동일한 비율 / 레이아웃을
 * 가져 그리드가 깔끔하게 정렬된다:
 *
 *   1. 이미지 영역  : 세로 3:4 (CatalogThumbnail), `object-contain` 으로 중앙 정렬
 *      → 가로형 마스터도 잘리지 않고 양옆 여백으로 표시. 모든 카드가 같은 높이.
 *   2. 설명 영역    : 라벨 1줄(truncate) + hint 2줄(line-clamp-2). min-h 로 텍스트
 *      길이가 달라도 카드 전체 높이 동일.
 *
 * 두 가지 모드:
 *   - 'preview' (랜딩) — 클릭 불가능한 정보 카드. 우상단 personality badge.
 *   - 'picker'  (생성) — 클릭/선택 가능. badge + 체크 인디케이터 + 호환성 경고.
 *
 * 클릭 가능 props (`onClick`, `selected`, `disabled`) 는 picker 에서만 의미를 가지며
 * preview 에서는 단순 `<div>` 로 렌더.
 */

import type { ReactNode } from 'react';
import type { SnapCatalogItem } from '@/lib/snap/catalog';
import { CatalogThumbnail } from '@/components/snap/CatalogThumbnail';

interface BaseProps {
  item: SnapCatalogItem;
  /** picker 모드에서만 의미. 좌하단에 호환성 경고 chip 표시. */
  overlay?: ReactNode;
  /** 카드 우상단 추가 인디케이터 (예: ✓ 체크). picker 에서만 사용. */
  topRight?: ReactNode;
}

interface PreviewProps extends BaseProps {
  variant: 'preview';
}

interface PickerProps extends BaseProps {
  variant: 'picker';
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  title?: string;
}

type Props = PreviewProps | PickerProps;

export function CatalogCard(props: Props) {
  const { item, overlay, topRight } = props;
  const inner = (
    <>
      {topRight}
      {overlay}
      <CatalogThumbnail src={item.image} alt={item.label} />
      <PersonalityBadge personality={item.personality} />
      <CardCaption label={item.label} hint={item.hint} />
    </>
  );

  if (props.variant === 'preview') {
    return (
      <div className="relative flex flex-col overflow-hidden rounded-md border border-[#E8DCC9] bg-white">
        {inner}
      </div>
    );
  }

  const { selected, disabled, onClick, title } = props;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      title={title}
      className={`relative flex flex-col overflow-hidden rounded-md border text-left transition-colors ${
        selected
          ? 'border-[#3D2E1F] ring-2 ring-[#3D2E1F]/30'
          : 'border-[#E8DCC9] hover:border-[#8B7355]'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      {inner}
    </button>
  );
}

function CardCaption({ label, hint }: { label: string; hint: string }) {
  // min-h 로 라벨 1줄 + hint 2줄을 항상 차지하게 해서 카드 높이 통일.
  // line-clamp-2 는 hint 가 길어도 2줄까지만 + ellipsis.
  return (
    <div className="flex min-h-[56px] flex-col gap-0.5 p-2">
      <p className="truncate text-xs font-medium text-[#3D2E1F]">{label}</p>
      <p className="line-clamp-2 text-[10px] leading-snug text-[#8B7355]">{hint}</p>
    </div>
  );
}

function PersonalityBadge({ personality }: { personality: SnapCatalogItem['personality'] }) {
  const config = {
    together: { label: '함께', color: 'bg-[#3D2E1F]/85' },
    'groom-solo': { label: '신랑 단독', color: 'bg-blue-600/85' },
    'bride-solo': { label: '신부 단독', color: 'bg-pink-600/85' },
  }[personality];
  return (
    <span
      className={`absolute left-1 top-1 z-10 rounded px-1.5 py-0.5 text-[9px] font-medium text-white ${config.color}`}
    >
      {config.label}
    </span>
  );
}
