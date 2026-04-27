'use client';

import { useEffect } from 'react';
import { readGuestIdentity } from './SignatureGate';

interface Props {
  invitationId: string;
  /** Suppress tracking in author preview mode. */
  disabled?: boolean;
}

const SESSION_KEY = (id: string) => `wedding-visit:${id}`;

/**
 * Fires a visit POST once per browser session. We deliberately don't
 * log every page load — sessionStorage de-dupes within a tab session,
 * and the public invitation tends to be loaded once and swiped through.
 */
export function VisitTracker({ invitationId, disabled }: Props) {
  useEffect(() => {
    if (disabled) return;
    if (typeof window === 'undefined') return;

    if (window.sessionStorage.getItem(SESSION_KEY(invitationId))) return;

    const identity = readGuestIdentity(invitationId);
    const deviceType =
      typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 768px)').matches
        ? 'mobile'
        : 'desktop';

    fetch('/api/guest/visit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        invitationId,
        visitorName: identity.name ?? undefined,
        visitorSide: identity.side ?? undefined,
        deviceType,
      }),
      keepalive: true,
    })
      .then(() => {
        window.sessionStorage.setItem(SESSION_KEY(invitationId), '1');
      })
      .catch(() => {
        // ignore — telemetry should never break the experience
      });
  }, [invitationId, disabled]);

  return null;
}
