'use client';

/**
 * Identity helpers for guests.
 *
 * The legacy "입장하기 → signature popup" gate has been removed; visitors now
 * leave their signature alongside their guestbook message. This file is kept
 * as the single source of truth for the localStorage identity record so that
 * VisitTracker / Quiz / Vote keep working without each owning their own key.
 */

interface StoredIdentity {
  name: string | null;
  side: 'groom' | 'bride' | null;
}

const storageKey = (id: string) => `wedding-guest:${id}`;

export function readGuestIdentity(invitationId: string): StoredIdentity {
  if (typeof window === 'undefined') return { name: null, side: null };
  const raw = window.localStorage.getItem(storageKey(invitationId));
  if (!raw) return { name: null, side: null };
  try {
    return JSON.parse(raw) as StoredIdentity;
  } catch {
    return { name: null, side: null };
  }
}

export function persistGuestIdentity(invitationId: string, identity: StoredIdentity) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey(invitationId), JSON.stringify(identity));
}
