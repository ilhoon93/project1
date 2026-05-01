/**
 * Naver Login (OAuth 2.0) helpers — server only.
 *
 * Naver isn't one of Supabase's first-party OAuth providers, so we
 * orchestrate the dance ourselves:
 *
 *   1. /api/auth/naver/start → redirect to Naver authorise URL
 *   2. user grants → Naver redirects to /api/auth/naver/callback
 *   3. callback exchanges the code for { access_token, refresh_token,
 *      profile } against Naver, then mints a Supabase session for the
 *      matching auth.users row (admin.generateLink → exchangeCodeForSession)
 *   4. naver_accounts is upserted with the tokens so /mypage can later
 *      pull Smart Store orders without re-asking for permission.
 */

const NAVER_AUTHORIZE_URL = 'https://nid.naver.com/oauth2.0/authorize';
const NAVER_TOKEN_URL = 'https://nid.naver.com/oauth2.0/token';
const NAVER_PROFILE_URL = 'https://openapi.naver.com/v1/nid/me';

export interface NaverProfile {
  id: string;
  email?: string;
  name?: string;
  nickname?: string;
  profile_image?: string;
  [k: string]: unknown;
}

export interface NaverTokens {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: string | number; // Naver returns string seconds
  scope?: string;
}

const env = (key: string): string => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
};

export const buildNaverAuthorizeUrl = (state: string, redirectUri: string) => {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env('NAVER_CLIENT_ID'),
    redirect_uri: redirectUri,
    state,
  });
  return `${NAVER_AUTHORIZE_URL}?${params.toString()}`;
};

export const exchangeNaverCode = async (
  code: string,
  state: string,
): Promise<NaverTokens> => {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: env('NAVER_CLIENT_ID'),
    client_secret: env('NAVER_CLIENT_SECRET'),
    code,
    state,
  });

  const res = await fetch(`${NAVER_TOKEN_URL}?${params.toString()}`, {
    method: 'GET',
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Naver token exchange failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as NaverTokens & { error?: string; error_description?: string };
  if (data.error) {
    throw new Error(`Naver token error: ${data.error} ${data.error_description ?? ''}`);
  }
  return data;
};

export const fetchNaverProfile = async (accessToken: string): Promise<NaverProfile> => {
  const res = await fetch(NAVER_PROFILE_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Naver profile fetch failed (${res.status})`);
  }
  const json = (await res.json()) as { resultcode: string; message: string; response: NaverProfile };
  if (json.resultcode !== '00') {
    throw new Error(`Naver profile error: ${json.message}`);
  }
  return json.response;
};

export const refreshNaverToken = async (refreshToken: string): Promise<NaverTokens> => {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: env('NAVER_CLIENT_ID'),
    client_secret: env('NAVER_CLIENT_SECRET'),
    refresh_token: refreshToken,
  });
  const res = await fetch(`${NAVER_TOKEN_URL}?${params.toString()}`, {
    method: 'GET',
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Naver token refresh failed (${res.status})`);
  }
  return (await res.json()) as NaverTokens;
};
