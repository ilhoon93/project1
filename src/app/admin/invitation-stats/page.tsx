import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { checkAdmin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { InvitationContentSchema } from '@/types/invitation';
import {
  COLOR_THEME_LABELS,
  PETAL_LABELS,
  FONT_OPTIONS,
  SECTION_LABELS,
  type ColorTheme,
  type PetalType,
  type FontKey,
  type SectionKey,
} from '@/lib/theme';

export const metadata: Metadata = {
  title: 'Admin · 알림장 통계',
  robots: { index: false, follow: false },
};

// admin route 는 항상 dynamic — 통계는 매 요청마다 fresh aggregate.
export const dynamic = 'force-dynamic';

interface StatsRow {
  signup_count: number;
  made_customer_count: number;
  paid_customer_count: number;
  invitation_count: number;
  made_invitation_count: number;
  published_count: number;
}

/** 메인 표지 레이아웃 라벨 (content.main.layout). polaroid 는 frame 으로 흡수. */
const MAIN_LAYOUT_LABELS: Record<string, string> = {
  poster: '풀이미지(포스터)',
  frame: '액자 프레임',
  illustration: '일러스트',
  text: '텍스트',
};

/** 발행 알림장에서 켜짐 비율을 볼 슬라이드(옵션 섹션). 메인/엔딩은 항상 노출이라 제외. */
const OPTIONAL_SECTIONS: SectionKey[] = [
  'basic',
  'story',
  'gallery',
  'video',
  'quiz',
  'vote',
  'guestbook',
  'account',
];

type Tally = { key: string; label: string; count: number };

/** 카운트 맵 → 비율 내림차순 정렬 배열. labeler 로 라벨 매핑, 미지의 키는 원문. */
function toDistribution(
  counts: Map<string, number>,
  labeler: (key: string) => string,
): Tally[] {
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, label: labeler(key), count }))
    .sort((a, b) => b.count - a.count);
}

export default async function InvitationStatsAdminPage() {
  const ctx = await checkAdmin();
  if (!ctx) notFound();

  const sb = createAdminClient();

  // ── 1. 스칼라 카운트 (RPC) ────────────────────────────────────
  // admin_invitation_stats 는 자동생성 DB 타입(050 미반영)에 아직 없어 캐스팅.
  const { data: statsData, error: statsError } = await sb.rpc(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    'admin_invitation_stats' as any,
  );
  const stats: StatsRow | null = Array.isArray(statsData)
    ? ((statsData[0] as StatsRow | undefined) ?? null)
    : null;

  // ── 2. 발행 알림장 content 로 분포 집계 ──────────────────────────
  const { data: pubRows, error: pubError } = await sb
    .from('invitations')
    .select('content')
    .eq('is_published', true);

  const colorCounts = new Map<string, number>();
  const layoutCounts = new Map<string, number>();
  const fontCounts = new Map<string, number>();
  const petalCounts = new Map<string, number>();
  const sectionCounts = new Map<string, number>();
  let parsedPublished = 0;

  for (const row of pubRows ?? []) {
    const parsed = InvitationContentSchema.safeParse(
      (row as { content: unknown }).content ?? {},
    );
    if (!parsed.success) continue;
    parsedPublished += 1;
    const c = parsed.data;

    const inc = (m: Map<string, number>, k: string) =>
      m.set(k, (m.get(k) ?? 0) + 1);

    inc(colorCounts, c.theme.colorTheme);
    inc(petalCounts, c.theme.petalType);
    inc(fontCounts, c.theme.font);
    // polaroid 레이아웃 키는 frame 으로 흡수해 집계.
    inc(layoutCounts, c.main.layout === 'polaroid' ? 'frame' : c.main.layout);

    for (const key of OPTIONAL_SECTIONS) {
      const section = c[key as keyof typeof c] as { enabled?: boolean } | undefined;
      if (section?.enabled) inc(sectionCounts, key);
    }
  }

  const colorDist = toDistribution(
    colorCounts,
    (k) => COLOR_THEME_LABELS[k as ColorTheme] ?? k,
  );
  const layoutDist = toDistribution(layoutCounts, (k) => MAIN_LAYOUT_LABELS[k] ?? k);
  const fontDist = toDistribution(fontCounts, (k) => FONT_OPTIONS[k as FontKey]?.label ?? k);
  const petalDist = toDistribution(petalCounts, (k) => PETAL_LABELS[k as PetalType] ?? k);
  // 슬라이드는 "켜짐 비율" 이 의미 있으므로 코드 순서(OPTIONAL_SECTIONS) 유지.
  const sectionDist: Tally[] = OPTIONAL_SECTIONS.map((key) => ({
    key,
    label: SECTION_LABELS[key],
    count: sectionCounts.get(key) ?? 0,
  }));

  return (
    <main className="mx-auto max-w-4xl px-4 pb-24 pt-6 sm:px-6">
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-[#3D2E1F]">알림장 통계</h1>
        <p className="mt-1 text-xs leading-relaxed text-[#8B7355]">
          가입·제작·결제 고객 수와 발행된 알림장의 디자인 선택 분포. 매 요청마다
          최신 집계.
          <span className="ml-2">로그인 계정: {ctx.email}</span>
        </p>
      </header>

      {statsError && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          통계 집계 실패: {statsError.message}
          <br />
          (마이그레이션 050 이 적용되었는지 확인해주세요.)
        </p>
      )}

      {/* ── 핵심 지표 카드 ─────────────────────────────── */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="가입자 수"
          value={stats?.signup_count ?? 0}
          hint="전체 가입 계정"
        />
        <StatCard
          label="알림장 제작 고객"
          value={stats?.made_customer_count ?? 0}
          hint="수정한 알림장을 1건이라도 보유"
        />
        <StatCard
          label="알림장 결제 고객"
          value={stats?.paid_customer_count ?? 0}
          hint="발행권(알림장) 구매"
        />
      </section>

      {/* ── 보조 지표 ─────────────────────────────── */}
      <section className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="전체 알림장" value={stats?.invitation_count ?? 0} small />
        <StatCard label="제작(수정)된 알림장" value={stats?.made_invitation_count ?? 0} small />
        <StatCard label="발행된 알림장" value={stats?.published_count ?? 0} small />
      </section>

      {/* ── 발행 알림장 디자인 분포 ─────────────────────── */}
      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-[#3D2E1F]">
            발행된 알림장 디자인 분포
          </h2>
          <span className="text-[11px] text-[#8B7355]">
            집계 대상 {parsedPublished}건
          </span>
        </div>

        {pubError ? (
          <p className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            발행 알림장 조회 실패: {pubError.message}
          </p>
        ) : parsedPublished === 0 ? (
          <p className="rounded-md border border-[#E8DCC9] bg-[#FAF7F2] p-4 text-xs text-[#8B7355]">
            아직 발행된 알림장이 없어 분포를 표시할 수 없습니다.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <DistCard title="색상 테마" rows={colorDist} total={parsedPublished} />
            <DistCard title="표지 레이아웃" rows={layoutDist} total={parsedPublished} />
            <DistCard title="폰트" rows={fontDist} total={parsedPublished} />
            <DistCard title="배경 효과" rows={petalDist} total={parsedPublished} />
            <DistCard
              title="슬라이드 사용 비율"
              rows={sectionDist}
              total={parsedPublished}
              note="각 슬라이드가 켜진 알림장 비율"
            />
          </div>
        )}
      </section>
    </main>
  );
}

/* ─────────────────────── presentational ─────────────────────── */

function StatCard({
  label,
  value,
  hint,
  small,
}: {
  label: string;
  value: number;
  hint?: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-md border border-[#E8DCC9] bg-white p-4">
      <div className="text-[11px] font-medium text-[#8B7355]">{label}</div>
      <div
        className={`mt-1 font-semibold text-[#3D2E1F] ${small ? 'text-xl' : 'text-2xl'}`}
      >
        {value.toLocaleString('ko-KR')}
        <span className="ml-1 text-xs font-normal text-[#8B7355]">명</span>
      </div>
      {hint && <div className="mt-1 text-[10.5px] text-[#B09B80]">{hint}</div>}
    </div>
  );
}

function DistCard({
  title,
  rows,
  total,
  note,
}: {
  title: string;
  rows: Tally[];
  total: number;
  note?: string;
}) {
  return (
    <div className="rounded-md border border-[#E8DCC9] bg-white p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-[12.5px] font-semibold text-[#3D2E1F]">{title}</h3>
        {note && <span className="text-[10px] text-[#B09B80]">{note}</span>}
      </div>
      <ul className="flex flex-col gap-1.5">
        {rows.map((r) => {
          const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
          return (
            <li key={r.key} className="text-[11.5px]">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[#3D2E1F]">{r.label}</span>
                <span className="flex-shrink-0 tabular-nums text-[#8B7355]">
                  {r.count}건 · {pct}%
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#F0E9DE]">
                <div
                  className="h-full rounded-full bg-[#8B7355]"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
