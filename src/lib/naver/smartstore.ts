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

import { createHmac } from 'crypto';

const COMMERCE_BASE = 'https://api.commerce.naver.com/external';

const env = (key: string): string => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
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
  // The Commerce API expects: bcrypt(clientId_timestamp, secret) base64.
  // bcrypt isn't in node:crypto. The alternate accepted form is HMAC-SHA256
  // of `${clientId}_${timestamp}` with secret as the key, base64-encoded.
  // (See "Self-Signed Client Secret" — newer flow.)
  const message = `${clientId}_${timestampMs}`;
  return createHmac('sha256', secret).update(message).digest('base64');
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

  const res = await fetch(`${COMMERCE_BASE}/v1/oauth2/token`, {
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
  productId?: string;
  productName?: string;
  totalPaymentAmount?: number;
  productOption?: string;
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
  const res = await fetch(
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
    productName: productOrder.productName ? String(productOrder.productName) : undefined,
    totalPaymentAmount: typeof productOrder.totalPaymentAmount === 'number'
      ? productOrder.totalPaymentAmount
      : undefined,
    productOption: productOrder.productOption ? String(productOrder.productOption) : undefined,
    ordererName: order.ordererName ? String(order.ordererName) : undefined,
    ordererTel: order.ordererTel ? String(order.ordererTel) : undefined,
    productOrderStatus: productOrder.productOrderStatus
      ? String(productOrder.productOrderStatus)
      : undefined,
  };
  return { raw, parsed };
};
