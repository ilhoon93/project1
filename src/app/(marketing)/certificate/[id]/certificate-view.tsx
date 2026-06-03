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
  /**
   * 배포 환경의 절대 base URL (예: 'https://woori-daun.com').
   * 비어 있으면 클라이언트가 window.location.origin 을 폴백으로 사용.
   * QR 코드가 'localhost' 로 임베드되는 것을 막기 위해 우선 적용한다.
   */
  baseUrl: string;
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
 * 화면 ↔ 이미지 저장 ↔ PDF 일관성:
 *   - 화면: ResizeObserver 로 측정한 px 기반 인라인 스타일.
 *   - 이미지 저장: 위 DOM 을 html2canvas 로 그대로 캡처.
 *   - PDF: 같은 캔버스를 pdf-lib 로 A4 페이지에 임베드.
 *   브라우저 print 다이얼로그(@media print + visibility:hidden) 방식은
 *   모바일 Safari/Chrome 의 "PDF 로 저장" 흐름에서 헤더/버튼이 같이 캡처되고
 *   빈 2 페이지가 추가되는 문제가 있어 폐기. 캔버스 기반은 페이지 외부 요소가
 *   절대 들어갈 일이 없고 이미지 저장과 픽셀 단위로 동일한 결과를 보장.
 */
export function CertificateView({
  groomName,
  brideName,
  weddingDate,
  invitationPath,
  baseUrl,
}: Props) {
  const router = useRouter();
  const certRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(420);
  const [busy, setBusy] = useState<null | 'image' | 'pdf'>(null);
  const [qrValue, setQrValue] = useState<string | null>(null);

  // QR — 서버에서 내려온 baseUrl 이 있으면 우선 사용. localhost / 개발 IP 환경에서
  // window.location.origin 을 그대로 쓰면 하객이 QR 을 찍었을 때 접근 불가 URL
  // (localhost:3000 등) 로 연결되므로, 배포 origin 을 강제 우선시한다.
  useEffect(() => {
    if (!invitationPath || typeof window === 'undefined') return;
    const origin = baseUrl && baseUrl.length > 0 ? baseUrl : window.location.origin;
    setQrValue(`${origin}${invitationPath}`);
  }, [invitationPath, baseUrl]);

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

  /** 인쇄/저장용 캔버스를 만든다 — 이미지/PDF 양쪽이 공유. */
  const renderCanvas = async (): Promise<HTMLCanvasElement> => {
    const node = certRef.current;
    if (!node) throw new Error('cert node not ready');
    return await html2canvas(node, {
      backgroundColor: '#FFFCF7',
      scale: 2,
      useCORS: true,
      logging: false,
      // width/height/window* 옵션을 명시하면 일부 브라우저에서 캔버스가 잘못
      // 계산되어 콘텐츠가 좌상단에 치우치는 문제 발생. 기본값(요소 자체 크기)에
      // 맡기는 게 가장 안정적. scroll 도 0 으로 맞춰 오프셋 제거.
      scrollX: 0,
      scrollY: -window.scrollY,
    });
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // 사파리에서 즉시 revoke 하면 다운로드가 취소되는 케이스가 있어 약간 지연.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleSaveImage = async () => {
    if (busy) return;
    setBusy('image');
    try {
      const canvas = await renderCanvas();
      const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('canvas toBlob failed'))),
          'image/png',
        ),
      );
      triggerDownload(blob, `marriage-vow-${groomName}-${brideName}.png`);
    } catch (err) {
      console.error(err);
      alert('이미지 저장 중 오류가 발생했습니다.');
    } finally {
      setBusy(null);
    }
  };

  const handleSavePdf = async () => {
    if (busy) return;
    setBusy('pdf');
    try {
      const canvas = await renderCanvas();
      // pdf-lib 는 SSR/Node 모듈 로드를 피하려고 동적 import — 클라이언트 번들에
      // 포함되어 자동 코드 스플릿됨.
      const { PDFDocument } = await import('pdf-lib');
      const pdf = await PDFDocument.create();
      // A4 (210 × 297mm) — pdf-lib 단위는 pt (1mm = 2.83465pt).
      const A4_W = 595.28;
      const A4_H = 841.89;
      const page = pdf.addPage([A4_W, A4_H]);

      const pngBytes = await new Promise<Uint8Array>((resolve, reject) => {
        canvas.toBlob(async (blob) => {
          if (!blob) return reject(new Error('canvas toBlob failed'));
          const buf = await blob.arrayBuffer();
          resolve(new Uint8Array(buf));
        }, 'image/png');
      });
      const png = await pdf.embedPng(pngBytes);

      // 캔버스 종횡비를 유지한 채 A4 안에 'contain' 으로 맞춤.
      // 화면 cert 의 aspectRatio 가 210/297 이라 사실상 위/아래 여백 없이 꽉 참.
      const cw = png.width;
      const ch = png.height;
      const scale = Math.min(A4_W / cw, A4_H / ch);
      const drawW = cw * scale;
      const drawH = ch * scale;
      const x = (A4_W - drawW) / 2;
      const y = (A4_H - drawH) / 2;
      page.drawImage(png, { x, y, width: drawW, height: drawH });

      const bytes = await pdf.save();
      // pdf.save() 는 Uint8Array 를 반환 — Blob 으로 감싸 다운로드.
      // ArrayBuffer 뷰 (SharedArrayBuffer 가능성) 를 BlobPart 로 안전하게 전달하기
      // 위해 새 Uint8Array(bytes) 로 분리 복사 후 전달.
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
      triggerDownload(blob, `marriage-vow-${groomName}-${brideName}.pdf`);
    } catch (err) {
      console.error(err);
      alert('PDF 저장 중 오류가 발생했습니다.');
    } finally {
      setBusy(null);
    }
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
            disabled={busy !== null}
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-800 hover:bg-stone-50 disabled:opacity-50"
          >
            {busy === 'image' ? '저장 중...' : '이미지 저장'}
          </button>
          <button
            type="button"
            onClick={handleSavePdf}
            disabled={busy !== null}
            className="rounded-md bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-800 disabled:opacity-50"
          >
            {busy === 'pdf' ? '생성 중...' : 'PDF 저장'}
          </button>
        </div>
      </div>

      <div
        className="mx-auto"
        style={{ width: '100%', maxWidth: 'min(92vw, 420px)' }}
      >
        <article
          ref={certRef}
          id="cert-page"
          className="cert-page mx-auto"
          style={{
            width: '100%',
            // aspect-ratio CSS 는 html2canvas v1.4.x 가 측정 시점에 따라
            // height 를 0/auto 로 잘못 계산하는 케이스가 있어, 화면과 캡처
            // 결과의 비율이 어긋나는 문제 발생. 측정한 width 로부터 A4
            // 비율(297/210)에 맞는 height 를 직접 px 로 박아 해결.
            height: `${(w * 297) / 210}px`,
            padding: `${px(6.5)}px ${px(7)}px`,
            boxShadow: '0 12px 40px -8px rgba(0,0,0,0.18)',
            fontFamily:
              "'Noto Serif KR', 'Nanum Myeongjo', 'Hahmlet', 'Times New Roman', serif",
            color: '#1F1B17',
            backgroundColor: '#FFFCF7',
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
              border: `${Math.max(1, px(0.5))}px solid #B5614F`,
              pointerEvents: 'none',
            }}
          />
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: `${px(5.6)}px`,
              border: `1px solid #B5614F`,
              opacity: 0.25,
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
              {/* 브랜드 키커 — 메인/방명록과 통일감을 주는 코랄 영문 라벨 */}
              <p
                style={{
                  margin: 0,
                  marginBottom: `${px(2)}px`,
                  fontSize: `${px(2.4)}px`,
                  letterSpacing: '0.42em',
                  paddingLeft: '0.42em',
                  color: '#B5614F',
                  fontWeight: 600,
                }}
              >
                MARRIAGE VOW
              </p>
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
                  color: '#6E6862',
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
                    border: `1px solid #B5614F`,
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
                    color: '#6E6862',
                    letterSpacing: '0.25em',
                    paddingLeft: '0.25em',
                  }}
                >
                  모바일 알림장
                </span>
              </div>
            )}

            {/* 브랜드 워터마크 — 하단에 아주 옅게. 출처 표기·홍보용, 증서 느낌은
                해치지 않도록 중앙/대형이 아닌 하단 미니 텍스트 한 줄. */}
            <p
              style={{
                margin: 0,
                marginTop: `${px(1.5)}px`,
                textAlign: 'center',
                fontSize: `${px(1.9)}px`,
                letterSpacing: '0.22em',
                paddingLeft: '0.22em',
                color: '#6E6862',
                opacity: 0.5,
              }}
            >
              우리다운 · wooridaun.com
            </p>
          </div>
        </article>
      </div>
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
          color: '#6E6862',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-gabia-cheongyeon), serif",
          fontSize: `${px(7)}px`,
          color: '#1F1B17',
          lineHeight: 1.1,
        }}
      >
        {name}
      </span>
      <div
        style={{
          width: '70%',
          borderTop: '1px solid #1F1B17',
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
