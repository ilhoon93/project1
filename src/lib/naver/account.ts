import { createAdminClient } from '@/lib/supabase/admin';

/**
 * 이메일 동의를 거부했거나 누락된 경우, 콜백에서 auth.users 에 임시로 넣는
 * 내부 가짜 이메일의 도메인. (naver_<id>@users.minimum-wedding.local)
 * 화면에는 절대 노출하지 않는다.
 */
const INTERNAL_EMAIL_DOMAIN = 'users.minimum-wedding.local';

export function isInternalPseudoEmail(email: string | null | undefined): boolean {
  return (
    !!email && email.trim().toLowerCase().endsWith(`@${INTERNAL_EMAIL_DOMAIN}`)
  );
}

/**
 * 로그인 사용자의 naver_accounts.email 을 조회한다. SERVER ONLY.
 *
 * naver_accounts 는 OAuth 토큰(access/refresh)을 보관하므로 RLS 정책을 열어
 * 클라이언트가 직접 읽게 두지 않는다. 대신 서버에서 service-role 로 email
 * 컬럼만 골라 읽는다. 반환: 트림된 email (빈 문자열/NULL 이면 null).
 */
export async function getNaverAccountEmail(
  userId: string,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('naver_accounts')
    .select('email')
    .eq('user_id', userId)
    .maybeSingle();
  const email = data?.email?.trim();
  return email ? email : null;
}

/**
 * 헤더/마이페이지에 보여줄 사용자 표시 이메일.
 *
 * 1순위: naver_accounts.email (운영자가 원하는 컬럼)
 * 2순위: auth 이메일 — 단 내부 가짜 이메일은 제외
 * 둘 다 없으면 null → UI 에서 '프로필' / '내 계정' 등 플레이스홀더로 폴백.
 *
 * 가짜 이메일(@users.minimum-wedding.local)은 어느 경로로도 노출하지 않는다.
 */
export async function getDisplayEmail(
  userId: string,
  authEmail: string | null,
): Promise<string | null> {
  const naverEmail = await getNaverAccountEmail(userId);
  if (naverEmail && !isInternalPseudoEmail(naverEmail)) return naverEmail;
  if (authEmail && !isInternalPseudoEmail(authEmail)) return authEmail;
  return null;
}
