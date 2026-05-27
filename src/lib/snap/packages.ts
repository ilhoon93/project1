/**
 * AI 웨딩스냅 크레딧 패키지 — 단일 소스.
 *
 * 가격·크레딧·무료 재생성 quota 를 한 곳에서 정의해 랜딩(/wedding-snap) 의
 * 패키지 라인업, Hero 가격, 메타 description, 에디터 AIPanel 안내 문구가
 * 모두 같은 값을 쓰도록 한다. (이전엔 페이지마다 13,900 / 19,900 / "80가지"
 * 같은 숫자가 따로 하드코딩돼 서로 어긋났음.)
 *
 * 결제/크레딧 적립 로직은 code(snap_5 / snap_20 / snap_40) 만 사용하므로
 * 여기 가격/문구를 바꿔도 회계 로직과 무관 — 표시용 단일 소스.
 */

export type SnapPackageCode = 'snap_5' | 'snap_20' | 'snap_40';

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

export const SNAP_PACKAGES: SnapPackageTier[] = [
  {
    code: 'snap_5',
    name: '체험팩',
    credits: 5,
    price: 3900,
    perImage: 780,
    freeRegen: 1,
    highlight: '부담 없이 한 번 만들어 보고 싶을 때',
  },
  {
    code: 'snap_20',
    name: '표준',
    credits: 20,
    price: 13900,
    perImage: 695,
    freeRegen: 4,
    isPopular: true,
    highlight: '청첩장 메인 + 베스트샷 다양하게',
  },
  {
    code: 'snap_40',
    name: '헤비',
    credits: 40,
    price: 24900,
    perImage: 622,
    freeRegen: 8,
    highlight: '카탈로그 풀 활용 · 가성비 최고',
  },
];

/** 가장 저렴한 패키지 가격 — "N원부터" 표기에 사용. */
export const SNAP_STARTING_PRICE = Math.min(...SNAP_PACKAGES.map((p) => p.price));

/** 가장 인기(추천) 패키지 — Hero 기본 노출가에 사용. */
export const SNAP_STANDARD_PACKAGE =
  SNAP_PACKAGES.find((p) => p.isPopular) ?? SNAP_PACKAGES[0];

/** 1,000 단위 구분 + "원" 접미. */
export function formatKRW(won: number): string {
  return `${won.toLocaleString('ko-KR')}원`;
}

/**
 * 패키지별 무료 재생성 quota 를 "체험팩 1회 / 표준 4회 / 헤비 8회" 형태로 묶어
 * 한 문장에 넣을 때 사용. (AboutSnap · PackageLineup 양쪽 footer 가 공유.)
 */
export function freeRegenSummary(): string {
  return SNAP_PACKAGES.map((p) => `${p.name} ${p.freeRegen}회`).join(' / ');
}
