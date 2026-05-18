/**
 * 스냅 동의 관리.
 *
 * 동의 버전 (CURRENT_VERSION) 은 약관 본문이 의미 있게 바뀔 때마다 증가.
 * 사용자가 갖고 있는 동의의 version < CURRENT_VERSION 이면 재동의 요청.
 *
 * 필수 scope:
 *   - personal_info  : 얼굴 등 PII 처리 (저장/분석/처리)
 *   - ai_generation  : AI 합성 (제 3자 fal.ai 처리 포함)
 * 선택 scope:
 *   - external_share : 외부 채널 배포 (SNS, 마켓플레이스 등). 향후 사용.
 */

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * 현재 약관 버전. 약관 본문 변경 시 +1.
 * 다음 변경 시:
 *   1) /terms 페이지 본문 갱신
 *   2) 이 상수 +1
 *   3) 사용자는 다음 생성 시도 시 재동의 모달 자동 노출
 */
export const SNAP_CONSENT_VERSION = 1;

export type ConsentScope = 'personal_info' | 'ai_generation' | 'external_share';

export interface ConsentAcceptInput {
  userId: string;
  scopes: ConsentScope[];
  userAgent?: string | null;
  ipAddress?: string | null;
}

/**
 * 사용자가 필수 동의를 만족하는지 확인. 서버 측에서 snap 생성 요청 전 호출.
 *
 * @returns true = 진행 OK, false = 재동의 필요 (사용자에게 동의 UI 노출)
 */
export async function hasRequiredConsent(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('snap_has_required_consent', {
    p_user_id: userId,
    p_version: SNAP_CONSENT_VERSION,
  });
  if (error) {
    console.warn('[consent] check failed', error);
    return false; // 보수적: 확인 실패 시 차단.
  }
  return data === true;
}

/**
 * 동의 행 기록. 각 scope 별 row 1 개. service role 로 INSERT (RLS bypass).
 */
export async function acceptConsent(input: ConsentAcceptInput): Promise<void> {
  if (input.scopes.length === 0) return;
  const admin = createAdminClient();
  const rows = input.scopes.map((scope) => ({
    user_id: input.userId,
    scope,
    version: SNAP_CONSENT_VERSION,
    accepted: true,
    user_agent: input.userAgent ?? null,
    ip_address: input.ipAddress ?? null,
  }));
  const { error } = await admin.from('snap_consent').insert(rows);
  if (error) {
    throw new Error(`consent insert failed: ${error.message}`);
  }
}
