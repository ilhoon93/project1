/**
 * 카탈로그 개수 표기 단일 소스.
 *
 * 실제 노출 카탈로그 수(`getAvailableCatalog().length`) 를 받아 마케팅 카피에
 * 들어갈 안전한 표기를 만든다. 이전엔 "50가지" / "80가지" 가 페이지마다 따로
 * 하드코딩돼 한 페이지 안에서도 숫자가 어긋났음 → 전부 이 헬퍼로 통일.
 *
 * 30개 이상이면 10 단위로 내림해 "약 80가지" 처럼 보수적으로(실제보다 적게)
 * 표기, 30개 미만이면 정확한 수를 노출.
 */

function flooredCount(count: number): number {
  return count >= 30 ? Math.floor(count / 10) * 10 : count;
}

/** Stat 숫자용 — "80+" / "24". */
export function catalogCountStat(count: number): string {
  return count >= 30 ? `${flooredCount(count)}+` : `${count}`;
}

/** 본문 산문용 — "약 80가지" / "24가지". */
export function catalogCountLabel(count: number): string {
  return count >= 30 ? `약 ${flooredCount(count)}가지` : `${count}가지`;
}
