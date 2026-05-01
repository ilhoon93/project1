import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { exchangeNaverCode, fetchNaverProfile } from '@/lib/naver/oauth';

const STATE_COOKIE = 'naver_oauth_state';
const NEXT_COOKIE = 'naver_oauth_next';

/**
 * GET /api/auth/naver/callback?code=…&state=…
 *
 *   1. CSRF: state cookie must match.
 *   2. Exchange code → Naver tokens.
 *   3. Fetch Naver profile (id, email, nickname).
 *   4. Either:
 *        a) caller already has a Supabase session → just link
 *           the Naver account to that user (no new account needed).
 *        b) anonymous → upsert auth.users keyed by Naver email,
 *           and sign them in by minting a magic-link action_link
 *           and exchanging it on the server. The browser then
 *           lands at `next` with cookies set.
 *   5. Persist tokens to public.naver_accounts so /mypage can
 *      pull Smart Store orders via the Commerce API.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');
  const errorDesc = url.searchParams.get('error_description');

  const stateCookie = request.cookies.get(STATE_COOKIE)?.value ?? null;
  const nextRaw = request.cookies.get(NEXT_COOKIE)?.value ?? '/mypage';
  const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/mypage';

  const failRedirect = (msg: string) => {
    const u = new URL('/login', url.origin);
    u.searchParams.set('error', msg);
    const res = NextResponse.redirect(u);
    res.cookies.delete(STATE_COOKIE);
    res.cookies.delete(NEXT_COOKIE);
    return res;
  };

  if (errorDesc) return failRedirect(errorDesc);
  if (!code || !stateParam) return failRedirect('missing_code_or_state');
  if (!stateCookie || stateCookie !== stateParam) return failRedirect('state_mismatch');

  let tokens;
  let profile;
  try {
    tokens = await exchangeNaverCode(code, stateParam);
    profile = await fetchNaverProfile(tokens.access_token);
  } catch (e) {
    console.error('[naver/callback] exchange failed', e);
    return failRedirect('naver_exchange_failed');
  }

  if (!profile.id) return failRedirect('missing_naver_id');

  const admin = createAdminClient();
  const supabase = createClient();

  // (a) caller already authenticated → just link
  const {
    data: { user: existingUser },
  } = await supabase.auth.getUser();

  let userId = existingUser?.id ?? null;

  // (b) anonymous → upsert a Supabase user
  if (!userId) {
    // Try to find an existing naver_accounts row first (returning user)
    const { data: link } = await admin
      .from('naver_accounts')
      .select('user_id')
      .eq('naver_id', profile.id)
      .maybeSingle();

    if (link?.user_id) {
      userId = link.user_id;
    } else if (profile.email) {
      // Match-or-create by email so a user who logged in with Kakao
      // before keeps the same auth.users row.
      const { data: list } = await admin.auth.admin.listUsers();
      const found = list?.users.find((u) => u.email === profile.email);
      if (found) {
        userId = found.id;
      } else {
        const { data: created, error } = await admin.auth.admin.createUser({
          email: profile.email,
          email_confirm: true,
          user_metadata: {
            name: profile.name ?? profile.nickname ?? '',
            provider: 'naver',
            naver_id: profile.id,
          },
        });
        if (error || !created.user) {
          console.error('[naver/callback] createUser failed', error);
          return failRedirect('user_create_failed');
        }
        userId = created.user.id;
      }
    } else {
      // No email scope granted — fabricate a stable pseudo-email so
      // we can still create the account; user can backfill later.
      const pseudoEmail = `naver_${profile.id}@users.minimum-wedding.local`;
      const { data: list } = await admin.auth.admin.listUsers();
      const found = list?.users.find((u) => u.email === pseudoEmail);
      if (found) {
        userId = found.id;
      } else {
        const { data: created, error } = await admin.auth.admin.createUser({
          email: pseudoEmail,
          email_confirm: true,
          user_metadata: { provider: 'naver', naver_id: profile.id },
        });
        if (error || !created.user) {
          console.error('[naver/callback] createUser (pseudo) failed', error);
          return failRedirect('user_create_failed');
        }
        userId = created.user.id;
      }
    }
  }

  if (!userId) return failRedirect('no_user');

  // Persist Naver tokens / profile
  const expiresAt = new Date(Date.now() + Number(tokens.expires_in) * 1000).toISOString();
  await admin
    .from('naver_accounts')
    .upsert(
      {
        user_id: userId,
        naver_id: profile.id,
        email: profile.email ?? null,
        nickname: profile.nickname ?? profile.name ?? null,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        token_expires_at: expiresAt,
        scope: tokens.scope ?? null,
        raw_profile: profile as never,
      },
      { onConflict: 'user_id' },
    );

  // If the caller wasn't already logged-in, mint a session.
  if (!existingUser) {
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: (await admin.auth.admin.getUserById(userId)).data.user?.email ?? '',
      options: { redirectTo: `${url.origin}${next}` },
    });
    if (linkErr || !link?.properties?.hashed_token) {
      console.error('[naver/callback] generateLink failed', linkErr);
      return failRedirect('session_failed');
    }

    // Exchange the OTP token for a Supabase session, server-side.
    const verify = await supabase.auth.verifyOtp({
      type: 'magiclink',
      token_hash: link.properties.hashed_token,
    });
    if (verify.error) {
      console.error('[naver/callback] verifyOtp failed', verify.error);
      return failRedirect('session_failed');
    }
  }

  const res = NextResponse.redirect(new URL(next, url.origin));
  res.cookies.delete(STATE_COOKIE);
  res.cookies.delete(NEXT_COOKIE);
  return res;
}
