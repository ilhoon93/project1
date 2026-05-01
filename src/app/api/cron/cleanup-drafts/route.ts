import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { UNPUBLISHED_DRAFT_TTL_DAYS } from '@/lib/limits';

/**
 * GET /api/cron/cleanup-drafts
 *
 * Triggers cleanup_stale_drafts() — deletes any unpublished invitation
 * that hasn't been touched in 14 days.
 *
 * Auth model:
 *   - Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically
 *     when configured via vercel.json + a CRON_SECRET env var
 *   - Manual call also accepted via the same header
 *   - If CRON_SECRET is not set, the route is wide open *only in
 *     development* — production will refuse without it
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET ?? null;
  const auth = request.headers.get('authorization') ?? '';

  if (cronSecret) {
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('cleanup_stale_drafts', {
    ttl_days: UNPUBLISHED_DRAFT_TTL_DAYS,
  });

  if (error) {
    console.error('[cron/cleanup-drafts] failed', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    deleted: typeof data === 'number' ? data : 0,
    ttlDays: UNPUBLISHED_DRAFT_TTL_DAYS,
  });
}
