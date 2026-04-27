/** Slug must be lowercase alphanumerics, 6-12 chars. */
export const isValidSlug = (s: string) => /^[a-z0-9]{6,12}$/.test(s);

/** Postgres unique-violation error code. */
export const PG_UNIQUE_VIOLATION = '23505';
