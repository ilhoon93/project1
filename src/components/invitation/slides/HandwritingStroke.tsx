'use client';

/**
 * 진짜 손글씨 stroke-by-stroke 애니메이션 컴포넌트.
 *
 * 동작 개요:
 *   1. 컨테이너 wrapper <span> 의 computed font-family 를 읽어 실제 family
 *      이름을 얻는다 (var(--font-...) 가 부모로부터 정상 resolve 된 값).
 *   2. document.styleSheets 의 @font-face 규칙에서 해당 family 의 woff2 URL 을
 *      찾아낸다. (next/font 가 자동 호스팅한 폰트도 동일하게 발견됨)
 *   3. fontkit 을 dynamic import 해서 폰트를 파싱 → 글자별 path 데이터를 얻는다.
 *      fontkit 은 WOFF2 → 내부 brotli (pure JS) 로 디컴프레스해서 바로 처리한다.
 *   4. <svg> 안에 글자별 <path> 를 그리되 초기엔 stroke-dasharray/dashoffset 로
 *      한 획씩 그려지는 모습, 그 다음 fill 이 채워지는 시퀀스로 애니메이션.
 *
 * 폴백:
 *   - 폰트 URL 을 찾지 못하거나 파싱 실패 시 onUnsupported 콜백 호출. 부모는
 *     이를 받아 일반 텍스트 fade 애니메이션으로 전환한다.
 *   - fontkit 의 글자별 path 생성은 단일 outline 1 패스라 한글처럼 여러
 *     획으로 구성된 글자도 outline 한 줄로 이어 그려진다. 사람이 쓰는 획 순서와
 *     완전히 일치하진 않지만 "글자가 그려지는" 시각 효과는 충분히 전달된다.
 *
 * fontkit 선택 이유:
 *   - opentype.js 는 WOFF2 디컴프레서가 없어 wawoff2 (emscripten WASM) 가 필요한데
 *     Next.js 빌드에선 onRuntimeInitialized 가 안 fire 되어 hang 됨.
 *   - fontkit 은 내부 brotli (pure JS) + WOFF2 핸들러 포함 → browser 빌드 OK.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type * as Fontkit from 'fontkit';

// SSR 환경에선 useLayoutEffect 가 경고를 띄움 — Next.js 'use client' 컴포넌트도
// 빌드 타임에 SSR 렌더되므로 isomorphic 패턴을 적용.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// 모듈 캐시 — 같은 폰트 URL 에 대해 한 번만 fetch + parse.
const fontCache = new Map<string, Promise<Fontkit.Font>>();

/**
 * 외부 폰트 CDN 의 호스트 — 여기서 폰트를 가져오면 CORS·캐시·서비스 가용성에
 * 의존하므로 안정성이 떨어진다. 콘솔 경고로 "로컬 다운로드 권장" 안내를 띄움.
 * (예: Jeju Myeongjo 는 layout.tsx 의 @import 로 가져오는데 fonts.gstatic.com
 *  서버 응답 + CORS 헤더가 항상 보장되지 않아 stroke 애니메이션이 자주 폴백된다.)
 */
const EXTERNAL_FONT_HOSTS = [
  'fonts.gstatic.com',
  'fonts.googleapis.com',
  'cdn.jsdelivr.net',
  'use.typekit.net',
];

function isExternalFontUrl(url: string): boolean {
  try {
    const u = new URL(url, typeof location !== 'undefined' ? location.href : 'http://localhost');
    return EXTERNAL_FONT_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}

function loadFont(url: string): Promise<Fontkit.Font> {
  const cached = fontCache.get(url);
  if (cached) return cached;
  if (isExternalFontUrl(url) && typeof console !== 'undefined') {
    console.warn(
      [
        '[HandwritingStroke] 외부 CDN 폰트 사용 감지 — stroke 애니메이션이 불안정할 수 있습니다.',
        '안정적인 손글씨 stroke 효과를 위해 폰트 파일(.woff2) 을 다운로드해',
        'src/app/fonts/ 아래에 두고 layout.tsx 에서 next/font/local 로 등록하길 권장합니다.',
        `(현재 URL: ${url})`,
      ].join(' '),
    );
  }
  const p = (async () => {
    // fontkit 을 dynamic import — 메인 슬라이드에 들어와 stroke 모드가 켜진
    // 사용자에게만 받게 한다. browser 빌드는 brotli/woff/woff2 모두 처리.
    const fontkit = (await import('fontkit')) as unknown as {
      default?: { create: (b: Buffer | Uint8Array) => Fontkit.Font };
      create?: (b: Buffer | Uint8Array) => Fontkit.Font;
    };
    const create = fontkit.create ?? fontkit.default?.create;
    if (!create) throw new Error('fontkit.create not available');
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) throw new Error(`font fetch failed: ${res.status}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    const font = create(buf as unknown as Buffer);
    return font;
  })();
  fontCache.set(url, p);
  // 실패하면 다음 호출에 재시도할 수 있도록 캐시에서 제거.
  p.catch(() => fontCache.delete(url));
  return p;
}

/**
 * 호스트 element 의 computed font-family 를 family 이름 리스트로 분해.
 * 'var(--font-playfair-display), serif' → ['__Playfair_Display_abc', '__Playfair_Display_Fallback', 'serif']
 *
 * 호스트가 실제 컴포넌트가 마운트되는 컨테이너이어야 한다. body 같은 글로벌
 * 노드에 가짜 probe 를 띄우면 CSS 변수(--font-...) 가 거기에 정의돼 있지 않아
 * 변수가 unresolved 로 떨어지고 부모 폰트로 폴백돼 잘못된 family 가 나옴.
 */
function readResolvedFontFamilies(hostEl: HTMLElement): string[] {
  if (typeof document === 'undefined') return [];
  const resolved = getComputedStyle(hostEl).fontFamily;
  return resolved
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

/** unicode-range 한 토큰을 [start, end] code point 쌍으로 파싱.
 *  'U+0-FF' → [0, 0xFF]
 *  'U+41'   → [0x41, 0x41]
 *  'U+1F?'  → [0x1F0, 0x1FF] (wildcard 단순 처리)
 */
function parseUnicodeRangeToken(token: string): [number, number] | null {
  const m = token.trim().match(/^[Uu]\+([0-9A-Fa-f?]+)(?:-([0-9A-Fa-f]+))?$/);
  if (!m) return null;
  const a = m[1];
  if (m[2]) {
    return [parseInt(a, 16), parseInt(m[2], 16)];
  }
  if (a.includes('?')) {
    const start = parseInt(a.replace(/\?/g, '0'), 16);
    const end = parseInt(a.replace(/\?/g, 'F'), 16);
    return [start, end];
  }
  const v = parseInt(a, 16);
  return [v, v];
}

function countCovered(rangeStr: string, codePoints: number[]): number {
  if (!rangeStr || rangeStr.trim() === '') return codePoints.length;
  const ranges = rangeStr.split(',').map((t) => parseUnicodeRangeToken(t)).filter(Boolean) as [number, number][];
  if (ranges.length === 0) return codePoints.length;
  let n = 0;
  for (const cp of codePoints) {
    if (ranges.some(([s, e]) => cp >= s && cp <= e)) n += 1;
  }
  return n;
}

/**
 * document.styleSheets 의 @font-face 규칙에서 주어진 family 의 woff2 URL 추출.
 * next/font/google 은 폰트를 unicode-range 별 여러 서브셋(.woff2) 로 분할하므로,
 * 텍스트의 코드포인트를 가장 많이 커버하는 서브셋을 선택해야 한다.
 */
function findFontFileUrl(families: string[], text: string): string | null {
  if (typeof document === 'undefined') return null;
  const familySet = new Set(families.map((f) => f.toLowerCase()));
  // 한 번에 같은 코드포인트 중복 제거.
  const codePoints = Array.from(new Set(Array.from(text).map((c) => c.codePointAt(0)!).filter((n): n is number => typeof n === 'number')));

  const candidates: { url: string; coverage: number }[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList | null = null;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    if (!rules) continue;
    for (const rule of Array.from(rules)) {
      const r = rule as CSSFontFaceRule;
      if (r.type !== CSSRule.FONT_FACE_RULE) continue;
      const family = r.style.getPropertyValue('font-family').replace(/['"]/g, '').trim();
      if (!familySet.has(family.toLowerCase())) continue;
      const src = r.style.getPropertyValue('src');
      const unicodeRange = r.style.getPropertyValue('unicode-range');
      // 텍스트의 코드포인트 중 이 서브셋에 들어가는 개수를 점수로.
      const coverage = countCovered(unicodeRange, codePoints);
      if (coverage === 0 && unicodeRange) continue;
      const woff2 = src.match(/url\(\s*([^)]*?)\s*\)\s*format\(\s*['"]?woff2['"]?\s*\)/i);
      const woff = src.match(/url\(\s*([^)]*?)\s*\)\s*format\(\s*['"]?woff['"]?\s*\)/i);
      const any = src.match(/url\(\s*([^)]*?)\s*\)/);
      const url = woff2?.[1] ?? woff?.[1] ?? any?.[1];
      if (!url) continue;
      candidates.push({ url: url.replace(/['"]/g, '').trim(), coverage });
    }
  }
  if (candidates.length === 0) return null;
  // 코드포인트 커버리지가 가장 높은 서브셋을 선택. 동률이면 처음 발견된 것.
  candidates.sort((a, b) => b.coverage - a.coverage);
  return candidates[0].url;
}

/**
 * 폰트 URL 을 즉시 찾되, 못 찾으면 짧은 대기 후 몇 차례 재시도.
 * next/font 가 비동기로 @font-face 를 주입하는 케이스(특히 dev/preview)에서
 * 첫 시도 시 stylesheet 에 규칙이 아직 없을 수 있어 재시도가 필요하다.
 */
async function findFontUrlWithRetry(hostEl: HTMLElement, text: string): Promise<string | null> {
  const attempts = [0, 80, 160, 320, 640]; // ms — 첫 시도는 즉시.
  for (let i = 0; i < attempts.length; i++) {
    if (attempts[i] > 0) {
      await new Promise((r) => setTimeout(r, attempts[i]));
    }
    const families = readResolvedFontFamilies(hostEl);
    const url = findFontFileUrl(families, text);
    if (url) return url;
  }
  return null;
}

interface CharPath {
  /** SVG path d 문자열 (font units 좌표계, Y up). */
  d: string;
  /** path 에 적용할 SVG transform — 위치+scale+Y flip. */
  transform: string;
  line: number;
  index: number;
}

interface Layout {
  paths: CharPath[];
  viewBoxWidth: number;
  viewBoxHeight: number;
  lineWidths: number[];
}

/**
 * 텍스트를 글자 단위 path 데이터로 변환 + viewBox 정보 계산.
 * 줄바꿈은 \n 으로 처리. 공백은 advance 만 진행하고 path 는 생성하지 않음.
 *
 * fontkit 의 path 좌표는 font units (unitsPerEm 기준) + Y-up 타이포그래픽
 * 컨벤션이라, SVG 의 Y-down 으로 옮기려면 fontSize/unitsPerEm 으로 스케일하고
 * Y 를 음수로 뒤집어야 한다. 그래서 각 글자마다 transform 으로 처리.
 */
function layoutText(
  font: Fontkit.Font,
  text: string,
  fontSize: number,
): Layout {
  const unitsPerEm = font.unitsPerEm;
  const scale = fontSize / unitsPerEm;
  const lineHeight = fontSize * 1.25;
  // baseline 위치 — fontSize 대비 0.82 정도가 ascender 끝에서 적절히 떨어진 baseline.
  const baselineOffsetInLine = fontSize * 0.82;

  let cursorX = 0;
  let line = 0;
  let charIndex = 0;
  const paths: CharPath[] = [];
  const lineWidths: number[] = [0];

  const chars = Array.from(text);
  for (const ch of chars) {
    if (ch === '\n') {
      line += 1;
      cursorX = 0;
      lineWidths.push(0);
      continue;
    }
    const codePoint = ch.codePointAt(0);
    if (codePoint == null) {
      charIndex += 1;
      continue;
    }
    let glyph: Fontkit.Glyph;
    try {
      glyph = font.glyphForCodePoint(codePoint);
    } catch {
      charIndex += 1;
      continue;
    }
    const advance = glyph.advanceWidth * scale;
    if (ch !== ' ' && glyph.advanceWidth > 0) {
      const d = glyph.path.toSVG();
      if (d && d.length > 0) {
        const baselineY = line * lineHeight + baselineOffsetInLine;
        // 글자별 transform — 위치 이동 + 스케일 + Y flip 한 번에.
        const transform = `translate(${cursorX.toFixed(2)} ${baselineY.toFixed(2)}) scale(${scale.toFixed(5)} ${(-scale).toFixed(5)})`;
        paths.push({ d, transform, line, index: charIndex });
      }
    }
    cursorX += advance;
    lineWidths[line] = cursorX;
    charIndex += 1;
  }

  const viewBoxWidth = Math.max(1, ...lineWidths);
  const viewBoxHeight = (line + 1) * lineHeight;
  return { paths, viewBoxWidth, viewBoxHeight, lineWidths };
}

interface Props {
  text: string;
  /** CSS font-family 값 — var(--...) 포함 가능. */
  fontFamily: string;
  /** 폰트 크기 px. */
  fontSize: number;
  /** 글자 색 (stroke + 최종 fill). */
  color: string;
  /** SVG 로드 실패 시 부모에 알림 — 부모가 폴백 텍스트를 표시. */
  onUnsupported?: () => void;
  /** 글자 사이 간격 — 짧을수록 빠르게 이어 쓴 느낌. */
  staggerSec?: number;
  /** 글자 1 자 그려지는 시간. */
  drawSec?: number;
  /** 그려진 뒤 fill 채워지는 시간. */
  fillSec?: number;
}

export function HandwritingStroke({
  text,
  fontFamily,
  fontSize,
  color,
  onUnsupported,
  staggerSec,
  // outline 이 한 자 그려지는 시간 — 너무 빠르면 "한 획씩 쓰여진다" 는 인상이
  // 사라져 그냥 페이드인처럼 보임. 0.6s 정도가 시각적으로 자연스러움.
  drawSec = 0.6,
  // fill 이 채워지는 시간 — outline 이 거의 다 그려진 직후 자연스럽게 차오름.
  fillSec = 0.22,
}: Props) {
  const [font, setFont] = useState<Fontkit.Font | null>(null);
  const [failed, setFailed] = useState(false);
  const containerRef = useRef<HTMLSpanElement | null>(null);
  // onUnsupported 가 인라인 콜백으로 들어와도 매 렌더마다 재호출되지 않게
  // ref 로 잡아둔다 (effect deps 에 포함 시 무한 fetch 루프 위험).
  const onUnsupportedRef = useRef(onUnsupported);
  useEffect(() => {
    onUnsupportedRef.current = onUnsupported;
  }, [onUnsupported]);

  // 1) 폰트 URL 탐색 + 파싱 — fontFamily 가 바뀌면 다시 시도.
  //    containerRef 가 마운트된 뒤 실제 DOM 컨텍스트의 computed fontFamily 를
  //    읽어 변수가 정상 resolve 된 family 이름으로 @font-face 를 찾는다.
  useEffect(() => {
    let canceled = false;
    setFont(null);
    setFailed(false);

    const start = async () => {
      try {
        if (!containerRef.current) return;
        const url = await findFontUrlWithRetry(containerRef.current, text);
        if (canceled) return;
        if (!url) {
          if (typeof console !== 'undefined' && containerRef.current) {
            const families = readResolvedFontFamilies(containerRef.current);
            console.warn(
              '[HandwritingStroke] font URL not found in @font-face rules. Falling back to fade animation.',
              { requestedFontFamily: fontFamily, resolvedFamilies: families },
            );
          }
          setFailed(true);
          onUnsupportedRef.current?.();
          return;
        }
        const f = await loadFont(url);
        if (!canceled) setFont(f);
      } catch (err) {
        if (typeof console !== 'undefined') {
          console.warn('[HandwritingStroke] font load/parse failed, falling back to fade.', err);
        }
        if (!canceled) {
          setFailed(true);
          onUnsupportedRef.current?.();
        }
      }
    };
    void start();

    return () => {
      canceled = true;
    };
  }, [fontFamily, text]);

  // 2) 폰트가 준비되면 path 별 stroke-dashoffset (totalLength → 0) → fill 채우기 시퀀스.
  useIsomorphicLayoutEffect(() => {
    if (!font || !containerRef.current) return;
    const paths = Array.from(containerRef.current.querySelectorAll('path')) as SVGPathElement[];
    if (paths.length === 0) return;
    const auto =
      paths.length <= 4
        ? 0.22
        : paths.length <= 10
          ? 0.16
          : paths.length <= 20
            ? 0.11
            : 0.08;
    const sg = staggerSec ?? auto;
    const drawMs = drawSec * 1000;
    const fillMs = fillSec * 1000;
    const animations: Animation[] = [];

    paths.forEach((path, i) => {
      let totalLen = 0;
      try {
        totalLen = path.getTotalLength();
      } catch {
        totalLen = 0;
      }
      if (totalLen === 0) {
        path.style.visibility = 'visible';
        return;
      }

      path.style.strokeDasharray = `${totalLen}`;
      path.style.strokeDashoffset = `${totalLen}`;
      path.style.fill = 'rgba(0,0,0,0)';
      path.style.visibility = 'visible';

      const delayMs = i * sg * 1000;

      animations.push(
        path.animate(
          [{ strokeDashoffset: totalLen }, { strokeDashoffset: 0 }],
          {
            duration: drawMs,
            delay: delayMs,
            fill: 'both',
            easing: 'cubic-bezier(0.55, 0.05, 0.35, 1)',
          },
        ),
      );

      animations.push(
        path.animate(
          [
            { fill: 'rgba(0,0,0,0)' },
            { fill: color || 'currentColor' },
          ],
          {
            duration: fillMs,
            delay: delayMs + drawMs * 0.85,
            fill: 'both',
            easing: 'ease-in',
          },
        ),
      );
    });

    return () => {
      animations.forEach((a) => a.cancel());
    };
  }, [font, color, staggerSec, drawSec, fillSec, text, fontSize]);

  // 어떤 상태든 wrapper <span> 은 항상 같은 위치/스타일로 렌더한다. ref 가
  // 마운트 직후부터 valid 해서, useEffect 의 첫 폰트 URL 탐색이 컴포넌트 자신의
  // computed fontFamily (CSS 변수 resolve 된 값) 를 읽어 안정적으로 동작한다.
  const wrapperStyle: React.CSSProperties = {
    display: 'inline-block',
    fontFamily,
    color: color || undefined,
    lineHeight: 0,
  };

  if (failed) {
    return (
      <span ref={containerRef} style={wrapperStyle}>
        {text}
      </span>
    );
  }

  if (!font) {
    return (
      <span ref={containerRef} style={{ ...wrapperStyle, visibility: 'hidden', lineHeight: undefined }}>
        {text}
      </span>
    );
  }

  const layout = layoutText(font, text, fontSize);

  return (
    <span ref={containerRef} style={wrapperStyle}>
      <svg
        viewBox={`0 0 ${layout.viewBoxWidth} ${layout.viewBoxHeight}`}
        width={layout.viewBoxWidth}
        height={layout.viewBoxHeight}
        style={{
          display: 'inline-block',
          maxWidth: '100%',
          height: 'auto',
          overflow: 'visible',
        }}
        aria-hidden
        role="presentation"
      >
        <g
          fill="rgba(0,0,0,0)"
          stroke={color || 'currentColor'}
          // stroke width — 너무 얇으면 그려지는 과정이 안 보임. fontSize 대비
          // 0.05 (5%) 정도면 또렷하고, 폰트 본연의 굵기와 충돌하지 않는 수준.
          strokeWidth={Math.max(1.2, fontSize * 0.05)}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {layout.paths.map((p, i) => (
            // 초기엔 visibility: hidden — useLayoutEffect 가 getTotalLength 로
            // dasharray/dashoffset 을 세팅한 뒤 visible 로 바꾼다.
            <path
              key={`${p.line}-${p.index}-${i}`}
              d={p.d}
              transform={p.transform}
              style={{ visibility: 'hidden' }}
            />
          ))}
        </g>
      </svg>
    </span>
  );
}
