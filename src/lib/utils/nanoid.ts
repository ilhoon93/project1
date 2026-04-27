import { customAlphabet } from 'nanoid';

const URL_SAFE_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/** URL-safe slug generator. 8 chars ≈ 36^8 ≈ 2.8T values — collision-free for our scale. */
export const generateSlug = customAlphabet(URL_SAFE_ALPHABET, 8);

/** Short token for merchant_uid, file paths, etc. */
export { nanoid } from 'nanoid';
