/**
 * 환경변수 접근 헬퍼 — Next.js의 클라이언트 사이드 제한(Dynamic Indexing 불가)을 해결한 버전입니다.
 */

class MissingEnvError extends Error {
  constructor(public readonly key: string) {
    super(
      `환경변수 ${key} 가 설정되지 않았습니다. .env.local (로컬) 또는 배포 환경의 환경변수에 값을 추가해주세요.`,
    );
    this.name = 'MissingEnvError';
  }
}

/**
 * NEXT_PUBLIC_으로 시작하는 변수들은 여기에 수동으로 추가해야 브라우저에서 인식합니다.
 * Next.js는 빌드 시점에 process.env.NEXT_PUBLIC_... 코드를 실제 값으로 '글자 치환'하기 때문입니다.
 */
const getPublicEnv = (key: string): string | undefined => {
  switch (key) {
    case 'NEXT_PUBLIC_SUPABASE_URL':
      return process.env.NEXT_PUBLIC_SUPABASE_URL;
    case 'NEXT_PUBLIC_SUPABASE_ANON_KEY':
      return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    case 'NEXT_PUBLIC_BASE_URL':
      return process.env.NEXT_PUBLIC_BASE_URL;
    case 'NEXT_PUBLIC_PORTONE_STORE_ID':
      return process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
    case 'NEXT_PUBLIC_PORTONE_CHANNEL_KEY':
      return process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;
    default:
      return undefined;
  }
};

export const requireEnv = (key: string): string => {
  // 1. 먼저 NEXT_PUBLIC 변수인지 확인
  const publicValue = getPublicEnv(key);
  if (publicValue) return publicValue;

  // 2. 그 외(서버 전용) 변수들은 기존 방식대로 process.env에서 찾음
  const v = process.env[key];
  if (!v) throw new MissingEnvError(key);
  return v;
};

export const optionalEnv = (key: string): string | undefined => {
  const publicValue = getPublicEnv(key);
  if (publicValue) return publicValue;

  const v = process.env[key];
  return v && v.length > 0 ? v : undefined;
};

export const isMissingEnvError = (e: unknown): e is MissingEnvError =>
  e instanceof Error && e.name === 'MissingEnvError';
