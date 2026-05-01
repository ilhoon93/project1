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
 *
 * On any unexpected error the route ALWAYS redirects back to /login
 * with an `error=` code instead of returning a raw 500 — that way the
 * user lands on a meaningful page and the button can reset its state.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');
  const errorDesc = url.searchParams.get('error_description');

  const stateCookie = request.cookies.get(STATE_COOKIE)?.value ?? null;
  const nextRaw = request.cookies.get(NEXT_COOKIE)?.value ?? '/mypage';
  const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/mypage';

  const failRedirect = (msg: string, log?: unknown) => {
    if (log !== undefined) console.error(`[naver/callback] ${msg}`, log);
    const u = new URL('/login', url.origin);
    u.searchParams.set('error', msg);
    const res = NextResponse.redirect(u);
    res.cookies.delete(STATE_COOKIE);
    res.cookies.delete(NEXT_COOKIE);
    return res;
  };

  // Guard: server-level config must be in place; otherwise we'd hit a
  // confusing 500 deep in the SDK call.
  if (!process.env.NAVER_CLIENT_ID || !process.env.NAVER_CLIENT_SECRET) {
    return failRedirect('naver_not_configured');
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return failRedirect('supabase_not_configured');
  }

  if (errorDesc) return failRedirect(`naver_${errorDesc}`);
  if (!code || !stateParam) return failRedirect('missing_code_or_state');
  if (!stateCookie || stateCookie !== stateParam) return failRedirect('state_mismatch');

  // Wrap the entire dance so any unexpected throw still produces a friendly redirect.
  try {
    const tokens = await exchangeNaverCode(code, stateParam);
    const profile = await fetchNaverProfile(tokens.access_token);
    if (!profile.id) return failRedirect('missing_naver_id');

    const admin = createAdminClient();
    const supabase = createClient();

    // (a) caller already authenticated → just link
    const {
      data: { user: existingUser },
    } = await supabase.auth.getUser();

    let userId = existingUser?.id ?? null;

    // (b) anonymous → resolve or create the matching Supabase user
    if (!userId) {
      const { data: link } = await admin
        .from('naver_accounts')
        .select('user_id')
        .eq('naver_id', profile.id)
        .maybeSingle();

      if (link?.user_id) {
        userId = link.user_id;
      } else {
        // Email may be missing if the user denied the email scope.
        // Use a stable pseudo-email so we can still create the account.
        const emailToUse =
          profile.email ?? `naver_${profile.id}@users.minimum-wedding.local`;

        // Try createUser first; if email conflict, fall back to listUsers.
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email: emailToUse,
          email_confirm: true,
          user_metadata: {
            name: profile.name ?? profile.nickname ?? '',
            provider: 'naver',
            naver_id: profile.id,
          },
        });

        if (created?.user) {
          userId = created.user.id;
        } else if (createErr) {
          // 422 / email exists path — find the existing user (paginated listUsers).
          const found = await findUserByEmail(admin, emailToUse);
          if (found) {
            userId = found;
          } else {
            return failRedirect('user_create_failed', createErr);
          }
        }
      }
    }

    if (!userId) return failRedirect('no_user');

    // Persist Naver tokens / profile (service-role bypass of RLS).
    const expiresAt = new Date(Date.now() + Number(tokens.expires_in) * 1000).toISOString();
    const { error: upsertErr } = await admin
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
    if (upsertErr) console.error('[naver/callback] naver_accounts upsert failed', upsertErr);

    // If the caller wasn't already logged-in, mint a session via magic-link bridge.
    if (!existingUser) {
      const { data: userRow } = await admin.auth.admin.getUserById(userId);
      const email = userRow?.user?.email;
      if (!email) return failRedirect('no_email_for_session');

      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo: `${url.origin}${next}` },
      });
      if (linkErr || !linkData?.properties?.hashed_token) {
        return failRedirect('generate_link_failed', linkErr);
      }

      const { error: verifyErr } = await supabase.auth.verifyOtp({
        type: 'magiclink',
        token_hash: linkData.properties.hashed_token,
      });
      if (verifyErr) return failRedirect('verify_otp_failed', verifyErr);
    }

    const res = NextResponse.redirect(new URL(next, url.origin));
    res.cookies.delete(STATE_COOKIE);
    res.cookies.delete(NEXT_COOKIE);
    return res;
  } catch (e) {
    return failRedirect('naver_unexpected', e);
  }
}

/**
 * Find a Supabase auth user by email. listUsers is paginated (default 50/page),
 * so we walk pages until we find a match or run out — adequate for the MVP scale,
 * worth swapping for a server-side RPC at production volume.
 */
async function findUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  maxPages = 20,
): Promise<string | null> {
  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error || !data?.users?.length) return null;
    const found = data.users.find((u) => u.email === email);
    if (found) return found.id;
    if (data.users.length < 100) return null; // last page
  }
  return null;
}
