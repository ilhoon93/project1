import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function EditorLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Editor 진입 시 로그인 후 홈으로 — 자동으로 다른 알림장 편집을 시작하지
    // 않게 한다.
    redirect('/login?next=/');
  }

  return <>{children}</>;
}
