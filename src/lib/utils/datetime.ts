/**
 * 한국시간(KST, Asia/Seoul) 고정 날짜 포맷 유틸.
 *
 * DB 는 timestamptz(UTC 저장)가 정상이며, 표시할 때 KST 로 변환한다. toLocale*
 * 에 timeZone 을 지정하지 않으면 실행 환경(서버=UTC, 브라우저=로컬)을 따라가
 * SSR 에서 9시간 어긋나거나 hydration 불일치가 난다. 이 유틸로 어디서 렌더되든
 * 항상 KST 로 일관되게 표시한다.
 */

const KST_TZ = 'Asia/Seoul';

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** KST 날짜 (기본: 로케일 기본 형식). 잘못된 값이면 '-'. */
export function formatKstDate(
  value: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = toDate(value);
  if (!d) return '-';
  return d.toLocaleDateString('ko-KR', { timeZone: KST_TZ, ...(options ?? {}) });
}

/** KST 날짜+시각 (기본: yy/mm/dd hh:mm). 잘못된 값이면 '-'. */
export function formatKstDateTime(
  value: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = toDate(value);
  if (!d) return '-';
  return d.toLocaleString('ko-KR', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: KST_TZ,
    ...(options ?? {}),
  });
}
