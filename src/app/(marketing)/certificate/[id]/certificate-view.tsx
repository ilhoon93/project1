'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import { OrnamentCorner } from '@/components/certificate/OrnamentCorner';

interface Props {
  groomName: string;
  brideName: string;
  weddingDate: string | null;
  /** 모바일 알림장 절대 URL. null 이면 발행 안 된 알림장. */
  invitationUrl: string | null;
  /** 절대 URL 이 비어 있을 때 클라이언트가 origin 을 붙일 수 있도록 path 만 fallback 으로 받음. */
  invitationPath: string | null;
}

const VOWS: string[] = [
  '서로의 가장 가까운 친구가 되겠습니다.',
  '함께하는 매일을 소중히 여기겠습니다.',
  '서로의 길을 응원하며 같은 방향을 걷겠습니다.',
];

/**
 * 혼인서약서 — 마이페이지 진입, 작은 썸네일로 노출.
 *
 * 디자인:
 *   - 한글 "혼인서약서" 단일 제목
 *   - 4 모서리 + 외곽선 금색 웨딩 장식
 *   - 신랑·신부 이름이 청연체(가비아) 로 서명란에 자동 채움
 *   - 하단 가운데 QR (모바일 알림장 진입)
 *   - 스몰웨딩/노웨딩 톤 짧은 서약문 3줄
 *
 * 인쇄 격리:
 *   - body data-print="cert" 모드에서 .cert-print-target 외 모든 요소 숨김
 *   - 인쇄 시 A4 풀 사이즈로 출력
 */
export function CertificateView({
  groomName,
  brideName,
  weddingDate,
  invitationUrl,
  invitationPath,
}: Props) {
  const router = useRouter();
  const certRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  // QR 의 실제 값 — 서버가 NEXT_PUBLIC_BASE_URL 을 안 줬을 때 클라이언트의
  // window.location.origin 으로 fallback. mount 후 1회만 계산.
  const [qrValue, setQrValue] = useState<string | null>(invitationUrl);
  useEffect(() => {
    if (qrValue && qrValue.startsWith('http')) return;
    if (!invitationPath) return;
    if (typeof window === 'undefined') return;
    setQrValue(`${window.location.origin}${invitationPath}`);
  }, [invitationPath, qrValue]);

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

  // 인쇄 시 사이트 chrome (탭바, 헤더, AutoLoginGate 등) 가 같이 출력되는 문제를
  // 막기 위해 body 에 data-printing 마커를 잠깐 붙여 다른 요소를 CSS 로 숨긴다.
  const handlePrint = () => {
    document.body.setAttribute('data-printing', 'cert');
    const cleanup = () => {
      document.body.removeAttribute('data-printing');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    // print 콜은 동기적으로 다이얼로그를 띄우므로 setAttribute 가 먼저 적용됨.
    requestAnimationFrame(() => window.print());
  };

  const dateText = weddingDate ? formatKoreanDate(weddingDate) : '';

  return (
    <div className="cert-shell min-h-screen bg-stone-100 px-4 py-6">
      {/* 액션 버튼 — 인쇄 시 숨김 */}
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

      {/* 썸네일 컨테이너 */}
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
            padding: '6.5cqw 7cqw',
            boxShadow: '0 12px 40px -8px rgba(0,0,0,0.18)',
            fontFamily:
              "'Noto Serif KR', 'Nanum Myeongjo', 'Hahmlet', 'Times New Roman', serif",
            color: '#0f0d0a',
            position: 'relative',
            containerType: 'inline-size',
          }}
        >
          {/* 금색 외곽선 */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: '4cqw',
              border: '0.5cqw solid transparent',
              borderImage:
                'linear-gradient(135deg, #B8941F 0%, #D4AF37 30%, #F4E4A6 50%, #D4AF37 70%, #A6841C 100%) 1',
              pointerEvents: 'none',
            }}
          />
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: '5.6cqw',
              border: '0.15cqw solid #D4AF37',
              opacity: 0.5,
              pointerEvents: 'none',
            }}
          />

          {/* 4 모서리 장식 — 외곽선 위쪽 점에 정확히 정렬 */}
          <CornerSlot pos="tl" />
          <CornerSlot pos="tr" />
          <CornerSlot pos="bl" />
          <CornerSlot pos="br" />

          <div
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              gap: '3.5cqw',
            }}
          >
            {/* 1) 제목 — 한글만 */}
            <header
              style={{
                textAlign: 'center',
                marginTop: '8cqw',
              }}
            >
              <h1
                style={{
                  fontSize: '7.5cqw',
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

            {/* 2) 신랑·신부 + 결혼식 날짜 */}
            <section
              style={{
                textAlign: 'center',
                fontSize: '3.2cqw',
                lineHeight: 1.7,
              }}
            >
              <p
                style={{
                  margin: 0,
                  marginBottom: '1.5cqw',
                  fontSize: '2.6cqw',
                  color: '#5c544a',
                  letterSpacing: '0.3em',
                  paddingLeft: '0.3em',
                }}
              >
                신랑 신부
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: '5.5cqw',
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                }}
              >
                {groomName}
                <span style={{ margin: '0 1em', opacity: 0.45 }}>·</span>
                {brideName}
              </p>
              {dateText && (
                <p
                  style={{
                    marginTop: '2cqw',
                    marginBottom: 0,
                    fontSize: '2.8cqw',
                    color: '#5c544a',
                    letterSpacing: '0.18em',
                  }}
                >
                  {dateText}
                </p>
              )}
            </section>

            {/* 3) 서약문 */}
            <section
              style={{
                flex: '1 1 auto',
                padding: '0 2cqw',
                fontSize: '3cqw',
                lineHeight: 2,
                textAlign: 'center',
              }}
            >
              <p style={{ margin: 0, marginBottom: '3cqw' }}>
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
                  gap: '1.5cqw',
                  textAlign: 'center',
                  fontSize: '2.9cqw',
                }}
              >
                {VOWS.map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            </section>

            {/* 4) 서명란 — 청연체 자동 채움 (자필 라벨 제거) */}
            <footer
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '4cqw',
                padding: '0 2cqw',
              }}
            >
              <ScriptSign label="신 랑" name={groomName} />
              <ScriptSign label="신 부" name={brideName} />
            </footer>

            {/* 5) 하단 QR — 모바일 알림장 */}
            {qrValue && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '1cqw',
                  marginTop: '0.5cqw',
                }}
              >
                <div
                  style={{
                    padding: '1cqw',
                    background: '#fff',
                    border: '0.15cqw solid #D4AF37',
                  }}
                >
                  <div style={{ width: '12cqw', height: '12cqw' }}>
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
                    fontSize: '2.2cqw',
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

      {/* 인쇄 CSS — body[data-printing="cert"] 일 때 cert-print-target 만 보이게.
          A4 풀 사이즈, 단일 페이지, 다른 chrome 모두 숨김. */}
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

function CornerSlot({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const style: React.CSSProperties = { position: 'absolute' };
  // 외곽선 inset 4cqw 안쪽으로 살짝 들어가도록 3.2cqw 배치.
  if (pos === 'tl') {
    style.top = '3.2cqw';
    style.left = '3.2cqw';
  } else if (pos === 'tr') {
    style.top = '3.2cqw';
    style.right = '3.2cqw';
  } else if (pos === 'bl') {
    style.bottom = '3.2cqw';
    style.left = '3.2cqw';
  } else {
    style.bottom = '3.2cqw';
    style.right = '3.2cqw';
  }
  return (
    <div style={style}>
      <div style={{ width: '14cqw', height: '14cqw' }}>
        <OrnamentCorner position={pos} size={64} />
      </div>
    </div>
  );
}

function ScriptSign({ label, name }: { label: string; name: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1cqw',
      }}
    >
      <span
        style={{
          fontSize: '2.4cqw',
          letterSpacing: '0.3em',
          paddingLeft: '0.3em',
          color: '#5c544a',
        }}
      >
        {label}
      </span>
      {/* 가비아 청연체 — 우아한 한글 필기체 (root layout 에서 --font-gabia-cheongyeon 으로 로드) */}
      <span
        style={{
          fontFamily: "var(--font-gabia-cheongyeon), serif",
          fontSize: '7cqw',
          color: '#0f0d0a',
          lineHeight: 1.1,
        }}
      >
        {name}
      </span>
      <div
        style={{
          width: '70%',
          borderTop: '0.15cqw solid #0f0d0a',
          marginTop: '0.5cqw',
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
