import type { Metadata } from 'next';
import Link from 'next/link';
import { checkAdmin } from '@/lib/auth/admin';

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

// admin 상태는 매 요청마다 확인 — cache 없음.
export const dynamic = 'force-dynamic';

/**
 * /admin 인덱스 — 운영자 전용 하위 페이지 모음.
 *
 * 권한:
 *   - admin 이면 하위 페이지 카드 표시.
 *   - 비-admin 이면 404 대신 명시적 "권한 없음" 화면 (디버깅 편의).
 *     → 어떤 이메일이 admin 인지, 어떻게 부여하는지 안내 출력.
 *
 * 새 admin 페이지를 추가하면 ADMIN_PAGES 배열에 등록만 하면 자동 노출.
 */

interface AdminPage {
  href: string;
  title: string;
  description: string;
}

// 탭 순서: 가입자 → 알림장 관련 → 스냅 관련.
const ADMIN_PAGES: AdminPage[] = [
  // ── 가입자 ──
  {
    href: '/admin/users',
    title: '가입자 / 크레딧',
    description:
      '가입자 목록 + 발행권·영구소장·스냅 잔액 + 결제 건수/총액 조회. 크레딧을 수동으로 지급/회수(admin_grant·admin_revoke).',
  },
  // ── 알림장 관련 ──
  {
    href: '/admin/invitations',
    title: '알림장 목록',
    description:
      '알림장을 최신순으로 조회. 생성자 이메일 필터 + 발행된 것만 보기 + 발행 알림장 링크 바로 열람.',
  },
  {
    href: '/admin/invitation-stats',
    title: '알림장 통계',
    description:
      '가입·제작·결제·영구소장 고객 수와 전환율, 발행 알림장의 테마·레이아웃·폰트·슬라이드 선택 분포를 집계(운영자·테스트 계정 제외).',
  },
  {
    href: '/admin/home-samples',
    title: '알림장 샘플 설정',
    description:
      '알림장 디자인 표지(레이아웃·테마·효과·폰트·사진·이름·날짜)와 공유 본문 템플릿을 세팅. 저장 즉시 메인/디자인 샘플 페이지에 반영.',
  },
  {
    href: '/admin/social-proof',
    title: '사회적 증거 설정',
    description:
      '메인 알림장 섹션 상단 사회적 증거(리뷰 이미지 + 별점 + 자동 커플 수)를 세팅. 메인 노출 토글로 즉시 반영.',
  },
  {
    href: '/admin/showcase',
    title: 'showcase 커버 관리',
    description:
      '동의 고객 알림장 메인 사진에 얼굴 스티커를 붙여 익명화한 뒤, 실제 메인 디자인을 홈 디자인 마퀴에 config 렌더로 노출.',
  },
  {
    href: '/admin/notice-bar',
    title: '상단 공지바',
    description:
      '홈 상단 전체폭 공지 띠(문구/링크/노출 여부)를 세팅. 기존 고객 대상 개별 메시지 대신 홈 안내로 갈음. 기본 비노출.',
  },
  // ── 스냅 관련 ──
  {
    href: '/admin/snap-jobs',
    title: 'AI 스냅 생성내역',
    description:
      'AI 웨딩스냅(catalog) 생성 기록을 최신순으로 조회. 이메일 필터 + 입력/결과 이미지 클릭 확대 + 반응(좋아요·재생성 사유) 표시.',
  },
  {
    href: '/admin/snap-samples',
    title: 'AI 스냅 샘플 설정',
    description:
      '메인 화면의 샘플 AI스냅(폴라로이드·썸네일 스트립)과 Before/After 슬라이더를 세팅. 저장 즉시 메인 페이지에 반영.',
  },
  {
    href: '/admin/snap-catalog-order',
    title: '카탈로그 노출 순서',
    description:
      'AI 스냅 카탈로그 화면의 기본 정렬 순서를 위/아래로 직접 조정. 저장 즉시 사용자 카탈로그 화면에 반영.',
  },
  {
    href: '/admin/snap-catalog-tags',
    title: '카탈로그 태그 관리',
    description:
      '카탈로그 × 입력 조건(셀카 / 커플 전신) 별로 추천 / 주의 / 비추 / 숨김 태그를 부여. 사용자 페이지 호환성 판정·정렬·hidden 필터에 그대로 반영.',
  },
  {
    href: '/admin/snap-catalog-stats',
    title: '카탈로그 통계',
    description:
      '카탈로그 × 모드 별 누적 생성/좋아요/재생성 통계. like_rate 가 낮거나 regen_rate 가 높은 카탈로그는 운영자 검토 대상.',
  },
];

export default async function AdminIndexPage() {
  const ctx = await checkAdmin();

  if (!ctx) {
    return (
      <main className="mx-auto max-w-2xl px-4 pb-20 pt-10 sm:px-6">
        <h1 className="text-xl font-semibold text-[#3D2E1F]">권한 없음</h1>
        <p className="mt-3 text-sm text-[#5C4633]">
          이 페이지는 운영자 (<code className="rounded bg-[#FAF7F2] px-1">app_metadata.role = &apos;admin&apos;</code>) 만 접근할 수 있어요.
        </p>
        <div className="mt-4 rounded border border-[#E8DCC9] bg-[#FAF7F2] p-4 text-xs leading-relaxed text-[#5C4633]">
          <p className="font-medium text-[#3D2E1F]">권한 부여 방법</p>
          <p className="mt-2">
            supabase SQL editor 에서 본인 이메일에 admin role 추가:
          </p>
          <pre className="mt-2 overflow-x-auto rounded bg-white p-2 text-[11px] text-[#3D2E1F]">
{`update auth.users
   set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'::jsonb
 where email = 'YOUR_EMAIL@example.com';`}
          </pre>
          <p className="mt-2 text-[#8B7355]">
            업데이트 후 로그아웃 → 다시 로그인하면 새 role 이 세션에 반영됩니다.
          </p>
        </div>
        <p className="mt-4 text-[11px] text-[#8B7355]">
          현재 로그인된 사용자가 admin 이 아니거나 로그인 자체가 안 된 상태입니다.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-10 sm:px-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-[#3D2E1F]">Admin</h1>
        <p className="mt-1 text-xs text-[#8B7355]">
          운영자 전용 페이지 모음. 로그인 계정: {ctx.email}
        </p>
      </header>
      <ul className="grid gap-3 sm:grid-cols-2">
        {ADMIN_PAGES.map((p) => (
          <li key={p.href}>
            <Link
              href={p.href}
              className="flex h-full flex-col gap-2 rounded-md border border-[#E8DCC9] bg-white p-4 transition-colors hover:border-[#8B7355] hover:bg-[#FAF7F2]"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-[#3D2E1F]">{p.title}</span>
                <span className="text-[10px] text-[#8B7355]">→</span>
              </div>
              <p className="text-[11px] leading-relaxed text-[#5C4633]">
                {p.description}
              </p>
              <code className="mt-auto text-[10px] text-[#8B7355]">{p.href}</code>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
