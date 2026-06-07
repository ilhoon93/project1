import { createAdminClient } from '@/lib/supabase/admin';

/**
 * 로그인 사용자의 naver_accounts.email 을 조회한다. SERVER ONLY.
 *
 * naver_accounts 는 OAuth 토큰(access/refresh)을 보관하므로 RLS 정책을 열어
 * 클라이언트가 직접 읽게 두지 않는다. 대신 서버에서 service-role 로 email
 * 컬럼만 골라 읽어 헤더/마이페이지 표시값으로 쓴다.
 *
 * 반환: 트림된 email (빈 문자열/NULL 이면 null).
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
