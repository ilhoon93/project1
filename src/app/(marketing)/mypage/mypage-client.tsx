'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { COLOR_THEME_LABELS, type ColorTheme } from '@/lib/theme';
import { SNAP_CATALOG } from '@/lib/snap/catalog';

// snap_jobs / snap_anchor_history 응답 타입 — API 가 돌려주는 raw shape.
interface SnapJob {
  id: string;
  kind: 'anchor' | 'catalog';
  fal_request_id: string;
  catalog_id: string | null;
  catalog_path: 'anchored' | 'selfies' | 'couple' | null;
  anchor_slot: 'groom' | 'bride' | null;
  anchor_framing: 'closeup' | 'halfbody' | null;
  status: 'submitted' | 'in_progress' | 'completed' | 'failed' | 'timeout';
  result_url: string | null;
  error_message: string | null;
  submitted_at: string;
  completed_at: string | null;
}

interface AnchorHistoryEntry {
  id: string;
  groom_anchor_url: string | null;
  bride_anchor_url: string | null;
  source_mode: 'selfies' | 'couple';
  anchor_created_at: string | null;
  discarded_at: string;
}

// 폴링 간격 — pending job 있을 때만 활성.
const POLL_INTERVAL_MS = 8_000;

export interface MyPagePublication {
  id: string;
  invitation_id: string;
  slug: string;
  owner_token: string;
  archived: boolean;
  published_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export interface MyPageEntitlements {
  aiSnap: boolean;
  aiVideo: boolean;
  familyPack: boolean;
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
  archiveBalance: number;
  /** AI 웨딩스냅 크레딧 잔액 (snap_credits_ledger 합). */
  snapCreditsBalance: number;
  orders: MyPageOrder[];
  entitlements: MyPageEntitlements;
}

type Tab = 'saves' | 'credits' | 'orders' | 'snap';

const VALID_TABS: Tab[] = ['saves', 'snap', 'credits', 'orders'];

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
  archiveBalance,
  snapCreditsBalance,
  orders,
  entitlements,
}: Props) {
  const searchParams = useSearchParams();
  const initialTab: Tab = (() => {
    const t = searchParams.get('tab');
    return t && (VALID_TABS as string[]).includes(t) ? (t as Tab) : 'saves';
  })();
  const [tab, setTab] = useState<Tab>(initialTab);

  // ?tab=snap 같은 deep-link 가 후속 navigation 으로 들어와도 따라가게.
  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && (VALID_TABS as string[]).includes(t) && t !== tab) {
      setTab(t as Tab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs tracking-[0.3em] text-[#8B7355]">MY PAGE</p>
        <h1 className="text-2xl font-semibold tracking-tight">마이페이지</h1>
        <p className="text-sm text-muted-foreground">
          {userName ?? userEmail ?? '내 계정'} · 발행권{' '}
          <span className="font-semibold text-[#3D2E1F]">{creditsBalance}</span> · 영구소장권{' '}
          <span className="font-semibold text-[#3D2E1F]">{archiveBalance}</span>
        </p>
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b">
        <TabButton selected={tab === 'saves'} onClick={() => setTab('saves')}>
          저장 내역
        </TabButton>
        <TabButton selected={tab === 'snap'} onClick={() => setTab('snap')}>
          AI 웨딩스냅
        </TabButton>
        <TabButton selected={tab === 'credits'} onClick={() => setTab('credits')}>
          발행권 · 영구소장
        </TabButton>
        <TabButton selected={tab === 'orders'} onClick={() => setTab('orders')}>
          주문
        </TabButton>
      </nav>

      {tab === 'saves' && (
        <SavedTab invitations={invitations} archiveBalance={archiveBalance} />
      )}
      {tab === 'snap' && (
        <SnapTab entitlements={entitlements} snapCreditsBalance={snapCreditsBalance} />
      )}
      {tab === 'credits' && (
        <CreditsTab balance={creditsBalance} archiveBalance={archiveBalance} entitlements={entitlements} />
      )}
      {tab === 'orders' && <OrdersTab orders={orders} />}
    </main>
  );
}

// ── AI 웨딩스냅 ──────────────────────────────────────────────

interface SnapPackageTier {
  code: 'snap_5' | 'snap_20' | 'snap_40';
  name: string;
  credits: number;
  price: number;
  perImage: number;
  highlight?: string;
  bonus?: string;
}

const SNAP_PACKAGES: SnapPackageTier[] = [
  {
    code: 'snap_5',
    name: '체험팩',
    credits: 5,
    price: 3900,
    perImage: 780,
    highlight: '부담 없이 한 번 만들어 보고 싶을 때',
  },
  {
    code: 'snap_20',
    name: '표준 (가장 인기)',
    credits: 20,
    price: 13900,
    perImage: 695,
    highlight: '청첩장 메인 + 베스트샷 다양하게',
  },
  {
    code: 'snap_40',
    name: '헤비',
    credits: 40,
    price: 24900,
    perImage: 622,
    highlight: '카탈로그 풀 활용 · 가성비 최고',
  },
];

function SnapTab({
  entitlements,
  snapCreditsBalance,
}: {
  entitlements: MyPageEntitlements;
  snapCreditsBalance: number;
}) {
  const hasCredits = snapCreditsBalance > 0;

  // 생성 결과 + 히스토리 fetch.
  const [jobs, setJobs] = useState<SnapJob[] | null>(null);
  const [history, setHistory] = useState<AnchorHistoryEntry[] | null>(null);
  const [polling, setPolling] = useState(false);

  // pending 작업 finalize 시도 후 jobs 목록 fetch. 'pending' 이 남아 있으면
  // 8초 간격으로 자동 반복.
  const refreshJobs = useCallback(async (): Promise<boolean> => {
    let stillPending = false;
    try {
      setPolling(true);
      // 1. pending 자동 finalize.
      await fetch('/api/snap/jobs/poll-pending', {
        method: 'POST',
        cache: 'no-store',
      });
      // 2. jobs 목록.
      const res = await fetch('/api/snap/jobs?kind=catalog&limit=100', {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = (await res.json()) as { jobs?: SnapJob[] };
        const list = data.jobs ?? [];
        setJobs(list);
        stillPending = list.some(
          (j) => j.status === 'submitted' || j.status === 'in_progress',
        );
      }
    } catch (e) {
      console.warn('[mypage snap] refresh jobs failed', e);
    } finally {
      setPolling(false);
    }
    return stillPending;
  }, []);

  // 폐기된 앵커 fetch — 1회.
  const refreshHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/snap/anchor/history', { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { entries?: AnchorHistoryEntry[] };
        setHistory(data.entries ?? []);
      }
    } catch (e) {
      console.warn('[mypage snap] refresh history failed', e);
    }
  }, []);

  // 초기 마운트 + 폴링 루프.
  useEffect(() => {
    let canceled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const loop = async () => {
      if (canceled) return;
      const pending = await refreshJobs();
      if (canceled) return;
      if (pending) {
        timer = setTimeout(() => void loop(), POLL_INTERVAL_MS);
      }
    };
    void loop();
    void refreshHistory();

    return () => {
      canceled = true;
      if (timer) clearTimeout(timer);
    };
  }, [refreshJobs, refreshHistory]);

  return (
    <section className="flex flex-col gap-4">
      {/* 잔액 + 빠른 진입 */}
      <div className="flex flex-col gap-3 rounded-lg bg-white p-5 ring-1 ring-[#D4C5B0]">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-[#3D2E1F]">AI 웨딩스냅</h2>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${
              hasCredits || entitlements.aiSnap
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                : 'bg-muted text-muted-foreground ring-border'
            }`}
          >
            {hasCredits
              ? '잠금 해제'
              : entitlements.aiSnap
                ? '레거시 잠금 해제'
                : '미보유'}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-semibold tracking-tight text-[#3D2E1F]">
            {snapCreditsBalance}
          </p>
          <p className="text-xs text-[#8B7355]">스냅 크레딧 잔여 · 1장당 1 차감</p>
        </div>
        <p className="text-xs leading-relaxed text-[#5C4633]">
          신랑·신부 사진을 한 번만 잘 잡아두는 <strong>앵커 단계 (4장 후보 中 1장 선택)</strong> 가
          첫 batch <span className="text-emerald-700">무료</span>로 제공되고, 이후 카탈로그
          50컷 풀에서 원하는 컷을 1장씩 차감해 만듭니다. 키·몸무게를 같이 입력하면 전신
          비율이 자연스럽게 반영돼요.
        </p>
        <div className="mt-1 flex flex-wrap gap-2">
          <Link
            href="/wedding-snap/create"
            className="inline-flex h-9 items-center justify-center rounded-md bg-[#3D2E1F] px-4 text-xs font-medium text-white transition-colors hover:bg-[#5C4633]"
          >
            새 웨딩스냅 만들기
          </Link>
          <Link
            href="/wedding-snap"
            className="inline-flex h-9 items-center justify-center rounded-md border border-[#D4C5B0] bg-white px-4 text-xs font-medium text-[#5C4633] hover:bg-[#FAF7F2]"
          >
            카탈로그 둘러보기
          </Link>
        </div>
      </div>

      {/* 패키지 라인업 */}
      <div className="flex flex-col gap-3 rounded-lg bg-white p-5 ring-1 ring-[#D4C5B0]">
        <h3 className="text-sm font-medium text-[#3D2E1F]">패키지 라인업</h3>
        <p className="text-[11px] text-[#8B7355]">
          실제 웨딩스튜디오 대비 1–3% 가격으로 50가지 컷을 우리 얼굴로 만들 수
          있어요. 결제는 PortOne · 네이버 스마트스토어 양쪽 지원, 아래 &ldquo;발행권 ·
          영구소장&rdquo; 탭 또는 스마트스토어 주문번호 등록을 통해 진행됩니다.
        </p>
        <ul className="flex flex-col gap-2">
          {SNAP_PACKAGES.map((p) => (
            <li
              key={p.code}
              className={`flex flex-col gap-1 rounded-md border p-3 text-xs ${
                p.code === 'snap_20' ? 'border-[#3D2E1F] bg-[#FAF7F2]' : 'border-[#E8DCC9] bg-white'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#3D2E1F]">{p.name}</span>
                  {p.code === 'snap_20' && (
                    <span className="rounded-full bg-[#3D2E1F] px-2 py-0.5 text-[10px] font-medium text-white">
                      추천
                    </span>
                  )}
                </div>
                <span className="text-sm font-semibold text-[#3D2E1F]">
                  {p.price.toLocaleString()}원
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 text-[#5C4633]">
                <span>스냅 크레딧 {p.credits}개</span>
                <span className="text-[10px] text-[#8B7355]">컷당 {p.perImage}원</span>
              </div>
              {p.highlight && <p className="text-[11px] text-[#8B7355]">{p.highlight}</p>}
              {p.bonus && (
                <p className="text-[11px] text-emerald-700">+ {p.bonus}</p>
              )}
            </li>
          ))}
        </ul>
        <p className="text-[10px] text-[#8B7355]">
          ⓘ 결제 후 크레딧은 자동 적립됩니다. 만료 없음. 환불은 결제 채널 정책을
          따릅니다. 첫 앵커 batch (스튜디오 4종 framing) 는 무료, 재생성은 4
          크레딧 차감.
        </p>
      </div>

      {/* 생성 갤러리 — 진행 중 + 완료 */}
      <SnapJobsGallery jobs={jobs} polling={polling} onRefresh={refreshJobs} />

      {/* 폐기된 앵커 — 펼치기 형태 */}
      <SnapAnchorHistory history={history} />

      {entitlements.aiSnap && !hasCredits && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
          이전에 구매하신 AI 웨딩스냅 패키지는 새 크레딧 모델로 자동 전환되어
          <strong> 20 스냅 크레딧</strong>이 적립되었습니다. 잔액이 0 이면 위 패키지를
          추가 구매해 주세요.
        </div>
      )}
    </section>
  );
}

// ── 생성 갤러리 ───────────────────────────────────────────────

function SnapJobsGallery({
  jobs,
  polling,
  onRefresh,
}: {
  jobs: SnapJob[] | null;
  polling: boolean;
  onRefresh: () => Promise<boolean>;
}) {
  if (jobs === null) {
    return (
      <div className="rounded-lg bg-white p-5 ring-1 ring-[#D4C5B0]">
        <p className="text-xs text-[#8B7355]">생성 결과 불러오는 중…</p>
      </div>
    );
  }

  const pending = jobs.filter(
    (j) => j.status === 'submitted' || j.status === 'in_progress',
  );
  const completed = jobs.filter((j) => j.status === 'completed');
  const failed = jobs.filter((j) => j.status === 'failed' || j.status === 'timeout');

  if (jobs.length === 0) {
    return (
      <div className="rounded-lg bg-white p-5 ring-1 ring-[#D4C5B0]">
        <h3 className="text-sm font-medium text-[#3D2E1F]">생성 결과</h3>
        <p className="mt-1 text-xs text-[#8B7355]">
          아직 생성된 스냅이 없어요. 위 &ldquo;새 웨딩스냅 만들기&rdquo; 에서 시작해 보세요.
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 overflow-hidden rounded-lg bg-white p-5 ring-1 ring-[#D4C5B0]">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-[#3D2E1F]">생성 결과</h3>
        <button
          type="button"
          onClick={() => void onRefresh()}
          disabled={polling}
          className="text-[11px] text-[#8B7355] underline underline-offset-2 hover:text-[#3D2E1F] disabled:opacity-50"
        >
          {polling ? '새로고침 중...' : '새로고침'}
        </button>
      </div>

      {pending.length > 0 && (
        <div className="flex flex-col gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-[11px] font-medium text-amber-900">
            진행 중인 작업 {pending.length}개
          </p>
          <p className="text-[10px] text-amber-800">
            평균 20–60초 소요. 자동 새로고침 되며, 페이지를 떠나도 백그라운드에서
            계속 진행됩니다.
          </p>
          <ul className="flex flex-col gap-1 text-[11px] text-amber-900">
            {pending.map((j) => (
              <li key={j.id} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {catalogLabel(j.catalog_id)} ·{' '}
                  {j.status === 'submitted' ? '대기 중' : '합성 중'}
                </span>
                <span className="text-[10px] text-amber-700">
                  {formatRelative(j.submitted_at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {completed.length > 0 && <CompletedJobsPaged jobs={completed} />}

      {failed.length > 0 && (
        <details className="rounded-md border border-red-200 bg-red-50 p-3 text-[11px] text-red-900">
          <summary className="cursor-pointer font-medium">
            실패한 작업 {failed.length}개 (펼쳐서 보기)
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {failed.map((j) => (
              <li key={j.id}>
                {catalogLabel(j.catalog_id)} · {j.error_message ?? '알 수 없는 오류'}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/**
 * 완성된 결과 카드 페이징.
 *
 * 생성 결과가 누적되면 한 화면에 다 펼치면 스크롤이 길어지고 이미지 동시 로딩으로
 * 모바일 트래픽 부담이 큼. PAGE_SIZE 장씩 끊어 보여 주고, 페이지 번호 + 이전/다음
 * 버튼으로 이동. 페이지 0-index 로 관리하지만 UI 에는 1-base 로 표시.
 *
 * 새로고침/refresh 로 jobs 가 갱신되면 jobs 길이로 totalPages 가 다시 계산되며,
 * 현재 page 가 범위를 벗어나면 마지막 페이지로 클램프.
 *
 * 모바일 가로 overflow 방지:
 *   부모 컨테이너에서 width 가 좁아도 페이지 번호 버튼이 좌우로 삐져나오지 않게
 *   flex-wrap 으로 줄바꿈 허용 + 컨테이너 자체에 max-w-full 적용. 페이지 번호가
 *   많아지면 윈도우 5개씩만 보여 주고 ‥ 로 생략 (총 ≤ 6 개면 전체 표시).
 */
const RESULTS_PAGE_SIZE = 12;

function CompletedJobsPaged({ jobs }: { jobs: SnapJob[] }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(jobs.length / RESULTS_PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages - 1);
  const start = clampedPage * RESULTS_PAGE_SIZE;
  const visible = jobs.slice(start, start + RESULTS_PAGE_SIZE);

  // 모바일 폭에서 번호가 6 개 넘어가면 좌우 ellipsis 로 압축한 윈도우만 표시.
  // 현재 페이지 기준 좌우 1 칸 + 첫/마지막 페이지를 항상 보여 줘서 점프 가능.
  const pageItems = computePageItems(clampedPage, totalPages);

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {visible.map((j) => (
          <SnapResultCard key={j.id} job={j} />
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex w-full max-w-full flex-wrap items-center justify-center gap-1 overflow-hidden text-[11px] text-[#5C4633]">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={clampedPage === 0}
            className="shrink-0 rounded border border-[#E8DCC9] bg-white px-2 py-1 hover:bg-[#FAF7F2] disabled:opacity-40"
          >
            이전
          </button>
          {pageItems.map((item, idx) =>
            item === 'ellipsis' ? (
              <span
                key={`e-${idx}`}
                className="shrink-0 px-1 text-[#8B7355]"
                aria-hidden
              >
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => setPage(item)}
                className={`min-w-[28px] shrink-0 rounded border px-2 py-1 ${
                  item === clampedPage
                    ? 'border-[#3D2E1F] bg-[#3D2E1F] text-white'
                    : 'border-[#E8DCC9] bg-white hover:bg-[#FAF7F2]'
                }`}
              >
                {item + 1}
              </button>
            ),
          )}
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={clampedPage >= totalPages - 1}
            className="shrink-0 rounded border border-[#E8DCC9] bg-white px-2 py-1 hover:bg-[#FAF7F2] disabled:opacity-40"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * 페이지 번호 표시 항목 계산. 총 6 페이지 이하면 전체, 그 이상이면 현재 페이지를
 * 중심으로 윈도우 + 첫/마지막을 보여 주고 그 사이에 'ellipsis' 삽입.
 *
 * 예시 (totalPages=12, current=5): [0, 'ellipsis', 4, 5, 6, 'ellipsis', 11]
 */
function computePageItems(
  current: number,
  total: number,
): Array<number | 'ellipsis'> {
  if (total <= 6) return Array.from({ length: total }, (_, i) => i);
  const items: Array<number | 'ellipsis'> = [];
  const windowStart = Math.max(1, current - 1);
  const windowEnd = Math.min(total - 2, current + 1);
  items.push(0);
  if (windowStart > 1) items.push('ellipsis');
  for (let i = windowStart; i <= windowEnd; i++) items.push(i);
  if (windowEnd < total - 2) items.push('ellipsis');
  items.push(total - 1);
  return items;
}

function SnapResultCard({ job }: { job: SnapJob }) {
  return (
    <a
      href={job.result_url ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col overflow-hidden rounded-md border border-[#E8DCC9] bg-white transition-transform hover:scale-[1.02]"
    >
      <div className="grid aspect-[3/4] w-full place-items-center overflow-hidden bg-[#F5EDE0]">
        {job.result_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={job.result_url}
            alt={catalogLabel(job.catalog_id)}
            className="block h-full w-full object-contain"
          />
        ) : (
          <span className="text-[10px] text-[#8B7355]">URL 없음</span>
        )}
      </div>
      <div className="p-1.5">
        <p className="truncate text-[11px] font-medium text-[#3D2E1F]">
          {catalogLabel(job.catalog_id)}
        </p>
        <p className="text-[10px] text-[#8B7355]">
          {formatRelative(job.completed_at ?? job.submitted_at)}
        </p>
      </div>
    </a>
  );
}

// ── 폐기된 앵커 ────────────────────────────────────────────────

function SnapAnchorHistory({ history }: { history: AnchorHistoryEntry[] | null }) {
  if (history === null) return null;
  if (history.length === 0) return null;

  return (
    <details className="rounded-lg bg-white p-5 ring-1 ring-[#D4C5B0]">
      <summary className="cursor-pointer text-sm font-medium text-[#3D2E1F]">
        폐기된 앵커 {history.length}개 (펼치기)
      </summary>
      <p className="mt-1 text-[11px] text-[#8B7355]">
        이전에 만들었다가 폐기한 앵커들. 결과 갤러리와 별개로 보관되며 그대로
        보관됩니다.
      </p>
      <ul className="mt-3 flex flex-col gap-3">
        {history.map((h) => (
          <li
            key={h.id}
            className="flex flex-col gap-2 rounded-md border border-[#E8DCC9] bg-[#FAF7F2] p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-[#5C4633]">
                {formatRelative(h.discarded_at)} 폐기 · {h.source_mode}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <AnchorHistoryPreview url={h.groom_anchor_url} label="신랑" />
              <AnchorHistoryPreview url={h.bride_anchor_url} label="신부" />
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}

function AnchorHistoryPreview({ url, label }: { url: string | null; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[10px] font-medium text-[#5C4633]">{label}</p>
      <div className="grid aspect-[3/4] w-full place-items-center overflow-hidden rounded border border-[#D4C5B0] bg-white">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <a href={url} target="_blank" rel="noopener noreferrer" className="block h-full w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`폐기된 ${label} 앵커`} className="h-full w-full object-contain" />
          </a>
        ) : (
          <span className="text-[10px] text-[#8B7355]">없음</span>
        )}
      </div>
    </div>
  );
}

// ── 헬퍼 ──────────────────────────────────────────────────────

function catalogLabel(catalogId: string | null): string {
  if (!catalogId) return '카탈로그 없음';
  const item = SNAP_CATALOG.find((c) => c.id === catalogId);
  return item?.label ?? catalogId;
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const diffSec = Math.floor((Date.now() - t) / 1000);
  if (diffSec < 60) return '방금';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}시간 전`;
  if (diffSec < 7 * 86400) return `${Math.floor(diffSec / 86400)}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR');
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
}

function SavedTab({
  invitations,
  archiveBalance,
}: {
  invitations: MyPageInvitation[];
  archiveBalance: number;
}) {
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
      // 발행 후에도 마이페이지에 머무르며 카드 상태만 갱신.
      router.refresh();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '발행 실패');
    } finally {
      setBusyId(null);
      setModal(null);
    }
  };

  const handleArchive = async (publicationId: string) => {
    if (busyId) return;
    setBusyId(publicationId);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/archive/${publicationId}`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.refresh();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '영구소장 적용 실패');
    } finally {
      setBusyId(null);
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
            busy={busyId === inv.id || inv.publications.some((p) => busyId === p.id)}
            archiveBalance={archiveBalance}
            onArchive={handleArchive}
            onPublish={() => {
              setModal({ kind: 'publish', invitation: inv });
            }}
            onDelete={() => setModal({ kind: 'delete', invitation: inv })}
          />
        ))}
      </ul>

      {modal && modal.kind === 'publish' && (
        <ConfirmDialog
          title="지금 발행할까요?"
          description="발행권 1개가 차감되고 발행 후 30일간 유효한 고유 URL이 생성됩니다. 한 번 발행하면 URL은 그대로 유지되고, 이후 편집은 같은 URL에 즉시 반영됩니다."
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
  archiveBalance,
  onArchive,
  onPublish,
  onDelete,
}: {
  inv: MyPageInvitation;
  busy: boolean;
  archiveBalance: number;
  onArchive: (publicationId: string) => void;
  onPublish: () => void;
  onDelete: () => void;
}) {
  // 영구소장된 publication 은 expires_at 무시 (소장용 URL 영구).
  const activePublications = inv.publications.filter(
    (p) => !p.revoked_at && (p.archived || new Date(p.expires_at) > new Date()),
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
      <div className="flex flex-col gap-2">
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
              {/* href 는 깨끗한 path. UrlRow 가 클릭 시 브라우저별로 fullscreen
                  진입 방식을 분기 (Chrome/FF: 같은 탭+즉시 / Safari: 새 탭+첫탭). */}
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
                badge={latest.archived ? '영구소장' : undefined}
              />
              <p className="text-muted-foreground">
                {latest.archived
                  ? '소장용 URL 은 만료 없이 영구 보관 · 하객용은 ' +
                    `${daysRemaining(latest.expires_at)}일 후 만료 (${formatDate(latest.expires_at)})`
                  : `${daysRemaining(latest.expires_at)}일 후 만료 · ${formatDate(latest.expires_at)}까지 공개`}
              </p>

              {/* 영구소장 적용 버튼 — 미적용 publication 에만 노출. */}
              {!latest.archived && (
                <ArchiveActionButton
                  publicationId={latest.id}
                  archiveBalance={archiveBalance}
                  busy={busy}
                  onArchive={onArchive}
                />
              )}
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
        {/* 한 번 발행되면 URL 이 고정됨 → "발행" 버튼은 미발행 상태에서만 노출.
            발행 후 편집은 에디터에서 저장 시 publications.content 가 자동 갱신됨. */}
        {!latest && (
          <Button
            variant="default"
            size="sm"
            onClick={onPublish}
            disabled={busy}
          >
            {busy ? '발행 중...' : '발행'}
          </Button>
        )}
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
  badge,
}: {
  label: string;
  href: string;
  copyText: string;
  hint?: string;
  badge?: string;
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

  // 하이브리드 fullscreen 진입:
  //   - Chrome / Firefox: 같은 탭에서 navigate + click 시점에 즉시 requestFullscreen
  //     (브라우저가 same-origin navigate 시 fullscreen 상태 유지)
  //   - Safari (iOS 포함): navigate 시 fullscreen 강제 종료되므로 새 탭 열고
  //     ?fs=1 로 첫 탭 진입 패턴 사용 (FullscreenToggle 이 처리)
  const handleOpen = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (typeof window === 'undefined') return;
    const ua = window.navigator.userAgent;
    const isSafari =
      /^((?!chrome|android|crios|fxios|edg|opr).)*safari/i.test(ua) ||
      /iPad|iPhone|iPod/.test(ua);

    if (isSafari) {
      window.open(`${href}?fs=1`, '_blank', 'noopener');
      return;
    }

    // Chrome / Firefox 등 — 같은 탭에서 fullscreen + navigate.
    const enterFullscreen = document.documentElement.requestFullscreen?.();
    if (enterFullscreen && typeof enterFullscreen.then === 'function') {
      enterFullscreen.catch(() => {});
    }
    window.location.href = href;
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2 text-[#5C4633]">
        <span className="shrink-0 font-medium">{label}</span>
        {badge && (
          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
            {badge}
          </span>
        )}
        <button
          type="button"
          onClick={handleCopy}
          className="ml-auto rounded-md border border-[#D4C5B0] bg-white px-2 py-0.5 text-[10px] font-medium text-[#5C4633] hover:bg-[#FAF7F2]"
        >
          {copied ? '복사됨' : '복사'}
        </button>
      </div>
      <Link
        href={href}
        onClick={handleOpen}
        className="block break-all font-mono text-[11px] text-[#8B7355] underline underline-offset-2"
      >
        {copyText}
      </Link>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ── 영구소장 적용 버튼 ─────────────────────────────────────

function ArchiveActionButton({
  publicationId,
  archiveBalance,
  busy,
  onArchive,
}: {
  publicationId: string;
  archiveBalance: number;
  busy: boolean;
  onArchive: (publicationId: string) => void;
}) {
  const insufficient = archiveBalance <= 0;
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-dashed border-[#D4C5B0] bg-white px-2 py-1.5">
      <span className="text-[11px] text-muted-foreground">
        영구소장 잔여{' '}
        <span className="font-medium text-[#5C4633]">{archiveBalance}</span>개
        {insufficient && ' · 패키지 구매 후 적용 가능'}
      </span>
      <button
        type="button"
        disabled={insufficient || busy}
        onClick={() => onArchive(publicationId)}
        className="rounded-md bg-[#8B7355] px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-[#6B5740] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? '적용 중...' : '영구소장 적용'}
      </button>
    </div>
  );
}

// ── 썸네일 / 혼인서약서 PDF 버튼 ────────────────────────────

/**
 * 혼인서약서 버튼.
 *  - 미발행(`disabled=true`) 상태에서는 hint 만 보이고 클릭 비활성.
 *  - 발행 후엔 클릭 시 `/certificate/{id}` 페이지로 이동 (이미지 저장/인쇄 옵션 제공).
 */
function CertificatePdfButton({
  invitationId,
  disabled,
}: {
  invitationId: string;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col">
      <Button
        asChild={!disabled}
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        title={disabled ? '발행 후 사용 가능' : '혼인서약서 보기'}
      >
        {disabled ? (
          <span>혼인서약서</span>
        ) : (
          <Link href={`/certificate/${invitationId}`}>혼인서약서</Link>
        )}
      </Button>
    </div>
  );
}

// ── 발행권 ─────────────────────────────────────────────────

function CreditsTab({
  balance,
  archiveBalance,
  entitlements,
}: {
  balance: number;
  archiveBalance: number;
  entitlements: MyPageEntitlements;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col items-center gap-1 rounded-lg bg-white p-5 text-center ring-1 ring-[#D4C5B0]">
          <p className="text-[10px] tracking-[0.3em] text-[#8B7355]">PUBLISH</p>
          <p className="text-3xl font-semibold tracking-tight">{balance}</p>
          <p className="text-[11px] text-muted-foreground">발행 1회당 1개 차감</p>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-lg bg-white p-5 text-center ring-1 ring-[#D4C5B0]">
          <p className="text-[10px] tracking-[0.3em] text-[#8B7355]">ARCHIVE</p>
          <p className="text-3xl font-semibold tracking-tight">{archiveBalance}</p>
          <p className="text-[11px] text-muted-foreground">소장용 URL 영구 보관</p>
        </div>
      </div>

      {/* 패키지 entitlement 현황 */}
      <div className="flex flex-col gap-2 rounded-lg bg-white p-4 ring-1 ring-[#D4C5B0]">
        <h3 className="text-sm font-medium">보유 패키지</h3>
        <ul className="flex flex-col gap-1 text-xs">
          <EntitlementRow label="AI 웨딩 스냅" unlocked={entitlements.aiSnap} />
          <EntitlementRow label="AI 웨딩 영상" unlocked={entitlements.aiVideo} />
          <EntitlementRow label="가족 패키지" unlocked={entitlements.familyPack} />
        </ul>
        <p className="text-[11px] text-muted-foreground">
          한 번 구매하면 해당 기능이 영구적으로 잠금 해제됩니다. 구매 등록은 아래 카드에서.
        </p>
      </div>

      <RegisterOrderCard />
      <NaverPullCard />
    </section>
  );
}

function EntitlementRow({ label, unlocked }: { label: string; unlocked: boolean }) {
  return (
    <li className="flex items-center justify-between gap-2 rounded border border-[#F4EBDC] px-2.5 py-1.5">
      <span>{label}</span>
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${
          unlocked
            ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
            : 'bg-muted text-muted-foreground ring-border'
        }`}
      >
        {unlocked ? '잠금 해제' : '미보유'}
      </span>
    </li>
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

