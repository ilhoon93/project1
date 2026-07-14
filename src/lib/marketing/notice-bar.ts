/**
 * 홈(마케팅) 상단 공지바 설정 read/write. (서버 전용)
 *
 * 저장소: public.marketing_notice_bar (migration 057, 단일 행 id=true).
 * 권한: select 는 anon 포함 모두, 변경은 app_metadata.role='admin' 만 (RLS).
 * 기본 enabled=false — 관리자가 켜기 전까지 노출되지 않는다.
 */

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export interface NoticeBarConfig {
  enabled: boolean;
  message: string;
  linkUrl: string;
  linkLabel: string;
}

export const DEFAULT_NOTICE_BAR: NoticeBarConfig = {
  enabled: false,
  message: '',
  linkUrl: '',
  linkLabel: '',
};

const ConfigSchema = z.object({
  enabled: z.boolean().default(false),
  message: z.string().default(''),
  linkUrl: z.string().default(''),
  linkLabel: z.string().default(''),
});

export async function getNoticeBar(): Promise<NoticeBarConfig> {
  try {
    const supabase = createClient();
    // marketing_notice_bar 는 자동생성 DB 타입(057 미반영)에 아직 없어 캐스팅.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('marketing_notice_bar')
      .select('*')
      .eq('id', true)
      .maybeSingle();
    if (error || !data) return DEFAULT_NOTICE_BAR;
    const row = data as {
      enabled?: boolean;
      message?: string;
      link_url?: string;
      link_label?: string;
    };
    const parsed = ConfigSchema.safeParse({
      enabled: row.enabled ?? false,
      message: row.message ?? '',
      linkUrl: row.link_url ?? '',
      linkLabel: row.link_label ?? '',
    });
    if (!parsed.success) return DEFAULT_NOTICE_BAR;
    return parsed.data;
  } catch {
    return DEFAULT_NOTICE_BAR;
  }
}

export async function saveNoticeBar(
  config: NoticeBarConfig,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = ConfigSchema.safeParse(config);
  if (!parsed.success) return { ok: false, error: 'invalid config' };
  const supabase = createClient();
  const upsertRow = {
    id: true,
    enabled: parsed.data.enabled,
    message: parsed.data.message,
    link_url: parsed.data.linkUrl,
    link_label: parsed.data.linkLabel,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('marketing_notice_bar')
    .upsert(upsertRow, { onConflict: 'id' });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
