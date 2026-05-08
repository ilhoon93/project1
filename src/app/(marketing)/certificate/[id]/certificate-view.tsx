'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import { OrnamentCorner, OrnamentDivider } from '@/components/certificate/OrnamentCorner';

interface Props {
  groomName: string;
  brideName: string;
  weddingDate: string | null;
  /** 모바일 알림장 URL (QR 코드용). null 이면 발행 안 된 알림장 — QR 비표시. */
  invitationUrl: string | null;
}

// 스몰웨딩 / 노웨딩 톤 — 거창한 의식 대신 두 사람의 약속에 집중한 짧은 문구.
const VOWS: string[] = [
  '서로의 가장 가까운 친구가 되겠습니다.',
  '함께하는 매일을 소중히 여기겠습니다.',
  '서로의 길을 응원하며 같은 방향을 걷겠습니다.',
];

/**
 * 혼인서약서 — 마이페이지 버튼 클릭 시 진입. 화면에는 작은 썸네일 형태로 노출,
 * 사용자는 두 가지 저장 옵션 중 선택.
 *
 * 디자인:
 *   - 한자 제거 → 한글 "혼인서약서" 단일 제목
 *   - 4 모서리 + 상하 가운데 금색 웨딩 장식 (OrnamentCorner / OrnamentDivider)
 *   - 신랑·신부 서명란을 도장 대신 필기체(Nanum Pen Script) 자동 채움
 *   - QR 코드는 하단 가운데에 배치
 *   - 스몰웨딩/노웨딩 커플 톤의 짧은 서약문 3줄
 */
export function CertificateView({
  groomName,
  brideName,
  weddingDate,
  invitationUrl,
}: Props) {
  const router = useRouter();
  const certRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

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

  const handlePrint = () => {
    window.print();
  };

  const dateText = weddingDate ? formatKoreanDate(weddingDate) : '';

  return (
    <div className="min-h-screen bg-stone-100 px-4 py-6 print:bg-white print:px-0 print:py-0">
      {/* 액션 버튼 — 인쇄 시 숨김 */}
      <div className="mx-auto mb-5 flex max-w-md items-center justify-between gap-2 print:hidden">
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

      {/* 썸네일 컨테이너 — 작은 크기로 노출 (모바일: w-full 최대 360, 데스크톱: 420) */}
      <div className="mx-auto" style={{ width: '100%', maxWidth: 'min(92vw, 420px)' }}>
        <article
          ref={certRef}
          id="cert-page"
          className="cert-page mx-auto bg-white print:shadow-none"
          style={{
            width: '100%',
            aspectRatio: '210 / 297',
            // padding 은 CSS 픽셀 — A4 비율 박스 안에서 동일 비율 유지.
            // 인쇄 시 @page A4 와 매칭되도록 cqw 단위 사용.
            padding: '6.5cqw 7cqw',
            boxShadow: '0 12px 40px -8px rgba(0,0,0,0.18)',
            fontFamily:
              "'Noto Serif KR', 'Nanum Myeongjo', 'Hahmlet', 'Times New Roman', serif",
            color: '#0f0d0a',
            position: 'relative',
            containerType: 'inline-size',
          }}
        >
          {/* 금색 외곽선 + 4 모서리 장식 */}
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

          {/* 4 모서리 장식 */}
          <div style={{ position: 'absolute', top: '2.5cqw', left: '2.5cqw' }}>
            <CornerWrap position="tl" />
          </div>
          <div style={{ position: 'absolute', top: '2.5cqw', right: '2.5cqw' }}>
            <CornerWrap position="tr" />
          </div>
          <div style={{ position: 'absolute', bottom: '2.5cqw', left: '2.5cqw' }}>
            <CornerWrap position="bl" />
          </div>
          <div style={{ position: 'absolute', bottom: '2.5cqw', right: '2.5cqw' }}>
            <CornerWrap position="br" />
          </div>

          <div
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              gap: '3.5cqw',
            }}
          >
            {/* 1) 제목 — 한글만, 큰 명조체 */}
            <header
              style={{
                textAlign: 'center',
                marginTop: '8cqw',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2cqw',
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
              <div style={{ width: '32cqw' }}>
                <OrnamentDivider width={120} />
              </div>
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

            {/* 3) 서약문 — 짧은 3줄, 스몰웨딩/노웨딩 톤 */}
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

            {/* 4) 서명란 — 도장 대신 필기체 이름 자동 채움 */}
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

            {/* 5) 하단 QR 코드 — 모바일 알림장 진입 */}
            {invitationUrl && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '1cqw',
                  marginTop: '1cqw',
                }}
              >
                <div
                  style={{
                    padding: '1cqw',
                    background: '#fff',
                    border: '0.15cqw solid #D4AF37',
                  }}
                >
                  {/* qrcode.react SVG — 픽셀 단위로 받음, cqw 변환 위해 wrapper 사이즈 사용 */}
                  <div style={{ width: '12cqw', height: '12cqw' }}>
                    <QRCodeSVG
                      value={invitationUrl}
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

      {/* 인쇄용 CSS — A4 단일 페이지, 그림자/배경 제거. 인쇄 시엔 풀 사이즈로 출력 */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          html,
          body {
            background: #fff !important;
          }
          .cert-page {
            box-shadow: none !important;
            page-break-after: avoid;
            max-width: none !important;
            width: 210mm !important;
          }
        }
      `}</style>
    </div>
  );
}

function CornerWrap({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  return (
    <div style={{ width: '14cqw', height: '14cqw' }}>
      <OrnamentCorner position={position} size={64} />
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
      {/* 필기체 이름 — Nanum Pen Script (root layout 에서 로드됨, --font-nanum-pen) */}
      <span
        style={{
          fontFamily: "var(--font-nanum-pen), 'Nanum Pen Script', cursive",
          fontSize: '7cqw',
          color: '#0f0d0a',
          lineHeight: 1,
          marginTop: '0.5cqw',
        }}
      >
        {name}
      </span>
      <div
        style={{
          width: '70%',
          borderTop: '0.15cqw solid #0f0d0a',
          marginTop: '0.5cqw',
          paddingTop: '0.7cqw',
          fontSize: '2cqw',
          color: '#8a8478',
          textAlign: 'center',
        }}
      >
        (자필 서명)
      </div>
    </div>
  );
}

function formatKoreanDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}
