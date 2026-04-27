const PORTONE_API_BASE = 'https://api.portone.io';

export interface PortOnePayment {
  id: string;
  status:
    | 'READY'
    | 'PENDING'
    | 'VIRTUAL_ACCOUNT_ISSUED'
    | 'PAID'
    | 'FAILED'
    | 'PARTIAL_CANCELLED'
    | 'CANCELLED';
  amount: { total: number };
  currency: string;
  orderName?: string;
  customer?: {
    id?: string;
    name?: { full?: string };
    email?: string;
    phoneNumber?: string;
  };
  customData?: string;
  paidAt?: string;
}

/**
 * Server-side fetch of payment details from PortOne.
 * Used to verify amount and status before unlocking the invitation.
 */
export async function getPayment(paymentId: string): Promise<PortOnePayment> {
  const secret = process.env.PORTONE_API_SECRET;
  if (!secret) throw new Error('PORTONE_API_SECRET is not set');

  const url = `${PORTONE_API_BASE}/payments/${encodeURIComponent(paymentId)}`;
  const res = await fetch(url, {
    headers: { Authorization: `PortOne ${secret}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PortOne ${res.status}: ${body}`);
  }
  return (await res.json()) as PortOnePayment;
}
