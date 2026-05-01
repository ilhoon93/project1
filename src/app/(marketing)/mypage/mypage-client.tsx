'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export interface MyPagePublication {
  id: string;
  invitation_id: string;
  slug: string;
  published_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export interface MyPageInvitation {
  id: string;
  slug: string;
  groomName: string;
  brideName: string;
  weddingDate: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  updatedAt: string;
  createdAt: string;
  publications: MyPagePublication[];
}

export interface MyPageOrder {
  id: string;
  source: 'portone' | 'naver_smartstore' | 'manual';
  package_code: string | null;
  amount: number;
  granted_credits: number;
  naver_product_order_no: string | null;
  portone_payment_id: string | null;
  status: string;
  created_at: string;
}

interface Props {
  userEmail: string | null;
  userName: string | null;
  invitations: MyPageInvitation[];
  creditsBalance: number;
  orders: MyPageOrder[];
}

type Tab = 'saves' | 'credits' | 'orders';

const SOURCE_LABEL: Record<MyPageOrder['source'], string> = {
  portone: '앱 내 결제 (PortOne)',
  naver_smartstore: '네이버 스마트스토어',
  manual: '수동 등록',
};

export function MyPageClient({
  userEmail,
  userName,
  invitations,
  creditsBalance,
  orders,
}: Props) {
  const [tab, setTab] = useState<Tab>('saves');

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs tracking-[0.3em] text-[#8B7355]">MY PAGE</p>
        <h1 className="text-2xl font-semibold tracking-tight">마이페이지</h1>
        <p className="text-sm text-muted-foreground">
          {userName ?? userEmail ?? '내 계정'} · 보유 발행권{' '}
          <span className="font-semibold text-[#3D2E1F]">{creditsBalance}</span>개
        </p>
      </header>

      <nav className="flex gap-1 border-b">
        <TabButton selected={tab === 'saves'} onClick={() => setTab('saves')}>
          저장 내역
        </TabButton>
        <TabButton selected={tab === 'credits'} onClick={() => setTab('credits')}>
          발행권
        </TabButton>
        <TabButton selected={tab === 'orders'} onClick={() => setTab('orders')}>
          주문
        </TabButton>
      </nav>

      {tab === 'saves' && <SavedTab invitations={invitations} />}
      {tab === 'credits' && <CreditsTab balance={creditsBalance} />}
      {tab === 'orders' && <OrdersTab orders={orders} />}
    </main>
  );
}

function TabButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={`relative px-4 py-2.5 text-sm transition-colors ${
        selected
          ? 'font-medium text-foreground'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
      {selected && (
        <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-foreground" />
      )}
    </button>
  );
}

// ── 저장 내역 ────────────────────────────────────────────────

function SavedTab({ invitations }: { invitations: MyPageInvitation[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePublish = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/publish/${id}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.refresh();
      router.push(`/${data.slug}`);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '발행 실패');
    } finally {
      setBusyId(null);
    }
  };

  if (invitations.length === 0) {
    return (
      <section className="flex flex-col items-center gap-4 rounded-lg bg-white p-10 text-center ring-1 ring-[#D4C5B0]">
        <p className="text-sm text-muted-foreground">아직 저장된 알림장이 없어요.</p>
        <Link
          href="/new"
          className="inline-flex h-10 items-center justify-center rounded-md bg-[#8B7355] px-5 text-sm font-medium text-white"
        >
          새 알림장 만들기
        </Link>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">저장된 알림장</h2>
        <Link
          href="/new"
          className="text-xs text-[#8B7355] underline-offset-2 hover:underline"
        >
          + 새 알림장
        </Link>
      </div>

      {errorMsg && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {errorMsg}
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {invitations.map((inv) => (
          <SavedRow
            key={inv.id}
            inv={inv}
            busy={busyId === inv.id}
            onPublish={() => handlePublish(inv.id)}
          />
        ))}
      </ul>
    </section>
  );
}

function SavedRow({
  inv,
  busy,
  onPublish,
}: {
  inv: MyPageInvitation;
  busy: boolean;
  onPublish: () => void;
}) {
  const activePublications = inv.publications.filter(
    (p) => !p.revoked_at && new Date(p.expires_at) > new Date(),
  );
  const latest = activePublications[0] ?? null;
  const title =
    inv.groomName && inv.brideName
      ? `${inv.groomName} · ${inv.brideName}`
      : '제목 없는 알림장';

  return (
    <li className="flex flex-col gap-3 rounded-lg bg-white p-4 ring-1 ring-[#D4C5B0]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <h3 className="text-base font-medium text-[#3D2E1F]">{title}</h3>
          <p className="text-xs text-muted-foreground">
            {inv.weddingDate ?? '결혼식 날짜 미정'}
            {' · '}최종 수정 {formatDate(inv.updatedAt)}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs ring-1 ${
            latest
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
              : 'bg-muted text-muted-foreground ring-border'
          }`}
        >
          {latest ? '발행 중' : '미발행'}
        </span>
      </div>

      {latest && (
        <div className="rounded-md bg-[#FAF7F2] px-3 py-2 text-xs">
          <p className="text-[#5C4633]">
            공개 URL:{' '}
            <Link
              href={`/${latest.slug}`}
              className="font-mono text-[#8B7355] underline"
              target="_blank"
            >
              /{latest.slug}
            </Link>
          </p>
          <p className="mt-1 text-muted-foreground">
            {daysRemaining(latest.expires_at)}일 후 만료 ·{' '}
            {formatDate(latest.expires_at)}까지 공개
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/edit/${inv.id}`}>편집</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/preview/${inv.id}`}>미리보기</Link>
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={onPublish}
          disabled={busy}
        >
          {busy ? '발행 중...' : latest ? '재발행' : '발행'}
        </Button>
      </div>

      {activePublications.length > 1 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">이전 발행 링크 ({activePublications.length - 1})</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {activePublications.slice(1).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3">
                <Link href={`/${p.slug}`} className="font-mono underline" target="_blank">
                  /{p.slug}
                </Link>
                <span>{daysRemaining(p.expires_at)}일 남음</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

// ── 발행권 ─────────────────────────────────────────────────

function CreditsTab({ balance }: { balance: number }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 rounded-lg bg-white p-8 text-center ring-1 ring-[#D4C5B0]">
        <p className="text-xs tracking-[0.3em] text-[#8B7355]">PUBLISH CREDITS</p>
        <p className="text-4xl font-semibold tracking-tight">{balance}</p>
        <p className="text-xs text-muted-foreground">알림장 1개 발행 시 1개 차감됩니다.</p>
      </div>

      <RegisterOrderCard />
      <NaverPullCard />
    </section>
  );
}

function RegisterOrderCard() {
  const router = useRouter();
  const [orderNo, setOrderNo] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNo.trim() || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/orders/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productOrderNo: orderNo.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      const granted = data?.result?.granted ?? 0;
      setMsg({
        kind: 'ok',
        text: `발행권 ${granted}개가 추가되었습니다.`,
      });
      setOrderNo('');
      router.refresh();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : '등록 실패' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-white p-5 ring-1 ring-[#D4C5B0]">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium">스마트스토어 주문번호로 등록</h3>
        <p className="text-xs text-muted-foreground">
          네이버 스마트스토어에서 결제하신 후 받은 <strong>상품주문번호</strong>를 입력해주세요.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={orderNo}
          onChange={(e) => setOrderNo(e.target.value)}
          placeholder="예: 2026010100000001"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? '등록 중...' : '등록'}
        </Button>
      </form>
      {msg && (
        <p
          className={`text-xs ${
            msg.kind === 'ok' ? 'text-emerald-600' : 'text-destructive'
          }`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}

function NaverPullCard() {
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-white p-5 ring-1 ring-[#D4C5B0]">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium">네이버 로그인으로 주문 가져오기</h3>
        <p className="text-xs text-muted-foreground">
          네이버 계정을 연결하면 스마트스토어 결제 내역을 자동으로 불러옵니다.
        </p>
      </div>
      <Link
        href="/api/auth/naver/start?next=/mypage"
        className="inline-flex h-9 items-center justify-center self-start rounded-md bg-[#03C75A] px-4 text-xs font-medium text-white"
      >
        네이버 연결 / 새로 고침
      </Link>
    </div>
  );
}

// ── 주문 ─────────────────────────────────────────────────────

function OrdersTab({ orders }: { orders: MyPageOrder[] }) {
  const total = useMemo(() => orders.reduce((acc, o) => acc + (o.amount ?? 0), 0), [orders]);

  if (orders.length === 0) {
    return (
      <section className="flex flex-col items-center gap-2 rounded-lg bg-white p-10 text-center ring-1 ring-[#D4C5B0]">
        <p className="text-sm text-muted-foreground">아직 주문 내역이 없어요.</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">전체 주문</h2>
        <p className="text-xs text-muted-foreground">총 결제 {total.toLocaleString()}원</p>
      </div>
      <ul className="flex flex-col gap-2">
        {orders.map((o) => (
          <li
            key={o.id}
            className="flex flex-col gap-1 rounded-md bg-white p-3 ring-1 ring-[#D4C5B0] sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-col">
              <p className="text-sm font-medium">
                {SOURCE_LABEL[o.source]}{' '}
                <span className="text-xs text-muted-foreground">
                  · {o.package_code ?? 'unknown'} · 발행권 +{o.granted_credits}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(o.created_at)}{' '}
                {o.naver_product_order_no
                  ? `· 상품주문 ${o.naver_product_order_no}`
                  : o.portone_payment_id
                    ? `· 결제ID ${o.portone_payment_id}`
                    : ''}
              </p>
            </div>
            <p className="text-sm">{o.amount.toLocaleString()}원</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── helpers ─────────────────────────────────────────────────

function formatDate(isoOrDate: string): string {
  const d = new Date(isoOrDate);
  if (isNaN(d.getTime())) return isoOrDate;
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function daysRemaining(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

