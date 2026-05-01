'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleLogout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      // Wipe the auto-logout heartbeat so we don't ride it into the next user.
      try {
        sessionStorage.removeItem('mw_session_active');
        localStorage.removeItem('mw_last_activity');
      } catch {
        // storage unavailable — ignore
      }
    } finally {
      router.refresh();
      router.push('/');
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={busy}
      className="text-xs text-[#5C4633] hover:text-[#3D2E1F] disabled:opacity-60"
    >
      {busy ? '로그아웃 중...' : '로그아웃'}
    </button>
  );
}
