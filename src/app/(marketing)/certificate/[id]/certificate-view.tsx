'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import { NameStamp } from '@/components/certificate/NameStamp';

interface Props {
  groomName: string;
  brideName: string;
  weddingDate: string | null;
  /** 모바일 알림장 URL (QR 코드용). null 이면 발행 안 된 알림장 — QR 비표시. */
  invitationUrl: string | null;
}

const VOWS: string[] = [
  '하나, 우리는 서로를 깊이 존중하며 서로의 꿈과 길을 응원하겠습니다.',
  '둘, 기쁠 때나 어려울 때나 같은 방향을 함께 바라보며 걷겠습니다.',
  '셋, 우리 둘만의 작은 약속을 잊지 않고 평생 따뜻한 마음으로 함께하겠습니다.',
];

/**
 * 혼인서약서 클라이언트 뷰 — 한 페이지짜리 정적 디자인 + 두 가지 저장 옵션.
 *
 *   1. 이미지로 저장 — html2canvas 로 #cert-page 영역을 PNG 캡처
 *   2. 인쇄 / PDF 저장 — window.print() (브라우저 인쇄 다이얼로그에서 PDF 저장 선택)
 *
 * 디자인 톤:
 *   - 모던 + 격식 — 한자 큰 제목 + 한글 부제 + 이중 외곽선 + 명조체
 *   - 빨간 인주색 도장 (NameStamp) 으로 신랑·신부 서명 자리 강조
 *   - 우상단 QR — 모바일 알림장으로 바로 진입
 *   - 인쇄 시 A4 단일 페이지 (@media print 로 버튼 숨김)
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
    <div className="min-h-screen bg-stone-100 px-4 py-8 print:bg-white print:px-0 print:py-0">
      {/* 액션 버튼 — 인쇄 시 숨김 */}
      <div className="mx-auto mb-6 flex max-w-3xl items-center justify-between gap-2 print:hidden">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-stone-600 hover:text-stone-900"
        >
          ← 마이페이지
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveImage}
            disabled={busy}
            className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50 disabled:opacity-50"
          >
            {busy ? '저장 중...' : '이미지로 저장'}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
          >
            인쇄 / PDF 저장
          </button>
        </div>
      </div>

      {/* 서약서 본문 — A4 비율 (210 × 297mm) */}
      <article
        ref={certRef}
        id="cert-page"
        className="cert-page mx-auto bg-white print:shadow-none"
        style={{
          width: 'min(100%, 210mm)',
          aspectRatio: '210 / 297',
          padding: '14mm 16mm',
          boxShadow: '0 12px 40px -8px rgba(0,0,0,0.18)',
          fontFamily:
            "'Noto Serif KR', 'Nanum Myeongjo', 'Hahmlet', 'Times New Roman', serif",
          color: '#0f0d0a',
          position: 'relative',
        }}
      >
        {/* 이중 외곽선 — 격식 강조 */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: '6mm',
            border: '0.7mm solid #0f0d0a',
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: '8mm',
            border: '0.2mm solid #0f0d0a',
          }}
        />

        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            paddingTop: '4mm',
          }}
        >
          {/* 1) 우상단 QR — 모바일 알림장 진입 */}
          {invitationUrl && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1.5mm',
              }}
            >
              <div
                style={{
                  padding: '1.5mm',
                  border: '0.3mm solid #0f0d0a',
                  background: '#fff',
                }}
              >
                <QRCodeSVG
                  value={invitationUrl}
                  size={68}
                  level="M"
                  marginSize={0}
                />
              </div>
              <span
                style={{
                  fontSize: '7pt',
                  color: '#5c544a',
                  letterSpacing: '0.06em',
                  whiteSpace: 'nowrap',
                }}
              >
                모바일 알림장
              </span>
            </div>
          )}

          {/* 2) 한자 제목 — 큰 격식 톤 */}
          <header
            style={{
              textAlign: 'center',
              marginTop: '12mm',
            }}
          >
            <h1
              style={{
                fontSize: '36pt',
                letterSpacing: '0.5em',
                paddingLeft: '0.5em', // letter-spacing 보정 (가운데 정렬용)
                fontWeight: 700,
                margin: 0,
              }}
            >
              婚姻誓約書
            </h1>
            <p
              style={{
                marginTop: '4mm',
                fontSize: '11pt',
                letterSpacing: '0.5em',
                paddingLeft: '0.5em',
                color: '#5c544a',
              }}
            >
              혼 인 서 약 서
            </p>
          </header>

          {/* 3) 신랑·신부 + 날짜 */}
          <section
            style={{
              textAlign: 'center',
              marginTop: '14mm',
              fontSize: '13pt',
              lineHeight: 1.8,
            }}
          >
            <p style={{ margin: 0, fontSize: '10pt', color: '#5c544a' }}>
              신랑 신부
            </p>
            <p
              style={{
                marginTop: '2mm',
                marginBottom: 0,
                fontSize: '20pt',
                fontWeight: 600,
                letterSpacing: '0.1em',
              }}
            >
              {groomName}
              <span style={{ margin: '0 1.2em', opacity: 0.5 }}>·</span>
              {brideName}
            </p>
            {dateText && (
              <p
                style={{
                  marginTop: '4mm',
                  marginBottom: 0,
                  fontSize: '11pt',
                  color: '#5c544a',
                  letterSpacing: '0.15em',
                }}
              >
                {dateText}
              </p>
            )}
          </section>

          {/* 4) 본문 (서약문) */}
          <section
            style={{
              flex: '1 1 auto',
              marginTop: '12mm',
              padding: '0 6mm',
              fontSize: '11pt',
              lineHeight: 2,
              textAlign: 'center',
            }}
          >
            <p style={{ margin: 0, marginBottom: '6mm' }}>
              오늘, 우리 두 사람은 양가 부모님과 친지 여러분 앞에서
              <br />
              한 평생 서로의 곁에서 함께하기로 다음과 같이 약속합니다.
            </p>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '3mm',
                textAlign: 'left',
                maxWidth: '140mm',
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            >
              {VOWS.map((v, i) => (
                <li key={i} style={{ paddingLeft: '0.6em', textIndent: '-0.6em' }}>
                  {v}
                </li>
              ))}
            </ul>
          </section>

          {/* 5) 서명란 — 도장 + 이름 + 서명 라인 */}
          <footer
            style={{
              marginTop: '8mm',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '14mm',
              padding: '0 4mm',
            }}
          >
            <SignBlock label="신 랑" name={groomName} />
            <SignBlock label="신 부" name={brideName} />
          </footer>
        </div>
      </article>

      {/* 인쇄용 CSS — A4 단일 페이지, 그림자/배경 제거 */}
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
          }
        }
      `}</style>
    </div>
  );
}

function SignBlock({ label, name }: { label: string; name: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '3mm',
      }}
    >
      <span
        style={{
          fontSize: '9pt',
          letterSpacing: '0.4em',
          color: '#5c544a',
        }}
      >
        {label}
      </span>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6mm',
        }}
      >
        <span
          style={{
            fontSize: '15pt',
            fontWeight: 600,
            letterSpacing: '0.08em',
          }}
        >
          {name}
        </span>
        <NameStamp name={name} size={68} />
      </div>
      <div
        style={{
          width: '60%',
          borderTop: '0.3mm solid #0f0d0a',
          marginTop: '2mm',
          paddingTop: '1.5mm',
          fontSize: '8pt',
          color: '#5c544a',
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
