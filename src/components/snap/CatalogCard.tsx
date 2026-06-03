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
  /** 운영자가 '추천' 태그를 단 카탈로그면 좌상단 personality 배지 아래에 ★ 추천 chip 표시. */
  isRecommended?: boolean;
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
  const { item, overlay, topRight, isRecommended } = props;
  // 카드 height 일관성을 위해 부모 컨테이너에 h-full 을 줘서 그리드 row 의
  // max-height 에 모든 카드가 stretch 되도록 한다. 내부는 flex 로 이미지(고정
  // aspect 3:4) + caption(고정 h-16) 만 차지하므로 height 가 모든 카드에서 동일.
  const inner = (
    <>
      {topRight}
      {overlay}
      <CatalogThumbnail src={item.image} alt={item.label} />
      <BadgeStack personality={item.personality} isRecommended={isRecommended ?? false} />
      <CardCaption label={item.label} hint={item.hint} />
    </>
  );

  if (props.variant === 'preview') {
    return (
      <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--wd-line)] bg-[var(--wd-paper)]">
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
      className={`relative flex h-full flex-col overflow-hidden rounded-md border text-left transition-colors ${
        selected
          ? 'border-[var(--wd-ink)] ring-2 ring-[var(--wd-ink)]/30'
          : 'border-[var(--wd-line)] hover:border-[var(--wd-mute)]'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      {inner}
    </button>
  );
}

function CardCaption({ label, hint }: { label: string; hint: string }) {
  // h-16 (=64px) 고정 — 라벨 1줄 truncate + hint 2줄 line-clamp 가 들어가는
  // 최소 + 여유 공간. min-h 가 아닌 정확한 h 로 모든 카드 caption 영역 동일.
  // flex-1 으로 남은 공간을 caption 이 차지 → 카드 전체가 그리드 row 에 맞춰
  // stretch 됐을 때도 이미지 영역 비율 유지 + caption 영역 통일.
  return (
    <div className="flex h-16 flex-col justify-start gap-0.5 px-2 py-2">
      <p className="truncate text-xs font-medium leading-tight text-[var(--wd-ink)]">
        {label}
      </p>
      <p className="line-clamp-2 text-[10px] leading-snug text-[var(--wd-mute)]">{hint}</p>
    </div>
  );
}

/**
 * 좌상단 배지 스택 — personality 배지 + (옵션) 운영자 추천 배지.
 * 두 배지를 세로로 쌓아 서로 겹치지 않게.
 */
function BadgeStack({
  personality,
  isRecommended,
}: {
  personality: SnapCatalogItem['personality'];
  isRecommended: boolean;
}) {
  const config = {
    // '함께' — 신랑(파랑)·신부(분홍)·코랄과 구분되도록 보라 계열로.
    together: { label: '함께', color: 'bg-violet-600' },
    'groom-solo': { label: '신랑 단독', color: 'bg-blue-600' },
    'bride-solo': { label: '신부 단독', color: 'bg-pink-600' },
  }[personality];
  return (
    <div className="absolute left-1 top-1 z-10 flex flex-col items-start gap-1">
      <span
        className={`rounded px-1.5 py-0.5 text-[9px] font-medium text-white shadow-sm ring-1 ring-black/10 ${config.color}`}
      >
        {config.label}
      </span>
      {isRecommended && (
        <span className="rounded bg-emerald-600/90 px-1.5 py-0.5 text-[9px] font-semibold text-white shadow-sm">
          ★ 추천
        </span>
      )}
    </div>
  );
}
