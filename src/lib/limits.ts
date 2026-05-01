/**
 * Per-user limits + retention policy.
 * Single source of truth — UI, API, and SQL cleanup all reference these.
 */

/** 사용자 1인당 동시에 보유할 수 있는 알림장 최대 개수. */
export const MAX_INVITATIONS_PER_USER = 10;

/**
 * 미발행 상태로 마지막 수정 후 N일이 지나면 자동 삭제 대상.
 * SQL cleanup 함수와 동일한 값을 유지해야 한다.
 */
export const UNPUBLISHED_DRAFT_TTL_DAYS = 14;

/** 발행 후 공개 URL이 유효한 기간(일). publish_invitation_v2 RPC와 동일. */
export const PUBLICATION_TTL_DAYS = 30;
