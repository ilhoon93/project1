/**
 * 환경변수 접근 헬퍼 — 누락 시 명확한 메시지로 throw 한다.
 *
 *   - 빌드 시점에는 검사하지 않으므로 키 없이도 `next build` 가능 (CI에서
 *     테스트 / 스모크 빌드를 안전하게 돌릴 수 있다).
 *   - 런타임 호출 시점에 누락이 감지되면 깨진 SDK 콜 대신 사람-읽기 좋은
 *     에러를 던져 디버깅이 쉽다.
 *   - 클라이언트 번들에는 NEXT_PUBLIC_* 만 포함되며 이 모듈은 사용 시점에
 *     평가되므로 서버 전용 키를 클라이언트로 끌고 가지 않는다.
 */

class MissingEnvError extends Error {
  constructor(public readonly key: string) {
    super(
      `환경변수 ${key} 가 설정되지 않았습니다. .env.local (로컬) 또는 배포 환경의 환경변수에 값을 추가해주세요.`,
    );
    this.name = 'MissingEnvError';
  }
}

export const requireEnv = (key: string): string => {
  const v = process.env[key];
  if (!v) throw new MissingEnvError(key);
  return v;
};

export const optionalEnv = (key: string): string | undefined => {
  const v = process.env[key];
  return v && v.length > 0 ? v : undefined;
};

export const isMissingEnvError = (e: unknown): e is MissingEnvError =>
  e instanceof Error && e.name === 'MissingEnvError';
