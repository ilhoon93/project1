'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { COLOR_THEME_LABELS, type ColorTheme } from '@/lib/theme';
import { SNAP_CATALOG } from '@/lib/snap/catalog';
import { computePageItems } from '@/lib/utils/pagination';

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
  // 피드백 (PR #168~ 이후)
  liked?: boolean;
  regen_used_free?: boolean;
  regen_to_job_id?: string | null;
  // 합성 방식 — 'strict'=기본, 'prompt-only'=얼굴 강화. (구버전 job 은 null)
  image_reference?: 'strict' | 'prompt-only' | null;
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
  /** 스마트스토어 번들 주문의 사람용 옵션 라벨 (raw_data.option_label). */
  optionLabel: string | null;
  /** 적립 크레딧 breakdown (raw_data.granted). 구버전 주문은 null. */
  granted: {
    publish?: number;
    archive?: number;
    snap?: number;
    regen?: number;
  } | null;
}

interface Props {
  userEmail: string | null;
  invitations: MyPageInvitation[];
  creditsBalance: number;
  archiveBalance: number;
  /** AI 웨딩스냅 크레딧 잔액 (snap_credits_ledger 합). */
  snapCreditsBalance: number;
  orders: MyPageOrder[];
  entitlements: MyPageEntitlements;
}

type Tab = 'saves' | 'orders' | 'snap';

const VALID_TABS: Tab[] = ['saves', 'snap', 'orders'];

const SOURCE_LABEL: Record<MyPageOrder['source'], string> = {
  portone: '앱 내 결제 (PortOne)',
  naver_smartstore: '네이버 스마트스토어',
  manual: '수동 등록',
};

const PACKAGE_LABELS: Record<string, string> = {
  basic: '발행권 패키지',
  archive_basic: '영구소장권',
  snap_5: '웨딩스냅 5장',
  snap_10: '웨딩스냅 10장',
  snap_10_bundle: '웨딩스냅 10장(번들)',
  snap_20: '웨딩스냅 20장',
  snap_40: '웨딩스냅 40장',
  snap_50: '웨딩스냅 50장',
  snap_100: '웨딩스냅 100장',
};

/** 주문 항목명 — 스마트스토어 옵션 라벨 우선, 없으면 패키지명, 그것도 없으면 '주문'. */
function orderItemLabel(o: MyPageOrder): string {
  if (o.optionLabel) return o.optionLabel;
  if (o.package_code) return PACKAGE_LABELS[o.package_code] ?? o.package_code;
  return '주문';
}

/** 적립 크레딧 요약 — breakdown(raw_data.granted) 있으면 종류별로, 없으면 발행권 폴백. */
function orderCreditSummary(o: MyPageOrder): string {
  const parts: string[] = [];
  const g = o.granted;
  if (g) {
    if ((g.publish ?? 0) > 0) parts.push(`발행권 +${g.publish}`);
    if ((g.archive ?? 0) > 0) parts.push(`영구소장 +${g.archive}`);
    if ((g.snap ?? 0) > 0) parts.push(`스냅 +${g.snap}`);
    if ((g.regen ?? 0) > 0) parts.push(`무료재생성 +${g.regen}`);
  } else if (o.granted_credits > 0) {
    parts.push(`발행권 +${o.granted_credits}`);
  }
  return parts.length > 0 ? parts.join(' · ') : '적립 완료';
}

export function MyPageClient({
  userEmail,
  invitations,
  creditsBalance,
  archiveBalance,
  snapCreditsBalance,
  orders,
  entitlements,
}: Props) {
  const searchParams = useSearchParams();
  // ?tab=credits 는 과거 탭 — 통합된 '결혼알림장' 탭으로 폴백.
  const resolveTab = (raw: string | null): Tab => {
    if (raw === 'credits') return 'saves';
    if (raw && (VALID_TABS as string[]).includes(raw)) return raw as Tab;
    return 'saves';
  };
  const [tab, setTab] = useState<Tab>(() => resolveTab(searchParams.get('tab')));

  // ?tab=snap 같은 deep-link 가 후속 navigation 으로 들어와도 따라가게.
  useEffect(() => {
    const next = resolveTab(searchParams.get('tab'));
    if (next !== tab) setTab(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs tracking-[0.3em] text-[#8B7355]">MY PAGE</p>
        <h1 className="text-2xl font-semibold tracking-tight">마이페이지</h1>
        <p className="text-sm text-muted-foreground">
          {userEmail ?? '내 계정'}
        </p>
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b">
        <TabButton selected={tab === 'saves'} onClick={() => setTab('saves')}>
          결혼알림장
        </TabButton>
        <TabButton selected={tab === 'snap'} onClick={() => setTab('snap')}>
          AI 웨딩스냅
        </TabButton>
        <TabButton selected={tab === 'orders'} onClick={() => setTab('orders')}>
          주문
        </TabButton>
      </nav>

      {tab === 'saves' && (
        <SavedTab
          invitations={invitations}
          creditsBalance={creditsBalance}
          archiveBalance={archiveBalance}
        />
      )}
      {tab === 'snap' && (
        <SnapTab entitlements={entitlements} snapCreditsBalance={snapCreditsBalance} />
      )}
      {tab === 'orders' && <OrdersTab orders={orders} />}
    </main>
  );
}

// ── AI 웨딩스냅 ──────────────────────────────────────────────

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
      const res = await fetch('/api/snap/jobs?kind=catalog&limit=500', {
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
            카탈로그 둘러보기 · 패키지 안내
          </Link>
        </div>
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
  // 실패/타임아웃 작업은 카탈로그 영구 누적을 막기 위해 최근 7일 이내 것만 표시.
  // 환불은 snap_jobs_auto_refund_trg (migration 019) 가 자동 처리하므로 안내만.
  // 디버깅을 위해 error_message 풀텍스트를 진단 영역에 노출.
  const FAIL_WINDOW_MS = 7 * 86_400_000;
  const failedRecent = jobs.filter(
    (j) =>
      (j.status === 'failed' || j.status === 'timeout') &&
      Date.now() - new Date(j.submitted_at).getTime() < FAIL_WINDOW_MS,
  );
  const visibleJobs = pending.length + completed.length + failedRecent.length;

  if (visibleJobs === 0) {
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
            평균 약 2분 소요. 자동 새로고침 되며, 페이지를 떠나도 백그라운드에서
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

      {failedRecent.length > 0 && <FailedJobsDiagnostics jobs={failedRecent} />}
    </div>
  );
}

/**
 * 최근 7일 이내 실패한 작업 진단 영역.
 *
 * 디자인 의도:
 *   - 기본 접힘: 카탈로그가 갤러리처럼 늘어나면 실패 행이 시각 노이즈가 됨.
 *   - 펼치면 각 실패별로 카탈로그 라벨 + 제출/실패 시각 + error_message 풀텍스트.
 *     운영자/사용자가 supabase storage RLS, fal 모델 에러 같은 1차 원인을 즉시 볼 수 있게
 *     `<pre>` 모노스페이스로 노출 (truncate 안 함, scroll 가능).
 *   - 환불 안내: snap_jobs_auto_refund_trg (migration 019) 가 자동 환불해 사용자가
 *     별도 조치할 필요 없다는 점을 명시.
 */
function FailedJobsDiagnostics({ jobs }: { jobs: SnapJob[] }) {
  return (
    <details className="rounded-md border border-red-200 bg-red-50 p-3 text-[11px] text-red-900">
      <summary className="flex cursor-pointer items-center justify-between gap-2 font-medium">
        <span>최근 7일 실패한 작업 {jobs.length}개 — 펼쳐서 원인 보기</span>
        <span className="text-[10px] font-normal text-red-700">크레딧 자동 환불됨</span>
      </summary>
      <p className="mt-2 text-[10px] leading-relaxed text-red-800">
        실패한 작업의 크레딧은 자동으로 환불되었으니 다시 시도하실 수 있어요. 7일이
        지난 항목은 갤러리에서 자동으로 사라집니다. 같은 오류가 반복되면 아래
        메시지를 캡처해 문의 주세요.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {jobs.map((j) => (
          <li
            key={j.id}
            className="flex flex-col gap-1 rounded border border-red-200 bg-white p-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-red-900">
                {catalogLabel(j.catalog_id)}
              </span>
              <span className="text-[10px] text-red-700">
                {j.status === 'timeout' ? '타임아웃' : '실패'} ·{' '}
                {formatRelative(j.completed_at ?? j.submitted_at)}
              </span>
            </div>
            <div className="text-[10px] text-red-700">
              제출 {formatRelative(j.submitted_at)}
              {j.completed_at && ` → 종료 ${formatRelative(j.completed_at)}`}
            </div>
            <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-red-100/50 p-2 font-mono text-[10px] leading-relaxed text-red-900">
              {j.error_message ?? '오류 메시지 없음 (서버 로그 확인 필요)'}
            </pre>
          </li>
        ))}
      </ul>
    </details>
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
  // 로컬 패치 — 좋아요/재생성 액션 결과를 부모 jobs 와 별개로 즉시 반영.
  // (부모 jobs 는 polling refresh 로 결국 동기화되지만 즉각 UI 피드백 필요.)
  const [overrides, setOverrides] = useState<Record<string, Partial<SnapJob>>>({});
  // 재생성 모달 — null 이면 닫힘, job 객체면 해당 결과 재생성 UI 표시.
  const [regenJob, setRegenJob] = useState<SnapJob | null>(null);

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
        {visible.map((j) => {
          const patched: SnapJob = { ...j, ...overrides[j.id] };
          return (
            <SnapResultCard
              key={j.id}
              job={patched}
              onLikeToggled={(jobId, liked) =>
                setOverrides((prev) => ({
                  ...prev,
                  [jobId]: { ...prev[jobId], liked },
                }))
              }
              onRegenerateClick={(job) => setRegenJob(job)}
            />
          );
        })}
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

      {/* 재생성 모달 — 카드 [재생성] 클릭 시 노출. 부모(여기서) 모달 state 관리. */}
      {regenJob && (
        <RegenerateModal
          job={regenJob}
          onClose={() => setRegenJob(null)}
          onSubmitted={() => {
            // 모달 닫고 부모에게 알림 — 새 job 이 곧 polling 으로 잡힘.
            // (per-user 무료 quota 모델이라 per-job override 불필요.)
            setRegenJob(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * 재생성 모달 — 불만족 이유 chip + 합성 방식 선택 + 무료/유료 표시.
 *
 * ── 무료 quota (032 마이그) ──
 * 결과당 1회가 아닌 사용자 단위 누적. 마운트 시 /api/snap/regen-quota 로 조회.
 * 잔량 > 0 → "무료 N회 남음" 표시. 잔량 0 → "1 크레딧 차감" 표시.
 *
 * ── 이유별 모드 추천 ──
 *  face_unnatural → 얼굴 강화 모드 (prompt-only)
 *  pose_diff      → 기본 모드 (strict)   — 강화 모드는 포즈가 더 어긋날 수 있음
 *  outfit_bg      → 기본 모드 (strict)
 *  other          → 추천 없음 + 자유 텍스트 입력 (필수) + 사용자가 모드 직접 선택
 */
function RegenerateModal({
  job,
  onClose,
  onSubmitted,
}: {
  job: SnapJob;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const REASONS: Array<{ value: 'face_unnatural' | 'pose_diff' | 'outfit_bg' | 'other'; label: string }> = [
    { value: 'face_unnatural', label: '얼굴이 이상해요' },
    { value: 'pose_diff', label: '컷·포즈가 다르게 나왔어요' },
    { value: 'outfit_bg', label: '배경/의상이 이상해요' },
    { value: 'other', label: '기타' },
  ];
  const [reason, setReason] = useState<typeof REASONS[number]['value'] | null>(null);
  const [reasonText, setReasonText] = useState<string>('');
  // 이유별 추천 모드. 'other' 는 null = 추천 없음.
  const recommendedMode: 'strict' | 'prompt-only' | null =
    reason === 'face_unnatural'
      ? 'prompt-only'
      : reason === 'pose_diff' || reason === 'outfit_bg'
        ? 'strict'
        : null;
  const [chosenMode, setChosenMode] = useState<'strict' | 'prompt-only'>('strict');
  // reason 바뀔 때 추천 모드로 자동 전환 (사용자가 명시적으로 바꾸기 전까지).
  // 'other' 의 경우 추천이 없으므로 chosenMode 그대로 유지.
  const [modeTouched, setModeTouched] = useState<boolean>(false);
  useEffect(() => {
    if (!modeTouched && reason && recommendedMode) {
      setChosenMode(recommendedMode);
    }
  }, [reason, recommendedMode, modeTouched]);

  const [busy, setBusy] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);

  // 무료 재생성 quota — 마운트 시 1회 fetch.
  const [freeRemaining, setFreeRemaining] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/snap/regen-quota', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { freeRemaining?: number };
        if (!cancelled && typeof data.freeRemaining === 'number') {
          setFreeRemaining(data.freeRemaining);
        }
      } catch {
        // 조회 실패 시 표시 생략, 실제 차감은 서버가 처리.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const freeAvailable = (freeRemaining ?? 0) > 0;

  // 제출 가능 여부 — 이유 필수 + 'other' 는 텍스트 필수.
  const canSubmit =
    !!reason &&
    !busy &&
    (reason !== 'other' || reasonText.trim().length > 0);

  const handleSubmit = async () => {
    if (!canSubmit || !reason) return;
    setBusy(true);
    setErr(null);
    try {
      const payload: Record<string, unknown> = { reason, mode: chosenMode };
      if (reason === 'other') payload.reasonText = reasonText.trim();
      const res = await fetch(`/api/snap/jobs/${job.id}/regenerate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
      };
      if (!res.ok) {
        setErr(data.error ?? `요청 실패 (${res.status})`);
        return;
      }
      onSubmitted();
    } catch {
      setErr('네트워크 오류');
    } finally {
      setBusy(false);
    }
  };

  // ESC 닫기.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between border-b border-[#E8DCC9] px-5 py-3">
          <h3 className="text-sm font-semibold text-[#3D2E1F]">결과 재생성</h3>
          <button
            type="button"
            onClick={() => !busy && onClose()}
            disabled={busy}
            aria-label="닫기"
            className="text-[#8B7355] hover:text-[#3D2E1F]"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          <div>
            <p className="text-xs font-medium text-[#3D2E1F]">왜 다시 만드시나요?</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setReason(r.value)}
                  aria-pressed={reason === r.value}
                  className={`rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors ${
                    reason === r.value
                      ? 'border-[#3D2E1F] bg-[#3D2E1F] text-white'
                      : 'border-[#D4C5B0] bg-white text-[#5C4633] hover:border-[#8B7355]'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {reason === 'other' && (
            <div>
              <label
                htmlFor="regen-reason-text"
                className="text-xs font-medium text-[#3D2E1F]"
              >
                어떤 점이 아쉬우셨나요?
              </label>
              <textarea
                id="regen-reason-text"
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value.slice(0, 500))}
                placeholder="예: 신랑 헤어가 너무 짧게 나왔어요"
                rows={2}
                className="mt-1.5 w-full resize-none rounded-md border border-[#D4C5B0] bg-white px-2.5 py-1.5 text-[12px] text-[#3D2E1F] placeholder:text-[#B0A088] focus:border-[#8B7355] focus:outline-none"
                maxLength={500}
              />
              <p className="mt-0.5 text-right text-[10px] text-[#8B7355]">
                {reasonText.length} / 500
              </p>
            </div>
          )}

          {reason && (
            <div>
              <p className="text-xs font-medium text-[#3D2E1F]">합성 방식</p>
              <p className="mt-0.5 text-[10px] text-[#8B7355]">
                {recommendedMode ? (
                  <>
                    선택하신 이유에 맞춰{' '}
                    <strong>
                      {recommendedMode === 'prompt-only' ? '얼굴 강화 모드' : '기본 모드'}
                    </strong>
                    를 추천드려요.
                  </>
                ) : (
                  '원하시는 합성 방식을 직접 선택해주세요.'
                )}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {(['strict', 'prompt-only'] as const).map((m) => {
                  const isRec = recommendedMode !== null && m === recommendedMode;
                  const selected = chosenMode === m;
                  const label = m === 'strict' ? '기본 모드' : '얼굴 강화 모드';
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setChosenMode(m);
                        setModeTouched(true);
                      }}
                      aria-pressed={selected}
                      className={`relative rounded-md border px-2 py-2 text-[11px] font-medium transition-colors ${
                        selected
                          ? 'border-[#3D2E1F] bg-white ring-2 ring-[#3D2E1F]/20'
                          : 'border-[#D4C5B0] bg-white text-[#5C4633] hover:border-[#8B7355]'
                      }`}
                    >
                      {label}
                      {isRec && (
                        <span className="ml-1 rounded bg-emerald-600 px-1 py-0.5 text-[8px] text-white">
                          추천
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <p className="rounded border border-[#E8DCC9] bg-[#FAF7F2] px-2.5 py-1.5 text-[11px] text-[#5C4633]">
            {freeRemaining === null
              ? '재생성 비용은 무료 잔량 확인 후 자동 계산돼요.'
              : freeAvailable
                ? `무료 재생성 ${freeRemaining}회 남았어요. 이번 재생성은 무료에요.`
                : '무료 재생성 잔량이 모두 소진됐어요. 이번 재생성은 1 스냅 크레딧 차감돼요.'}
          </p>

          {err && (
            <p role="alert" className="text-[11px] text-red-600">
              {err}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[#E8DCC9] px-5 py-3">
          <button
            type="button"
            onClick={() => !busy && onClose()}
            disabled={busy}
            className="rounded-md border border-[#D4C5B0] bg-white px-3 py-1.5 text-xs font-medium text-[#5C4633] hover:bg-[#FAF7F2] disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-md bg-[#3D2E1F] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#5C4633] disabled:opacity-50"
          >
            {busy
              ? '요청 중…'
              : freeRemaining === null
                ? '재생성'
                : freeAvailable
                  ? '재생성 (무료)'
                  : '재생성 (1 크레딧)'}
          </button>
        </div>
      </div>
    </div>
  );
}


function SnapResultCard({
  job,
  onLikeToggled,
  onRegenerateClick,
}: {
  job: SnapJob;
  /** 좋아요 토글 성공 후 부모 list state 업데이트용 callback. */
  onLikeToggled?: (jobId: string, liked: boolean) => void;
  /** 재생성 버튼 클릭 시 부모가 모달 열기. */
  onRegenerateClick?: (job: SnapJob) => void;
}) {
  const [liked, setLiked] = useState<boolean>(!!job.liked);
  const [likeBusy, setLikeBusy] = useState<boolean>(false);
  const [dlBusy, setDlBusy] = useState<boolean>(false);
  const isCompleted = job.status === 'completed' && !!job.result_url;
  const isCatalog = job.kind === 'catalog';
  // 합성 모드 — 기본(strict, 카탈로그 마스터 참조) / 얼굴 강화(prompt-only, 얼굴 보존 우선).
  // image_reference 가 없는 구버전 catalog job 은 기본(strict) 으로 간주.
  const modeLabel = !isCatalog
    ? null
    : job.image_reference === 'prompt-only'
      ? '얼굴 강화 모드'
      : '기본 모드';

  // 이미지 다운로드 — 외부(Supabase) URL 은 a[download] 만으로는 새 탭만 열리므로
  // blob 으로 받아 강제 저장. CORS 등 실패 시 새 탭으로 폴백.
  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!job.result_url || dlBusy) return;
    setDlBusy(true);
    try {
      const res = await fetch(job.result_url, { mode: 'cors' });
      if (!res.ok) throw new Error('fetch failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wedding-snap-${job.id.slice(0, 8)}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(job.result_url, '_blank', 'noopener,noreferrer');
    } finally {
      setDlBusy(false);
    }
  };

  // 부모에서 job 객체가 갱신되면 (예: 폴링) liked 상태 sync.
  useEffect(() => {
    setLiked(!!job.liked);
  }, [job.liked]);

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (likeBusy) return;
    setLikeBusy(true);
    const prev = liked;
    setLiked(!prev); // optimistic
    try {
      const res = await fetch(`/api/snap/jobs/${job.id}/like`, { method: 'POST' });
      if (!res.ok) throw new Error('like failed');
      const data = (await res.json()) as { liked: boolean };
      setLiked(data.liked);
      onLikeToggled?.(job.id, data.liked);
    } catch {
      setLiked(prev); // revert
    } finally {
      setLikeBusy(false);
    }
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-[#E8DCC9] bg-white">
      <a
        href={job.result_url ?? '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="grid aspect-[3/4] w-full place-items-center overflow-hidden bg-[#F5EDE0] transition-transform hover:scale-[1.02]"
      >
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
      </a>
      <div className="flex flex-col gap-1.5 p-1.5">
        <div>
          <div className="flex items-center gap-1">
            <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-[#3D2E1F]">
              {catalogLabel(job.catalog_id)}
            </p>
            {modeLabel && (
              <span className="shrink-0 rounded bg-[#EFE6DC] px-1 py-0.5 text-[9px] font-medium text-[#5C4633]">
                {modeLabel}
              </span>
            )}
          </div>
          <p className="text-[10px] text-[#8B7355]">
            {formatRelative(job.completed_at ?? job.submitted_at)}
          </p>
        </div>
        {/* 완료된 결과는 이미지별 다운로드 버튼 제공 (catalog/anchor 무관). */}
        {isCompleted && (
          <button
            type="button"
            onClick={handleDownload}
            disabled={dlBusy}
            title="이미지 저장"
            className="flex w-full items-center justify-center gap-1 rounded border border-[#D4C5B0] bg-white px-1.5 py-1 text-[10px] font-medium text-[#5C4633] transition-colors hover:border-[#8B7355] disabled:opacity-50"
          >
            <span aria-hidden>⤓</span>
            <span>{dlBusy ? '저장 중...' : '이미지 저장'}</span>
          </button>
        )}
        {/* 완료된 catalog 결과에만 좋아요 + 재생성 버튼. */}
        {isCompleted && isCatalog && (
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={handleLike}
              disabled={likeBusy}
              aria-pressed={liked}
              title={liked ? '좋아요 취소' : '좋아요'}
              className={`flex flex-1 items-center justify-center gap-1 rounded border px-1.5 py-1 text-[10px] font-medium transition-colors disabled:opacity-50 ${
                liked
                  ? 'border-rose-500 bg-rose-50 text-rose-700'
                  : 'border-[#D4C5B0] bg-white text-[#5C4633] hover:border-rose-400'
              }`}
            >
              <span aria-hidden>{liked ? '♥' : '♡'}</span>
              <span>좋아요</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRegenerateClick?.(job);
              }}
              title="재생성"
              className="flex flex-1 items-center justify-center gap-1 rounded border border-[#D4C5B0] bg-white px-1.5 py-1 text-[10px] font-medium text-[#5C4633] transition-colors hover:border-[#8B7355]"
            >
              <span aria-hidden>↻</span>
              <span>재생성</span>
            </button>
          </div>
        )}
      </div>
    </div>
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
  creditsBalance,
  archiveBalance,
}: {
  invitations: MyPageInvitation[];
  creditsBalance: number;
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
      <section className="flex flex-col gap-4">
        <CreditsSummary balance={creditsBalance} archiveBalance={archiveBalance} />
        <div className="flex flex-col items-center gap-4 rounded-lg bg-white p-10 text-center ring-1 ring-[#D4C5B0]">
          <p className="text-sm text-muted-foreground">아직 저장된 알림장이 없어요.</p>
          <Link
            href="/new"
            className="inline-flex h-10 items-center justify-center rounded-md bg-[#8B7355] px-5 text-sm font-medium text-white"
          >
            새 알림장 만들기
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <CreditsSummary balance={creditsBalance} archiveBalance={archiveBalance} />

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

// ── 발행권 · 영구소장 (결혼알림장 탭에 통합) ────────────────

/**
 * 결혼알림장 탭 상단의 잔여 발행권 / 영구소장권 요약.
 *
 * 변경 이력:
 *   - v1: 2-column 박스, p-5/text-3xl
 *   - v2: 2-column 박스 축소 (p-3/text-xl) + 보유 패키지 삭제 + 주문카드 [주문] 탭으로 이동
 *   - v3: 단일 row 인라인 plain text. 사이즈는 작지만 가독성 부족.
 *   - v4: chip 박스(rounded-full, ring) + 이모지 아이콘.
 *   - v5: 이모지 제거 — 라벨 + 큰 숫자만 ring 된 capsule 로 표시. 텍스트
 *         hierarchy(작은 라벨 / 큰 값) 로 가독성 유지.
 */
function CreditsSummary({
  balance,
  archiveBalance,
}: {
  balance: number;
  archiveBalance: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <CreditChip label="발행권" value={balance} />
      <CreditChip label="영구소장권" value={archiveBalance} />
    </div>
  );
}

function CreditChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-baseline gap-2 rounded-full bg-white px-3 py-1 ring-1 ring-[#D4C5B0]">
      <span className="text-xs text-[#5C4633]">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-[#3D2E1F]">
        {value}
      </span>
    </span>
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
      const r = (data?.result ?? {}) as {
        idempotent?: boolean;
        label?: string | null;
        granted_publish?: number;
        granted_archive?: number;
        granted_snap?: number;
        granted_regen?: number;
      };
      if (r.idempotent) {
        setMsg({ kind: 'ok', text: '이미 적립된 주문입니다.' });
      } else {
        const parts: string[] = [];
        if ((r.granted_publish ?? 0) > 0) parts.push(`발행권 ${r.granted_publish}개`);
        if ((r.granted_archive ?? 0) > 0) parts.push(`영구소장권 ${r.granted_archive}개`);
        if ((r.granted_snap ?? 0) > 0) parts.push(`웨딩스냅 ${r.granted_snap} 크레딧`);
        if ((r.granted_regen ?? 0) > 0) parts.push(`무료 재생성 ${r.granted_regen}회`);
        setMsg({
          kind: 'ok',
          text: parts.length
            ? `${r.label ? `${r.label} — ` : ''}${parts.join(', ')} 적립되었습니다.`
            : '적립이 완료되었습니다.',
        });
      }
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
          네이버 스마트스토어 결제 내역의 <strong>주문번호</strong> 또는 <strong>상품주문번호</strong>를 입력해주세요.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={orderNo}
          onChange={(e) => setOrderNo(e.target.value)}
          placeholder="예: 2026010112345678"
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

// ── 주문 ─────────────────────────────────────────────────────

/**
 * 주문 탭 — 과거 결제 내역 + 주문 등록 액션.
 *
 * 이전엔 "스마트스토어 주문번호 등록" 과 "네이버 로그인 주문 가져오기" 가 결혼
 * 알림장 탭(CreditsSummary 하단) 에 같이 있었으나, 알림장 흐름과는 결이 달라
 * [주문] 탭으로 이동. 사용자가 결제 후 마이페이지 → 주문 탭에서 한 화면에 등록
 * 액션 + 내역 확인 가능.
 */
function OrdersTab({ orders }: { orders: MyPageOrder[] }) {
  const total = useMemo(() => orders.reduce((acc, o) => acc + (o.amount ?? 0), 0), [orders]);

  return (
    <section className="flex flex-col gap-4">
      {/* 주문 등록 액션 — 결혼알림장 탭에서 이동.
          로그인 자체가 네이버 OAuth 단독이라 모든 사용자는 이미 네이버 계정과
          연동돼 있다 → 별도 "네이버 연결" 카드는 중복이라 제거. 크레딧은 아래
          상품주문번호 입력으로 적립한다. */}
      <RegisterOrderCard />

      {/* 결제 내역 */}
      {orders.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg bg-white p-10 text-center ring-1 ring-[#D4C5B0]">
          <p className="text-sm text-muted-foreground">아직 주문 내역이 없어요.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
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
                      · {orderItemLabel(o)}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">{orderCreditSummary(o)}</p>
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
        </div>
      )}
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

