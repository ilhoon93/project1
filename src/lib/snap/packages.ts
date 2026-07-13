/**
 * AI 웨딩스냅 크레딧 패키지 — 단일 소스.
 *
 * 가격·크레딧·무료 재생성 quota 를 한 곳에서 정의해 랜딩(/) 의 Pricing 카드,
 * 메인 페이지 메타 description, /wedding-snap 설명 문구가 모두 같은 값을
 * 쓰도록 한다.
 *
 * 결제/크레딧 적립 로직은 code 만 사용하므로 여기 가격/문구를 바꾸면 동시에
 * supabase/migrations 의 가격 update + grant_purchase_credits 분기도 함께
 * 맞춰야 한다 (035_pricing_2026_05.sql 참고).
 */

export type SnapPackageCode =
  | 'snap_5'
  | 'snap_10'
  | 'snap_20'
  | 'snap_40'
  /**
   * 알림장(`basic` 패키지) 결제와 함께 묶음으로만 구매 가능한 10장 번들 SKU.
   * 단독 10장(snap_10, 12,900원) 대비 3,000원 할인 = 9,900원.
   */
  | 'snap_10_bundle';

export interface SnapPackageTier {
  code: SnapPackageCode;
  /** 표시 이름 (배지 "추천" 은 isPopular 로 별도) */
  name: string;
  /** 적립 스냅 크레딧 수 = 생성 가능 컷 수 */
  credits: number;
  /** 결제 금액 (원) */
  price: number;
  /** 컷당 단가 (원, 반올림) */
  perImage: number;
  /** 패키지 결제 시 함께 적립되는 카탈로그 결과 무료 재생성 횟수 */
  freeRegen: number;
  /** 가장 인기 = 추천 배지 + 강조 테두리 */
  isPopular?: boolean;
  /** 한 줄 소개 */
  highlight?: string;
}

/**
 * 단독으로 구매 가능한 4종 (Pricing 카드 메인 라인업).
 * 번들 SKU(snap_10_bundle) 는 알림장 결제 화면에서만 노출되므로 여기 미포함.
 */
export const SNAP_PACKAGES: SnapPackageTier[] = [
  {
    code: 'snap_5',
    name: '체험팩',
    credits: 5,
    price: 7900,
    perImage: 1580,
    freeRegen: 1,
    highlight: '부담 없이 한 번 만들어 보고 싶을 때',
  },
  {
    code: 'snap_10',
    name: '소형',
    credits: 10,
    price: 12900,
    perImage: 1290,
    freeRegen: 2,
    highlight: '청첩장 메인 + 베스트샷 몇 장',
  },
  {
    code: 'snap_20',
    name: '표준',
    credits: 20,
    price: 19900,
    perImage: 995,
    freeRegen: 4,
    isPopular: true,
    highlight: '청첩장 메인 + 베스트샷 다양하게',
  },
  {
    code: 'snap_40',
    name: '헤비',
    credits: 40,
    price: 29900,
    perImage: 748,
    freeRegen: 8,
    highlight: '카탈로그 풀 활용 · 가성비 최고',
  },
];

/**
 * 알림장 결제 시 함께 묶을 수 있는 번들 SKU. 단독 10장(snap_10, 12,900원)
 * 대비 3,000원 할인. 알림장 결제 화면에서만 추가 옵션으로 노출.
 */
export const SNAP_BUNDLE_PACKAGE: SnapPackageTier = {
  code: 'snap_10_bundle',
  name: '알림장 번들 · AI 스냅 10장',
  credits: 10,
  price: 9900,
  perImage: 990,
  freeRegen: 2,
  highlight: '알림장과 함께 결제하면 3,000원 할인',
};

/** 가장 저렴한 단독 패키지 가격 — "N원부터" 표기에 사용. 번들은 제외. */
export const SNAP_STARTING_PRICE = Math.min(...SNAP_PACKAGES.map((p) => p.price));

/** 가장 인기(추천) 패키지 — Hero 기본 노출가에 사용. */
export const SNAP_STANDARD_PACKAGE =
  SNAP_PACKAGES.find((p) => p.isPopular) ?? SNAP_PACKAGES[0];

/** 1,000 단위 구분 + "원" 접미. */
export function formatKRW(won: number): string {
  return `${won.toLocaleString('ko-KR')}원`;
}

/**
 * 패키지별 무료 재생성 quota 를 "체험팩 1회 / 소형 2회 / 표준 4회 / 헤비 8회"
 * 형태로 묶어 한 문장에 넣을 때 사용. (Pricing 카드 footnote + /wedding-snap 안내.)
 */
export function freeRegenSummary(): string {
  return SNAP_PACKAGES.map((p) => `${p.name} ${p.freeRegen}회`).join(' / ');
}

// ─────────────────────────────────────────────────────────────
// 알림장 / 영구소장 — 메인 Pricing 카드 표시용 단일 소스.
// ─────────────────────────────────────────────────────────────

/** 알림장 1건 결제 가격 (basic 패키지). */
export const INVITATION_PRICE = 9900;

/**
 * 발행 후 공개 링크 30일 만료를 영구로 전환하는 "영구소장" 추가 결제.
 * (DB code: archive_basic — 016 이전 14,900 → 035 에서 3,000 으로 인하.)
 */
export const ARCHIVE_PRICE = 3000;

/**
 * 알림장 상품(스마트스토어 13622908142)의 전체 옵션 조합 — 홈 가격 카드 단일 소스.
 * addonPrice 는 기본가(INVITATION_PRICE) 대비 추가금이며, 총액 = INVITATION_PRICE + addonPrice.
 * 지급 크레딧 매핑은 supabase/migrations 의 naver_option_grants(041/055)와 일치해야 한다.
 */
export interface InvitationOption {
  /** 스마트스토어 옵션코드 (참고용). */
  optionCode: string;
  label: string;
  /** 기본가 대비 추가금 (원). 0 = 기본 옵션. */
  addonPrice: number;
  /** 한 줄 설명. */
  note: string;
}

export const INVITATION_OPTIONS: InvitationOption[] = [
  {
    optionCode: '58929908992',
    label: '알림장 기본',
    addonPrice: 0,
    note: '알림장 1건 발행 · 하객용 + 소장용 URL',
  },
  {
    optionCode: '58929908993',
    label: '알림장 + 영구소장',
    addonPrice: ARCHIVE_PRICE,
    note: '공개 30일 만료를 영구로 — 메시지·서명·통계 보존',
  },
  {
    optionCode: '58929908994',
    label: '알림장 + AI 웨딩스냅 10+2장',
    addonPrice: 9900,
    note: 'AI 스냅 10장(+무료 재생성 2) · 단독 대비 3,000원 할인',
  },
  {
    optionCode: '58929916256',
    label: '알림장 + 영구소장 & AI 웨딩스냅 5+1장',
    addonPrice: 9900,
    note: '영구소장 + AI 스냅 5장(+무료 재생성 1)',
  },
  {
    optionCode: '59246230104',
    label: '알림장 1+1',
    addonPrice: 5000,
    note: '알림장 2건 발행',
  },
  {
    optionCode: '59246230105',
    label: '알림장 1+1 + 영구소장',
    addonPrice: 8000,
    note: '알림장 2건 발행 + 두 건 모두 영구소장',
  },
];
