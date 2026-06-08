/**
 * Naver Commerce API helpers.
 *
 * The Naver Commerce API (커머스 API) is *separate* from Naver Login —
 * it requires its own application registered in
 *   https://apicenter.commerce.naver.com
 * with Client ID + Client Secret. The token endpoint uses a self-signed
 * client_secret (HMAC-SHA256 of `clientId_timestamp`) to mint a short-
 * lived access token (≈ 3h) which is then used to query orders.
 *
 * This module wraps:
 *   - getCommerceAccessToken()  — token issuance
 *   - lookupOrder(orderNo)      — pull a single order by 주문번호
 *   - lookupProductOrder(no)    — pull by 상품주문번호 (preferred for unique grant)
 *
 * If env vars are missing the helpers throw — the API route surfaces
 * a friendly fallback so manual order entry still works in dev.
 */

import bcrypt from 'bcryptjs';
import { ProxyAgent } from 'undici';

const COMMERCE_BASE = 'https://api.commerce.naver.com/external';

const env = (key: string): string => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
};

/**
 * 커머스 API 는 "API호출 IP" 화이트리스트를 강제한다(등록한 IP 에서 온 요청만
 * 허용). Vercel 서버리스는 고정 출발 IP 가 없으므로, NAVER_COMMERCE_PROXY 에
 * 고정 IP VPS 의 정방향 프록시(예: http://user:pass@1.2.3.4:8888)를 지정하면
 * 커머스 API 호출만 그 프록시를 경유해 IP 가 고정된다. 그 프록시 IP 를
 * 커머스 API 센터에 등록하면 된다. 미설정이면 직접 호출(로컬 개발 등).
 */
let cachedDispatcher: ProxyAgent | null | undefined;
const proxyDispatcher = (): ProxyAgent | null => {
  if (cachedDispatcher !== undefined) return cachedDispatcher;
  const url = process.env.NAVER_COMMERCE_PROXY;
  cachedDispatcher = url ? new ProxyAgent(url) : null;
  return cachedDispatcher;
};

// global fetch(undici) 에 dispatcher 를 주입하기 위한 래퍼. RequestInit 표준
// 타입에는 dispatcher 가 없어 확장 타입으로 캐스팅한다.
const commerceFetch = (url: string, init: RequestInit): Promise<Response> => {
  const dispatcher = proxyDispatcher();
  const opts = dispatcher ? { ...init, dispatcher } : init;
  return fetch(url, opts as RequestInit);
};

export const isCommerceApiConfigured = () =>
  !!process.env.NAVER_COMMERCE_CLIENT_ID && !!process.env.NAVER_COMMERCE_CLIENT_SECRET;

interface CommerceToken {
  access_token: string;
  expires_in: number;
  token_type: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

const buildClientSecretSign = (clientId: string, secret: string, timestampMs: number) => {
  // 네이버 커머스 API 전자서명:
  //   sign = base64( bcrypt( "{clientId}_{timestamp}", clientSecret ) )
  // 여기서 clientSecret(`$2a$10$...` 형태) 자체가 bcrypt salt 로 쓰인다.
  // (HMAC-SHA256 등 다른 방식은 토큰 발급 단계에서 거부됨.)
  const password = `${clientId}_${timestampMs}`;
  const hashed = bcrypt.hashSync(password, secret);
  return Buffer.from(hashed, 'utf-8').toString('base64');
};

export const getCommerceAccessToken = async (): Promise<string> => {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }

  const clientId = env('NAVER_COMMERCE_CLIENT_ID');
  const secret = env('NAVER_COMMERCE_CLIENT_SECRET');
  const timestamp = now;
  const signature = buildClientSecretSign(clientId, secret, timestamp);

  const params = new URLSearchParams({
    client_id: clientId,
    timestamp: String(timestamp),
    grant_type: 'client_credentials',
    client_secret_sign: signature,
    type: 'SELF',
  });

  const res = await commerceFetch(`${COMMERCE_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Naver Commerce token failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as CommerceToken;
  cachedToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };
  return data.access_token;
};

export interface CommerceProductOrder {
  productOrderId: string; // 상품주문번호
  orderId: string;        // 주문번호
  productId?: string;     // 상품번호 (스마트스토어 URL 의 products/숫자)
  optionCode?: string;        // 옵션 ID (옵션 설정 시 자동 생성) — 옵션 단위 매칭 키
  optionManageCode?: string;  // 판매자 옵션 관리 코드 (설정한 경우)
  productOption?: string;     // 옵션 표시 텍스트 (예: "추가구성: 영구소장")
  productName?: string;
  totalPaymentAmount?: number;
  ordererName?: string;
  ordererTel?: string;
  productOrderStatus?: string; // PAYED / DELIVERING / DELIVERED ...
  // …raw payload preserved separately
}

/**
 * Look up a single 상품주문번호. Returns null if Naver couldn't find it.
 * Throws on transport / auth errors so the API route can 502.
 */
export const lookupProductOrder = async (
  productOrderNo: string,
): Promise<{ raw: unknown; parsed: CommerceProductOrder | null }> => {
  const token = await getCommerceAccessToken();
  const res = await commerceFetch(
    `${COMMERCE_BASE}/v1/pay-order/seller/product-orders/${encodeURIComponent(productOrderNo)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    },
  );
  if (res.status === 404) return { raw: null, parsed: null };
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Naver Commerce product-order lookup failed (${res.status}): ${text}`);
  }
  const raw = (await res.json()) as Record<string, unknown>;
  const data = (raw.data ?? raw) as Record<string, unknown>;
  const productOrder = (data.productOrder ?? data) as Record<string, unknown>;
  const order = (data.order ?? {}) as Record<string, unknown>;

  const parsed: CommerceProductOrder = {
    productOrderId: String(productOrder.productOrderId ?? productOrderNo),
    orderId: String(productOrder.orderId ?? order.orderId ?? ''),
    productId: productOrder.productId ? String(productOrder.productId) : undefined,
    optionCode: productOrder.optionCode ? String(productOrder.optionCode) : undefined,
    optionManageCode: productOrder.optionManageCode
      ? String(productOrder.optionManageCode)
      : undefined,
    productOption: productOrder.productOption ? String(productOrder.productOption) : undefined,
    productName: productOrder.productName ? String(productOrder.productName) : undefined,
    totalPaymentAmount: typeof productOrder.totalPaymentAmount === 'number'
      ? productOrder.totalPaymentAmount
      : undefined,
    ordererName: order.ordererName ? String(order.ordererName) : undefined,
    ordererTel: order.ordererTel ? String(order.ordererTel) : undefined,
    productOrderStatus: productOrder.productOrderStatus
      ? String(productOrder.productOrderStatus)
      : undefined,
  };
  return { raw, parsed };
};
