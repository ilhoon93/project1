import type { DateFormat } from '@/types/invitation';

/**
 * 결혼식 날짜 표시 포맷터.
 *
 * ISO 문자열(YYYY-MM-DD) 을 받아 사용자가 고른 출력 형식으로 변환.
 * 잘못된 입력은 원본을 그대로 돌려 안전 폴백.
 *
 * 사용처:
 *   - 슬라이드 렌더 (BasicInfoSlide / MainSlide 등)
 *   - 에디터의 출력 미리보기
 */
export function formatWeddingDate(
  iso: string | null | undefined,
  format: DateFormat,
): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  switch (format) {
    case 'YYYY.MM.DD':
      return `${y}.${mo}.${d}`;
    case 'YYYY년MM월DD일':
      return `${y}년${mo}월${d}일`;
    case 'YYYY-MM-DD':
      return `${y}-${mo}-${d}`;
    case 'YYYY/MM/DD':
      return `${y}/${mo}/${d}`;
  }
}

/**
 * 사용자가 8자리 숫자(20260523) 만 입력해도 ISO(2026-05-23) 로 저장하기 위한
 * 정규화. 4자리 연도 / 2자리 월·일을 분리. 잘못된 입력이면 null.
 */
export function normalizeDateInput(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  const y = digits.slice(0, 4);
  const mo = digits.slice(4, 6);
  const d = digits.slice(6, 8);
  // 간단 검증 — 월 1~12, 일 1~31 (정확한 윤년 검증은 생략)
  const moNum = Number(mo);
  const dNum = Number(d);
  if (moNum < 1 || moNum > 12 || dNum < 1 || dNum > 31) return null;
  return `${y}-${mo}-${d}`;
}
