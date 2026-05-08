'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';

interface Props {
  groomName: string;
  brideName: string;
  weddingDate: string | null;
  /** 모바일 알림장의 슬러그 path (예: '/abcdef'). origin 은 클라이언트가 붙임. */
  invitationPath: string | null;
}

const VOWS: string[] = [
  '서로의 가장 가까운 친구가 되겠습니다.',
  '함께하는 매일을 소중히 여기겠습니다.',
  '서로의 길을 응원하며 같은 방향을 걷겠습니다.',
];

/**
 * 혼인서약서 — 마이페이지 진입, 작은 썸네일 노출.
 *
 * 디자인:
 *   - 한글 "혼인서약서" 단일 제목
 *   - 단순 금색 외곽선 (모서리 장식 SVG 제거 — 위치 정렬 어려움)
 *   - 서약문 → 날짜 → 신랑/신부 서명 (청연체) → 하단 QR 순서
 *   - 중앙 신랑·신부 이름 큰 글씨 섹션 제거 (서명란이 그 역할)
 *
 * 화면 ↔ 이미지 저장 일관성:
 *   html2canvas 가 CSS Container Query 단위(cqw) 를 지원하지 않아
 *   스크린/캡처 결과가 어긋났던 문제를 해결하기 위해 박스 width 를 ResizeObserver
 *   로 측정 후 모든 사이즈를 px 기반 인라인 스타일로 적용.
 */
export function CertificateView({
  groomName,
  brideName,
  weddingDate,
  invitationPath,
}: Props) {
  const router = useRouter();
  const certRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(420);
  const [busy, setBusy] = useState(false);
  const [qrValue, setQrValue] = useState<string | null>(null);

  // QR — 마이페이지의 하객용 URL과 동일한 origin 사용 (서버에서 절대 URL 만들면
  // localhost 같은 잘못된 값이 들어갈 수 있어 클라이언트 window.location.origin 만 신뢰).
  useEffect(() => {
    if (!invitationPath || typeof window === 'undefined') return;
    setQrValue(`${window.location.origin}${invitationPath}`);
  }, [invitationPath]);

  // ResizeObserver — cert 박스 width 를 측정해 px 단위 스케일 기준값으로 사용.
  useLayoutEffect(() => {
    const node = certRef.current;
    if (!node) return;
    const update = () => {
      const cw = node.clientWidth;
      if (cw > 0) setW(cw);
    };
    update();
    const obs = new ResizeObserver(update);
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  /** 박스 width 의 N% 에 해당하는 px 값. cqw 와 동일한 의미. */
  const px = (cqw: number) => (cqw / 100) * w;

  const handleSaveImage = async () => {
    const node = certRef.current;
    if (!node || busy) return;
    setBusy(true);
    try {
      const canvas = await html2canvas(node, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
        // width/height 명시 — 측정한 박스 사이즈와 정확히 일치시켜 미리보기 = PNG.
        width: node.clientWidth,
        height: node.clientHeight,
        windowWidth: node.clientWidth,
        windowHeight: node.clientHeight,
      });
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `marriage-vow-${groomName}-${brideName}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      alert('이미지 저장 중 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handlePrint = () => {
    document.body.setAttribute('data-printing', 'cert');
    const cleanup = () => {
      document.body.removeAttribute('data-printing');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    requestAnimationFrame(() => window.print());
  };

  const dateText = weddingDate ? formatKoreanDate(weddingDate) : '';

  return (
    <div className="cert-shell min-h-screen bg-stone-100 px-4 py-6">
      {/* 액션 버튼 */}
      <div className="mx-auto mb-5 flex max-w-md items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-stone-600 hover:text-stone-900"
        >
          ← 뒤로
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveImage}
            disabled={busy}
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-800 hover:bg-stone-50 disabled:opacity-50"
          >
            {busy ? '저장 중...' : '이미지 저장'}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="rounded-md bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-800"
          >
            인쇄 / PDF
          </button>
        </div>
      </div>

      <div
        className="cert-print-target mx-auto"
        style={{ width: '100%', maxWidth: 'min(92vw, 420px)' }}
      >
        <article
          ref={certRef}
          id="cert-page"
          className="cert-page mx-auto bg-white"
          style={{
            width: '100%',
            aspectRatio: '210 / 297',
            padding: `${px(6.5)}px ${px(7)}px`,
            boxShadow: '0 12px 40px -8px rgba(0,0,0,0.18)',
            fontFamily:
              "'Noto Serif KR', 'Nanum Myeongjo', 'Hahmlet', 'Times New Roman', serif",
            color: '#0f0d0a',
            position: 'relative',
            // html2canvas 호환을 위해 box-sizing 명시.
            boxSizing: 'border-box',
          }}
        >
          {/* 단순 금색 외곽선 — 모서리 장식 SVG 삭제 (위치 정렬 이슈) */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: `${px(4)}px`,
              border: `${Math.max(1, px(0.5))}px solid #C9A227`,
              pointerEvents: 'none',
            }}
          />
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: `${px(5.6)}px`,
              border: `1px solid #D4AF37`,
              opacity: 0.4,
              pointerEvents: 'none',
            }}
          />

          <div
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              gap: `${px(3)}px`,
            }}
          >
            {/* 1) 제목 */}
            <header
              style={{
                textAlign: 'center',
                marginTop: `${px(7)}px`,
              }}
            >
              <h1
                style={{
                  fontSize: `${px(7.5)}px`,
                  letterSpacing: '0.4em',
                  paddingLeft: '0.4em',
                  fontWeight: 700,
                  margin: 0,
                  lineHeight: 1.1,
                }}
              >
                혼인서약서
              </h1>
            </header>

            {/* 2) 서약문 — 인사말 + 3 줄 약속 */}
            <section
              style={{
                flex: '1 1 auto',
                padding: `0 ${px(3)}px`,
                marginTop: `${px(4)}px`,
                fontSize: `${px(3.2)}px`,
                lineHeight: 2,
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              <p style={{ margin: 0, marginBottom: `${px(4)}px` }}>
                오늘부터 우리 두 사람은
                <br />
                서로의 일상이 되어 함께 살아갑니다.
              </p>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: `${px(1.5)}px`,
                  textAlign: 'center',
                  fontSize: `${px(3)}px`,
                }}
              >
                {VOWS.map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            </section>

            {/* 3) 날짜 — 서약문 다음 위치 */}
            {dateText && (
              <p
                style={{
                  margin: 0,
                  marginTop: `${px(2)}px`,
                  fontSize: `${px(3)}px`,
                  color: '#5c544a',
                  letterSpacing: '0.2em',
                  paddingLeft: '0.2em',
                  textAlign: 'center',
                }}
              >
                {dateText}
              </p>
            )}

            {/* 4) 서명란 — 신랑 / 신부 청연체 자동 채움 */}
            <footer
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: `${px(4)}px`,
                padding: `0 ${px(2)}px`,
                marginTop: `${px(2)}px`,
              }}
            >
              <ScriptSign label="신 랑" name={groomName} basePx={w} />
              <ScriptSign label="신 부" name={brideName} basePx={w} />
            </footer>

            {/* 5) 하단 QR — 마이페이지 하객용 URL */}
            {qrValue && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: `${px(1)}px`,
                  marginTop: `${px(0.5)}px`,
                }}
              >
                <div
                  style={{
                    padding: `${px(1)}px`,
                    background: '#fff',
                    border: `1px solid #D4AF37`,
                  }}
                >
                  <div
                    style={{
                      width: `${px(11)}px`,
                      height: `${px(11)}px`,
                    }}
                  >
                    <QRCodeSVG
                      value={qrValue}
                      size={48}
                      level="M"
                      marginSize={0}
                      style={{ width: '100%', height: '100%' }}
                    />
                  </div>
                </div>
                <span
                  style={{
                    fontSize: `${px(2.2)}px`,
                    color: '#5c544a',
                    letterSpacing: '0.25em',
                    paddingLeft: '0.25em',
                  }}
                >
                  모바일 알림장
                </span>
              </div>
            )}
          </div>
        </article>
      </div>

      {/* 인쇄 격리 + A4 풀 사이즈 출력 */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
        }
        body[data-printing='cert'] {
          background: #fff !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        body[data-printing='cert'] > *:not(.cert-shell) {
          display: none !important;
        }
        body[data-printing='cert'] .cert-shell {
          background: #fff !important;
          padding: 0 !important;
          margin: 0 !important;
          min-height: 0 !important;
        }
        body[data-printing='cert'] .cert-shell > *:not(.cert-print-target) {
          display: none !important;
        }
        body[data-printing='cert'] .cert-print-target {
          width: 210mm !important;
          max-width: 210mm !important;
          margin: 0 !important;
        }
        body[data-printing='cert'] .cert-page {
          width: 210mm !important;
          height: 297mm !important;
          box-shadow: none !important;
          page-break-after: avoid;
        }
      `}</style>
    </div>
  );
}

function ScriptSign({
  label,
  name,
  basePx,
}: {
  label: string;
  name: string;
  basePx: number;
}) {
  const px = (cqw: number) => (cqw / 100) * basePx;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: `${px(1)}px`,
      }}
    >
      <span
        style={{
          fontSize: `${px(2.4)}px`,
          letterSpacing: '0.3em',
          paddingLeft: '0.3em',
          color: '#5c544a',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-gabia-cheongyeon), serif",
          fontSize: `${px(7)}px`,
          color: '#0f0d0a',
          lineHeight: 1.1,
        }}
      >
        {name}
      </span>
      <div
        style={{
          width: '70%',
          borderTop: '1px solid #0f0d0a',
          marginTop: `${px(0.5)}px`,
        }}
      />
    </div>
  );
}

function formatKoreanDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}
