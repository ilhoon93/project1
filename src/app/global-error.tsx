'use client';

import { useEffect } from 'react';

/**
 * Catches errors that escape the root layout itself. Must render <html>/<body>
 * because the root layout failed to render.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app/global-error]', error);
  }, [error]);

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#FAF7F2',
          color: '#3D2E1F',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          padding: '24px',
        }}
      >
        <div>
          <p style={{ fontSize: 12, letterSpacing: '0.3em', color: '#8B7355' }}>
            FATAL ERROR
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 600, marginTop: 8 }}>
            앱 전체에 문제가 발생했습니다
          </h1>
          <p style={{ marginTop: 16, color: '#5C4633', fontSize: 14 }}>
            잠시 후 다시 시도해주세요.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 16,
              height: 40,
              padding: '0 20px',
              backgroundColor: '#8B7355',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            새로고침
          </button>
        </div>
      </body>
    </html>
  );
}
