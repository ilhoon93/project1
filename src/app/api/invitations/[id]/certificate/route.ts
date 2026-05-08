import { NextResponse } from 'next/server';
import { PDFDocument, rgb, type PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/invitations/{id}/certificate
 *
 * 발행된 알림장(공개 URL 발행 이력이 있어야 함) 의 정보를 바탕으로
 * 혼인서약서 PDF 1 장을 생성해 반환한다.
 *
 * 디자인은 일단 단순한 한 장짜리 (테두리 + 한글 본문 + 서명란). 사용자가 추후
 * 디자인 요청을 줄 예정이라 minimal-acceptable 수준으로 작성.
 *
 * 한글 폰트는 Google Fonts 의 Noto Serif KR (TTF) 를 런타임에 fetch + 임베드.
 * fonts URL 은 변하지 않는 jsDelivr CDN 경로를 사용.
 */

export const maxDuration = 30;

// jsDelivr 의 google-fonts mirror — 안정적인 raw TTF 경로.
const KOREAN_FONT_URL =
  'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notoserifkr/NotoSerifKR%5Bwght%5D.ttf';

let cachedFontBytes: Uint8Array | null = null;

async function loadKoreanFont(): Promise<Uint8Array> {
  if (cachedFontBytes) return cachedFontBytes;
  const res = await fetch(KOREAN_FONT_URL);
  if (!res.ok) throw new Error(`korean font fetch failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  cachedFontBytes = new Uint8Array(buf);
  return cachedFontBytes;
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const invitationId = params.id;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 1) 알림장 + 발행 이력 조회.
  const { data: inv, error: invErr } = await supabase
    .from('invitations')
    .select('id, groom_name, bride_name, wedding_date, is_published, content')
    .eq('id', invitationId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 });
  if (!inv) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: pubs } = await supabase
    .from('publications')
    .select('id')
    .eq('invitation_id', invitationId)
    .eq('user_id', user.id)
    .limit(1);

  const everPublished = (pubs?.length ?? 0) > 0 || inv.is_published;
  if (!everPublished) {
    return NextResponse.json(
      { error: '발행 후에 다운로드할 수 있습니다.' },
      { status: 403 },
    );
  }

  // 2) PDF 생성 — A4 (595 × 842 pt). 단순 테두리 + 본문 + 서명란.
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const fontBytes = await loadKoreanFont();
  const font = await pdf.embedFont(fontBytes, { subset: true });

  const page = pdf.addPage([595, 842]);
  const { width, height } = page.getSize();
  const margin = 56;
  const ink = rgb(0.13, 0.1, 0.07); // #211A11 — 짙은 잉크 톤

  // 외곽 테두리 (이중선) — 결혼서약서 분위기.
  page.drawRectangle({
    x: margin - 12,
    y: margin - 12,
    width: width - 2 * (margin - 12),
    height: height - 2 * (margin - 12),
    borderColor: ink,
    borderWidth: 1.2,
  });
  page.drawRectangle({
    x: margin - 4,
    y: margin - 4,
    width: width - 2 * (margin - 4),
    height: height - 2 * (margin - 4),
    borderColor: ink,
    borderWidth: 0.5,
  });

  // 헤더 — "혼인 서약서"
  drawCenteredText(page, '혼인 서약서', font, 30, height - margin - 50, width, ink);
  drawCenteredText(page, 'MARRIAGE VOWS', font, 10, height - margin - 76, width, ink);

  // 신랑 / 신부 / 날짜 표기.
  const dateLine = inv.wedding_date
    ? formatKoreanDate(inv.wedding_date)
    : '날짜 미정';
  const namesLine = `${inv.groom_name || '신랑'}     ·     ${inv.bride_name || '신부'}`;

  drawCenteredText(page, dateLine, font, 14, height - margin - 130, width, ink);
  drawCenteredText(page, namesLine, font, 22, height - margin - 170, width, ink);

  // 본문 — 사용자가 갈아끼울 임시 문구.
  const body = [
    '오늘, 우리 두 사람은',
    '서로의 곁에서 한 평생을 함께하기로',
    '다음과 같이 약속합니다.',
    '',
    '하나, 우리는 서로를 존중하며',
    '서로의 꿈과 길을 응원하겠습니다.',
    '',
    '둘, 기쁠 때나 어려울 때나',
    '같은 방향을 함께 바라보며 걷겠습니다.',
    '',
    '셋, 우리 둘만의 작은 약속을 잊지 않고',
    '평생 따뜻한 마음으로 함께하겠습니다.',
  ];
  let y = height - margin - 230;
  const bodyFontSize = 14;
  for (const line of body) {
    drawCenteredText(page, line, font, bodyFontSize, y, width, ink);
    y -= bodyFontSize + 8;
  }

  // 서명란 — 신랑·신부 이름 옆에 직선.
  const signY = margin + 100;
  const colWidth = (width - 2 * margin) / 2;
  const sigLineWidth = colWidth * 0.7;

  drawCenteredText(
    page,
    '신랑',
    font,
    11,
    signY + 50,
    margin + colWidth,
    ink,
    margin,
  );
  drawCenteredText(
    page,
    inv.groom_name || '서명',
    font,
    16,
    signY + 18,
    margin + colWidth,
    ink,
    margin,
  );
  page.drawLine({
    start: { x: margin + (colWidth - sigLineWidth) / 2, y: signY + 8 },
    end: { x: margin + (colWidth + sigLineWidth) / 2, y: signY + 8 },
    color: ink,
    thickness: 0.7,
  });
  drawCenteredText(
    page,
    '(서명)',
    font,
    9,
    signY - 8,
    margin + colWidth,
    ink,
    margin,
  );

  drawCenteredText(
    page,
    '신부',
    font,
    11,
    signY + 50,
    margin + 2 * colWidth,
    ink,
    margin + colWidth,
  );
  drawCenteredText(
    page,
    inv.bride_name || '서명',
    font,
    16,
    signY + 18,
    margin + 2 * colWidth,
    ink,
    margin + colWidth,
  );
  page.drawLine({
    start: { x: margin + colWidth + (colWidth - sigLineWidth) / 2, y: signY + 8 },
    end: { x: margin + colWidth + (colWidth + sigLineWidth) / 2, y: signY + 8 },
    color: ink,
    thickness: 0.7,
  });
  drawCenteredText(
    page,
    '(서명)',
    font,
    9,
    signY - 8,
    margin + 2 * colWidth,
    ink,
    margin + colWidth,
  );

  // 푸터 — 발행 정보.
  drawCenteredText(
    page,
    'Generated by 우리다운',
    font,
    8,
    margin - 2,
    width,
    rgb(0.55, 0.5, 0.45),
  );

  const bytes = await pdf.save();

  return new NextResponse(bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="marriage-certificate-${invitationId}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * 주어진 영역 내 중앙에 텍스트를 그린다. 영역은 `[leftEdge, rightEdge]` 로 지정.
 * (x 좌표는 텍스트의 왼쪽 끝 — drawText 의 기본.)
 */
function drawCenteredText(
  page: ReturnType<PDFDocument['addPage']>,
  text: string,
  font: PDFFont,
  size: number,
  y: number,
  rightEdge: number,
  color: ReturnType<typeof rgb>,
  leftEdge = 0,
) {
  const w = font.widthOfTextAtSize(text, size);
  const center = (leftEdge + rightEdge) / 2;
  page.drawText(text, {
    x: center - w / 2,
    y,
    size,
    font,
    color,
  });
}

function formatKoreanDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}
