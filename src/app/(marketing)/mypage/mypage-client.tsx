'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { COLOR_THEME_LABELS, type ColorTheme } from '@/lib/theme';

export interface MyPagePublication {
  id: string;
  invitation_id: string;
  slug: string;
  owner_token: string;
  published_at: string;
  expires_at: string;
  revoked_at: string | null;
}

const LAYOUT_LABELS: Record<string, string> = {
  poster: '포스터',
  frame: '액자프레임',
  polaroid: '액자프레임 (폴라로이드)',
  illustration: '일러스트',
  text: '텍스트',
};

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
  /** Main slide hero image (thumbnail). Null when not uploaded yet. */
  heroImage: string | null;
  /** 메인 화면 레이아웃 키 (poster / frame / illustration / text 등). */
  layout: string | null;
  /** 디자인 색상 테마 키 (cream / sky / lavender 등). */
  colorTheme: string | null;
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

const MAX_INVITATIONS = 10;

interface ConfirmModal {
  kind: 'publish' | 'delete';
  invitation: MyPageInvitation;
  isRepublish: boolean;
}

function SavedTab({ invitations }: { invitations: MyPageInvitation[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [modal, setModal] = useState<ConfirmModal | null>(null);

  const atLimit = invitations.length >= MAX_INVITATIONS;

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
      setModal(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/invitations/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.refresh();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '삭제 실패');
    } finally {
      setBusyId(null);
      setModal(null);
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
        <h2 className="text-sm font-medium">
          저장된 알림장{' '}
          <span className="text-xs text-muted-foreground">
            ({invitations.length} / {MAX_INVITATIONS})
          </span>
        </h2>
        {atLimit ? (
          <span className="text-xs text-destructive">한도 초과 — 삭제 후 추가 가능</span>
        ) : (
          <Link
            href="/new"
            className="text-xs text-[#8B7355] underline-offset-2 hover:underline"
          >
            + 새 알림장
          </Link>
        )}
      </div>

      <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
        ⓘ 미발행 상태로 2주(14일) 동안 수정이 없으면 알림장이 자동으로 삭제됩니다.
      </p>

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
            onPublish={() => {
              const isRepublish = inv.publications.some(
                (p) => !p.revoked_at && new Date(p.expires_at) > new Date(),
              );
              setModal({ kind: 'publish', invitation: inv, isRepublish });
            }}
            onDelete={() =>
              setModal({ kind: 'delete', invitation: inv, isRepublish: false })
            }
          />
        ))}
      </ul>

      {modal && modal.kind === 'publish' && (
        <ConfirmDialog
          title={modal.isRepublish ? '재발행할까요?' : '지금 발행할까요?'}
          description={
            modal.isRepublish
              ? '발행권 1개가 차감되고 새로운 공개 URL이 생성됩니다. 이전 URL도 만료일까지 계속 동작합니다.'
              : '발행권 1개가 차감되고 발행 후 30일간 유효한 고유 URL이 생성됩니다. 발행 후에도 알림장은 편집할 수 있어요.'
          }
          confirmLabel={busyId ? '발행 중...' : '발행하기'}
          confirmVariant="default"
          busy={busyId === modal.invitation.id}
          onCancel={() => setModal(null)}
          onConfirm={() => handlePublish(modal.invitation.id)}
        />
      )}

      {modal && modal.kind === 'delete' && (
        <ConfirmDialog
          title="알림장을 삭제할까요?"
          description={`"${
            modal.invitation.groomName && modal.invitation.brideName
              ? `${modal.invitation.groomName} · ${modal.invitation.brideName}`
              : '제목 없는 알림장'
          }"이(가) 영구 삭제됩니다. 발행된 공개 URL과 모인 하객 데이터(서명·방명록·퀴즈·투표)도 함께 사라지며 복구할 수 없어요.`}
          confirmLabel={busyId ? '삭제 중...' : '삭제하기'}
          confirmVariant="destructive"
          busy={busyId === modal.invitation.id}
          onCancel={() => setModal(null)}
          onConfirm={() => handleDelete(modal.invitation.id)}
        />
      )}
    </section>
  );
}

function SavedRow({
  inv,
  busy,
  onPublish,
  onDelete,
}: {
  inv: MyPageInvitation;
  busy: boolean;
  onPublish: () => void;
  onDelete: () => void;
}) {
  const activePublications = inv.publications.filter(
    (p) => !p.revoked_at && new Date(p.expires_at) > new Date(),
  );
  const latest = activePublications[0] ?? null;
  // 한 번이라도 발행된 적이 있으면(만료/취소 무관) 혼인서약서 PDF 다운로드 가능.
  const hasEverPublished = inv.publications.length > 0 || inv.isPublished;
  const title =
    inv.groomName && inv.brideName
      ? `${inv.groomName} · ${inv.brideName}`
      : '제목 없는 알림장';

  return (
    <li className="flex flex-col gap-3 rounded-lg bg-white p-4 ring-1 ring-[#D4C5B0]">
      <div className="flex items-start gap-3">
        {/* 썸네일 — 메인 사진(heroImage) 가 있으면 그걸로, 없으면 placeholder 카드. */}
        <InvitationThumbnail src={inv.heroImage} title={title} />

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-col">
              <h3 className="truncate text-base font-medium text-[#3D2E1F]">{title}</h3>
              <p className="text-xs text-muted-foreground">
                {inv.weddingDate ?? '결혼식 날짜 미정'}
                {' · '}최종 수정 {formatDate(inv.updatedAt)}
              </p>
              {/* 레이아웃 + 디자인 색 — 작은 메타 라벨로 한 줄 표시. */}
              {(inv.layout || inv.colorTheme) && (
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                  {inv.layout && (
                    <span className="rounded-full bg-[#F4EBDC] px-2 py-0.5 text-[#5C4633]">
                      {LAYOUT_LABELS[inv.layout] ?? inv.layout}
                    </span>
                  )}
                  {inv.colorTheme && (
                    <span className="rounded-full bg-[#F4EBDC] px-2 py-0.5 text-[#5C4633]">
                      {COLOR_THEME_LABELS[inv.colorTheme as ColorTheme] ?? inv.colorTheme}
                    </span>
                  )}
                </div>
              )}
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
            <div className="flex flex-col gap-2 rounded-md bg-[#FAF7F2] px-3 py-2 text-xs">
              <UrlRow
                label="하객용"
                href={`/${latest.slug}`}
                copyText={absoluteUrl(`/${latest.slug}`)}
              />
              <UrlRow
                label="신랑신부 소장용"
                href={`/${latest.slug}/o/${latest.owner_token}`}
                copyText={absoluteUrl(`/${latest.slug}/o/${latest.owner_token}`)}
                hint="메시지·서명·통계가 모두 보이는 본인 전용 URL"
              />
              <p className="text-muted-foreground">
                {daysRemaining(latest.expires_at)}일 후 만료 ·{' '}
                {formatDate(latest.expires_at)}까지 공개
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/edit/${inv.id}`}>편집</Link>
        </Button>
        {/* 모바일/태블릿: 별도 미리보기 페이지 */}
        <Button asChild variant="outline" size="sm" className="lg:hidden">
          <Link href={`/preview/${inv.id}`}>미리보기</Link>
        </Button>
        {/* 데스크톱: 에디터에 좌측 실시간 미리보기가 있으므로 에디터 페이지로 */}
        <Button asChild variant="outline" size="sm" className="hidden lg:inline-flex">
          <Link href={`/edit/${inv.id}`}>미리보기</Link>
        </Button>
        {/* 혼인서약서 PDF — 발행 후에만 활성화. 발행 전엔 비활성. */}
        <CertificatePdfButton invitationId={inv.id} disabled={!hasEverPublished} />
        <Button
          variant="default"
          size="sm"
          onClick={onPublish}
          disabled={busy}
        >
          {busy ? '발행 중...' : latest ? '재발행' : '발행'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={busy}
          className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          삭제
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

// ── URL 표시 + 복사 버튼 ────────────────────────────────────

function absoluteUrl(path: string): string {
  if (typeof window !== 'undefined') return `${window.location.origin}${path}`;
  return path;
}

function UrlRow({
  label,
  href,
  copyText,
  hint,
}: {
  label: string;
  href: string;
  copyText: string;
  hint?: string;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex flex-wrap items-center gap-2 text-[#5C4633]">
        <span className="shrink-0 font-medium">{label}</span>
        <Link
          href={href}
          target="_blank"
          className="min-w-0 truncate font-mono text-[#8B7355] underline"
        >
          {href}
        </Link>
        <button
          type="button"
          onClick={handleCopy}
          className="ml-auto rounded-md border border-[#D4C5B0] bg-white px-2 py-0.5 text-[10px] font-medium text-[#5C4633] hover:bg-[#FAF7F2]"
        >
          {copied ? '복사됨' : '복사'}
        </button>
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ── 썸네일 / 혼인서약서 PDF 버튼 ────────────────────────────

/**
 * 알림장 썸네일 — 메인 사진(heroImage) 이 있으면 9:16 박스에 cover 로 보여주고,
 * 없으면 신랑 · 신부 이니셜 placeholder 카드.
 */
function InvitationThumbnail({ src, title }: { src: string | null; title: string }) {
  return (
    <div className="aspect-[9/16] w-16 shrink-0 overflow-hidden rounded-md bg-[#F4EBDC] ring-1 ring-[#D4C5B0] sm:w-20">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`${title} 메인 사진`} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] text-[#8B7355]">
          미리보기
        </div>
      )}
    </div>
  );
}

/**
 * 혼인서약서 PDF 다운로드 버튼.
 *  - 미발행(`disabled=true`) 상태에서는 hint 만 보이고 클릭 비활성.
 *  - 발행 후엔 클릭 시 `/api/invitations/{id}/certificate` 로 PDF 를 받아 자동 다운로드.
 */
function CertificatePdfButton({
  invitationId,
  disabled,
}: {
  invitationId: string;
  disabled: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const handleDownload = async () => {
    if (busy || disabled) return;
    setBusy(true);
    setErrMsg(null);
    try {
      const res = await fetch(`/api/invitations/${invitationId}/certificate`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text.slice(0, 80) || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `marriage-certificate-${invitationId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'PDF 다운로드 실패');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleDownload}
        disabled={disabled || busy}
        title={disabled ? '발행 후 다운로드 가능' : '혼인서약서 PDF 다운로드'}
      >
        {busy ? '준비 중...' : '혼인서약서 PDF'}
      </Button>
      {errMsg && (
        <span className="mt-1 text-[10px] text-destructive">{errMsg}</span>
      )}
    </div>
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

// ── 공통 Confirm 모달 ───────────────────────────────────────

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  confirmVariant = 'default',
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: 'default' | 'destructive';
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-lg bg-white p-5 shadow-lg ring-1 ring-[#D4C5B0]">
        <div className="flex flex-col gap-2">
          <h3 id="confirm-dialog-title" className="text-base font-semibold text-[#3D2E1F]">
            {title}
          </h3>
          <p className="text-sm leading-relaxed text-[#5C4633]">{description}</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>
            취소
          </Button>
          <Button
            variant={confirmVariant}
            size="sm"
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
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

