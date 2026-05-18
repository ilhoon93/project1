/**
 * fal.ai webhook URL 빌더 + secret 검증.
 *
 * 흐름:
 *   1. /api/snap/generate, /api/snap/anchor/generate 에서 fal.queue.submit 시
 *      webhookUrl = buildFalWebhookUrl(req, kind) 로 동봉.
 *   2. fal 작업 완료 시 그 URL 로 POST 콜백.
 *   3. /api/snap/fal-webhook 핸들러가 secret 검증 후 finalize 트리거.
 *
 * 보안:
 *   - URL 경로 안에 query string token (FAL_WEBHOOK_SECRET) 포함. fal 의
 *     payload signing 까지는 본 PR 에 미포함 (향후 강화 가능).
 *   - secret 미설정 시 webhookUrl 생성도 skip → polling fallback 으로 동작.
 *     (즉, secret 없으면 webhook 비활성. 안전.)
 *
 * env:
 *   FAL_WEBHOOK_SECRET   — 토큰 (긴 랜덤 문자열 권장)
 *   FAL_WEBHOOK_BASE_URL — webhook 호스트 (예: https://yourdomain.com).
 *                          미설정 시 요청 origin 에서 추론.
 */

const SECRET_QUERY_KEY = 'token';

export type WebhookKind = 'catalog' | 'anchor';

/**
 * webhook URL 생성. secret 없으면 null 반환 → polling fallback.
 *
 * @param origin   요청 origin (req.headers.get('origin')) 또는 env override
 * @param kind     'catalog' | 'anchor' — webhook 분기에 사용
 */
export function buildFalWebhookUrl(
  origin: string,
  kind: WebhookKind,
): string | null {
  const secret = process.env.FAL_WEBHOOK_SECRET;
  if (!secret) return null;
  const base = process.env.FAL_WEBHOOK_BASE_URL ?? origin;
  if (!base) return null;
  // base 끝의 슬래시 정리.
  const trimmedBase = base.replace(/\/+$/, '');
  const url = new URL(`${trimmedBase}/api/snap/fal-webhook`);
  url.searchParams.set(SECRET_QUERY_KEY, secret);
  url.searchParams.set('kind', kind);
  return url.toString();
}

/**
 * 들어온 webhook 요청의 token 이 env secret 과 일치하는지 검증.
 */
export function verifyWebhookSecret(request: Request): boolean {
  const secret = process.env.FAL_WEBHOOK_SECRET;
  if (!secret) return false;
  const url = new URL(request.url);
  const token = url.searchParams.get(SECRET_QUERY_KEY);
  if (!token) return false;
  // 타이밍 공격 방지를 위한 상수 시간 비교.
  if (token.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) {
    diff |= token.charCodeAt(i) ^ secret.charCodeAt(i);
  }
  return diff === 0;
}
