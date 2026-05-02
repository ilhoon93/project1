import type { Metadata } from 'next';
import localFont from 'next/font/local';
import {
  Dokdo,
  Gaegu,
  Gowun_Batang,
  Nanum_Brush_Script,
  Nanum_Gothic,
  Nanum_Pen_Script,
  Noto_Sans_KR,
  Noto_Serif_KR,
  Song_Myung,
} from 'next/font/google';
// 참고: Jeju Myeongjo 는 next/font/google 14.2 에서 함수가 아직 노출되지
// 않아 Google Fonts CSS @import 로 globals.css 에서 로드한다. URL 자체는
// Google 의 안정적인 endpoint 라 외부 의존성 중에서도 안전한 편.
import { cn } from '@/lib/utils';
import { AutoLogout } from '@/components/auth/AutoLogout';
import './globals.css';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
});

const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
});

/*
 * Korean web fonts.
 *
 * 모두 next/font/google 로 로드 — Next.js 가 빌드 타임에 폰트 파일을
 * 자동 다운로드해 /_next/static/ 아래로 자체 호스팅한다. 따라서
 *   - Google Fonts 의 URL 이 바뀌어도 빌드된 결과물이 영향을 받지 않고,
 *   - CSS @import 처럼 외부 도메인에 매번 요청이 발생하지 않으며,
 *   - 각 폰트가 고유한 CSS 변수(--font-...) 로 노출되어 슬라이드의
 *     fontFamily 에서 안전하게 참조할 수 있다.
 *
 * 폰트별 사용 가능한 weight 는 Google Fonts 의 명세를 그대로 따른다.
 */
const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-sans-kr',
  display: 'swap',
});

const notoSerifKr = Noto_Serif_KR({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-serif-kr',
  display: 'swap',
});

const gowunBatang = Gowun_Batang({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-gowun-batang',
  display: 'swap',
});

const gaegu = Gaegu({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-gaegu',
  display: 'swap',
});

const dokdo = Dokdo({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-dokdo',
  display: 'swap',
});

const nanumGothic = Nanum_Gothic({
  subsets: ['latin'],
  weight: ['400', '700', '800'],
  variable: '--font-nanum-gothic',
  display: 'swap',
});

const nanumBrushScript = Nanum_Brush_Script({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-nanum-brush',
  display: 'swap',
});

const nanumPenScript = Nanum_Pen_Script({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-nanum-pen',
  display: 'swap',
});

const songMyung = Song_Myung({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-song-myung',
  display: 'swap',
});

/* ─────────────────────────────────────────────────────────────────────
 * LOCAL KOREAN FONTS (Gabia / G마켓 산스 / 나눔스퀘어 네오 / 김정철 /
 * 교보 이유빈) — Google Fonts 에 없는 9 종.
 *
 * 폰트 파일을 src/app/fonts/korean/ 에 다음 파일명으로 받아둔 뒤, 이
 * 블록의 주석을 풀어 활성화한다. 그 다음
 *   1) 아래 koreanFontVariables 배열에 .variable 들을 추가하고
 *   2) src/lib/theme.ts 의 FONT_OPTIONS 에서 9 개 키의 family 를 새
 *      var(--font-...) 로 교체하고
 *   3) HIDDEN_FONT_KEYS 를 비워(또는 해당 키 제거하여) picker 에 노출.
 *
 * 자세한 다운로드 URL · 파일명 · 활성화 절차는 docs/local-fonts-guide.md
 * 를 참고.
 * ───────────────────────────────────────────────────────────────────── */
const nanumSquare = localFont({
  src: './fonts/korean/NanumSquareNeo-Variable.woff2',
  variable: '--font-nanum-square',
  display: 'swap',
});
const gmarket = localFont({
  src: './fonts/korean/GmarketSansTTFMedium.woff2',
  variable: '--font-gmarket',
  display: 'swap',
});
const kyobo2025lyb = localFont({
  src: './fonts/korean/KyoboHandwriting2025lyb.woff2',
  variable: '--font-kyobo-2025lyb',
  display: 'swap',
});
const kyobo2023wsa = localFont({
  src: './fonts/korean/KyoboHandwriting2023wsa.woff2',
  variable: '--font-kyobo-2023wsa',
  display: 'swap',
});
const kyobo2022khn = localFont({
  src: './fonts/korean/KyoboHandwriting2022khn.woff2',
  variable: '--font-kyobo-2022khn',
  display: 'swap',
});
const kyobo2020pdy = localFont({
  src: './fonts/korean/KyoboHandwriting2020pdy.woff2',
  variable: '--font-kyobo-2020pdy',
  display: 'swap',
});
const kimjungchul = localFont({
  src: './fonts/korean/KimjungchulMyungjo-Regular.woff2',
  variable: '--font-kimjungchul',
  display: 'swap',
});
const gabiaMaeum = localFont({
  src: './fonts/korean/GabiaMaeumgyeol.woff2',
  variable: '--font-gabia-maeum',
  display: 'swap',
});
const gabiaNul = localFont({
  src: './fonts/korean/GabiaNull.woff2',
  variable: '--font-gabia-nul',
  display: 'swap',
});
const gabiaHeuldot = localFont({
  src: './fonts/korean/GabiaHeuldot.woff2',
  variable: '--font-gabia-heuldot',
  display: 'swap',
});
const gabiaGosran = localFont({
  src: './fonts/korean/GabiaGosran.woff2',
  variable: '--font-gabia-gosran',
  display: 'swap',
});
const gabiaCheongyeon = localFont({
  src: './fonts/korean/GabiaCheongyeon.woff2',
  variable: '--font-gabia-cheongyeon',
  display: 'swap',
});
const gabiaBombaram = localFont({
  src: './fonts/korean/gabia_bombaram.woff2',
  variable: '--font-gabia-bombaram',
  display: 'swap',
});
const gabiaDunn = localFont({
  src: './fonts/korean/GabiaDunn.woff2',
  variable: '--font-gabia-dunn',
  display: 'swap',
});

const koreanFontVariables = [
  notoSansKr.variable,
  notoSerifKr.variable,
  gowunBatang.variable,
  gaegu.variable,
  dokdo.variable,
  nanumGothic.variable,
  nanumBrushScript.variable,
  nanumPenScript.variable,
  songMyung.variable,
  // 위 LOCAL KOREAN FONTS 블록 활성화 시 같이 추가:
  nanumSquare.variable,
  gmarket.variable,
  kyobo2025lyb.variable,
  kyobo2023wsa.variable,
  kyobo2022khn.variable,
  kyobo2020pdy.variable,
  kimjungchul.variable,
  gabiaMaeum.variable,
  gabiaNul.variable,
  gabiaHeuldot.variable,
  gabiaGosran.variable,
  gabiaCheongyeon.variable,
  gabiaBombaram.variable,
  gabiaDunn.variable,
];

export const metadata: Metadata = {
  title: '우리다운 — 우리 다운 결혼 알림장',
  description: '우리 다운 결혼 알림장과 AI 화보를 한 곳에서',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body
        className={cn(
          geistSans.variable,
          geistMono.variable,
          ...koreanFontVariables,
          'antialiased',
        )}
      >
        <AutoLogout />
        {children}
      </body>
    </html>
  );
}
