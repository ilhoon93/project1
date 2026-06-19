import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { checkAdmin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  createPrivateSignedUrlsBulk,
  refreshPrivateSignedUrl,
  SIGNED_URL_TTL_SHORT,
} from '@/lib/snap/private-storage';
import { SnapJobsTable, type SnapJobRow } from './SnapJobsTable';

export const metadata: Metadata = {
  title: 'Admin · AI 스냅 생성내역',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 30;

/** admin_snap_jobs RPC 가 돌려주는 raw row. */
interface RpcRow {
  id: string;
  user_id: string;
  email: string | null;
  kind: string;
  catalog_id: string | null;
  catalog_path: string | null;
  status: string;
  submitted_at: string;
  completed_at: string | null;
  result_url: string | null;
  couple_photo_url: string | null;
  couple_photo_path: string | null;
  groom_selfie_url: string | null;
  bride_selfie_url: string | null;
  image_reference: string | null;
  quality: string | null;
  credit_delta: number | null;
  fal_cost_usd: number | null;
  liked: boolean;
  liked_at: string | null;
  regen_reason: string | null;
  regen_reason_text: string | null;
  regen_to_job_id: string | null;
  error_message: string | null;
}

interface PageProps {
  searchParams: { email?: string; page?: string };
}

export default async function AdminSnapJobsPage({ searchParams }: PageProps) {
  const admin = await checkAdmin();
  if (!admin) notFound();

  const email = (searchParams.email ?? '').trim();
  const page = Math.max(0, Number.parseInt(searchParams.page ?? '0', 10) || 0);

  // 데이터 조회를 통째로 try/catch — RPC 미적용/환경변수 누락/서명 실패 등 어떤
  // 예외든 500 대신 화면에 실제 원인 메시지를 띄워 진단 가능하게 한다.
  let rows: SnapJobRow[] = [];
  let hasMore = false;
  let errorMsg: string | null = null;

  try {
    const sb = createAdminClient();
    // PAGE_SIZE + 1 로 요청해 다음 페이지 존재 여부를 판단.
    // admin_snap_jobs 는 046 에서 추가된 RPC — 자동생성 Database 타입에 아직
    // 없어 호출부를 느슨한 타입으로 캐스팅한다. (마이그 타입 재생성 전 호환)
    // 주의: sb.rpc 를 변수로 떼어내 호출하면 this 바인딩이 끊겨 supabase
    // 내부에서 "Cannot read properties of undefined (reading 'rest')" 가 난다.
    // 반드시 객체 메서드(adminRpc.rpc(...)) 로 호출해 this(=sb) 를 보존한다.
    const adminRpc = sb as unknown as {
      rpc: (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const { data, error } = await adminRpc.rpc('admin_snap_jobs', {
      p_email: email || null,
      p_limit: PAGE_SIZE + 1,
      p_offset: page * PAGE_SIZE,
    });
    if (error) throw new Error(error.message);

    const raw = (Array.isArray(data) ? data : []) as RpcRow[];
    hasMore = raw.length > PAGE_SIZE;
    const pageRaw = raw.slice(0, PAGE_SIZE);

    // couple 모드 입력 사진은 private-uploads 의 만료 가능한 signed URL → path 로
    // 현재 페이지 행만 재서명. (path 없으면 저장된 url 폴백.)
    const couplePaths = Array.from(
      new Set(
        pageRaw
          .filter((r) => r.catalog_path === 'couple' && r.couple_photo_path)
          .map((r) => r.couple_photo_path as string),
      ),
    );
    const signedMap = new Map<string, string>();
    if (couplePaths.length > 0) {
      const signed = await createPrivateSignedUrlsBulk(
        couplePaths,
        SIGNED_URL_TTL_SHORT,
      );
      couplePaths.forEach((p, i) => {
        const url = signed[i];
        if (url) signedMap.set(p, url);
      });
    }

    rows = await Promise.all(
      pageRaw.map(async (r) => {
        // 입력 사진은 private-uploads 의 만료된 서명 URL 로 저장돼 있어 그대로
        // 쓰면 깨진다. couple 은 path 로 재서명(signedMap), selfie 는 신랑·신부
        // 셀카 양쪽을 refreshPrivateSignedUrl 로 즉시 재서명해 둘 다 보여준다.
        let inputUrls: string[] = [];
        let inputKind: SnapJobRow['input_kind'] = null;
        if (r.catalog_path === 'couple') {
          inputKind = 'couple';
          const fromPath = r.couple_photo_path
            ? signedMap.get(r.couple_photo_path)
            : undefined;
          const u =
            fromPath ??
            (r.couple_photo_url
              ? await refreshPrivateSignedUrl(r.couple_photo_url)
              : null);
          if (u) inputUrls = [u];
        } else {
          inputKind = 'selfie';
          const both = await Promise.all([
            r.groom_selfie_url
              ? refreshPrivateSignedUrl(r.groom_selfie_url)
              : Promise.resolve(null),
            r.bride_selfie_url
              ? refreshPrivateSignedUrl(r.bride_selfie_url)
              : Promise.resolve(null),
          ]);
          inputUrls = both.filter((x): x is string => !!x);
        }
        return {
          id: r.id,
          user_id: r.user_id,
          email: r.email,
          catalog_id: r.catalog_id,
          catalog_path: r.catalog_path,
          status: r.status,
          submitted_at: r.submitted_at,
          completed_at: r.completed_at,
          result_url: r.result_url,
          input_urls: inputUrls,
          input_kind: inputKind,
          image_reference: r.image_reference,
          quality: r.quality,
          credit_delta: r.credit_delta,
          fal_cost_usd: r.fal_cost_usd,
          liked: r.liked,
          liked_at: r.liked_at,
          regen_reason: r.regen_reason,
          regen_reason_text: r.regen_reason_text,
          regen_to_job_id: r.regen_to_job_id,
          error_message: r.error_message,
        };
      }),
    );
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : String(e);
    console.error('[admin/snap-jobs] load failed', e);
  }

  // RPC 함수 미적용으로 보이는 경우 안내 힌트.
  const looksMissingRpc =
    !!errorMsg &&
    (/admin_snap_jobs/i.test(errorMsg) ||
      /PGRST202/i.test(errorMsg) ||
      /could not find the function/i.test(errorMsg) ||
      /does not exist/i.test(errorMsg));

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6">
      <header className="mb-4">
        <h1 className="text-xl font-semibold text-[#3D2E1F]">AI 스냅 생성내역</h1>
        <p className="mt-1 text-xs leading-relaxed text-[#8B7355]">
          웨딩스냅(catalog) 생성 기록을 최신순으로 조회합니다. 이메일로 필터링하고,
          입력·결과 이미지를 클릭하면 크게 볼 수 있습니다.
          <span className="ml-2">로그인 계정: {admin.email}</span>
        </p>
      </header>

      {errorMsg ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          <p>생성내역을 불러오지 못했습니다: {errorMsg}</p>
          {looksMissingRpc && (
            <p className="mt-2 text-[#8B7355]">
              DB 마이그레이션이 아직 적용되지 않은 것 같습니다. 다음을 실행해
              주세요: <code className="font-mono">npx supabase db push</code>{' '}
              (046_admin_snap_jobs.sql)
            </p>
          )}
        </div>
      ) : (
        <SnapJobsTable
          rows={rows}
          email={email}
          page={page}
          hasMore={hasMore}
        />
      )}
    </main>
  );
}
