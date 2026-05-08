import { customAlphabet } from 'nanoid';

const URL_SAFE_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/** URL-safe slug generator. 8 chars ≈ 36^8 ≈ 2.8T values — collision-free for our scale. */
export const generateSlug = customAlphabet(URL_SAFE_ALPHABET, 8);

/**
 * 신랑신부 전용 "소장용" URL 의 별도 태그 (slug 뒤에 붙는 토큰).
 * 추측 어렵게 16자로 잡음 — 36^16 ≈ 8 × 10^24, 사실상 충돌·추측 불가능.
 */
export const generateOwnerToken = customAlphabet(URL_SAFE_ALPHABET, 16);

/** Short token for merchant_uid, file paths, etc. */
export { nanoid } from 'nanoid';
