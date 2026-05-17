'use client';

/**
 * 진짜 손글씨 stroke-by-stroke 애니메이션 컴포넌트.
 *
 * 동작 개요:
 *   1. props.fontFamily(예: 'var(--font-playfair-display), serif') 를 받아
 *      hidden probe span 으로 실제 family 이름을 resolve 한다.
 *   2. document.styleSheets 의 @font-face 규칙에서 해당 family 의 woff2 URL 을
 *      찾아낸다. (next/font 가 자동 호스팅한 폰트도 동일하게 발견됨)
 *   3. opentype.js 를 dynamic import 해서 폰트를 파싱 → 글자별 path 데이터를 얻는다.
 *   4. <svg> 안에 글자별 <path> 를 그리되 초기엔 stroke-dasharray/dashoffset 로
 *      한 획씩 그려지는 모습, 그 다음 fill 이 채워지는 시퀀스로 애니메이션.
 *
 * 폴백:
 *   - 폰트 URL 을 찾지 못하거나 파싱 실패 시 onUnsupported 콜백 호출. 부모는
 *     이를 받아 일반 텍스트 fade 애니메이션으로 전환한다.
 *   - opentype.js 의 글자별 path 생성은 단일 outline 1 패스라 한글처럼 여러
 *     획으로 구성된 글자도 outline 한 줄로 이어 그려진다. 사람이 쓰는 획 순서와
 *     완전히 일치하진 않지만 "글자가 그려지는" 시각 효과는 충분히 전달된다.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type * as OpenType from 'opentype.js';

// SSR 환경에선 useLayoutEffect 가 경고를 띄움 — Next.js 'use client' 컴포넌트도
// 빌드 타임에 SSR 렌더되므로 isomorphic 패턴을 적용.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// 모듈 캐시 — 같은 폰트 URL 에 대해 한 번만 fetch + parse.
const fontCache = new Map<string, Promise<OpenType.Font>>();

function loadFont(url: string): Promise<OpenType.Font> {
  const cached = fontCache.get(url);
  if (cached) return cached;
  const p = (async () => {
    // opentype.js 를 dynamic import — 메인 슬라이드에 들어와 stroke 모드가
    // 켜진 사용자에게만 ~150KB 의 파서 코드를 받게 한다.
    const opentype = await import('opentype.js');
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) throw new Error(`font fetch failed: ${res.status}`);
    const buf = await res.arrayBuffer();
    return opentype.parse(buf);
  })();
  fontCache.set(url, p);
  // 실패하면 다음 호출에 재시도할 수 있도록 캐시에서 제거.
  p.catch(() => fontCache.delete(url));
  return p;
}

/**
 * CSS font-family 문자열을 resolved 패밀리 이름 리스트로 변환.
 * 'var(--font-playfair-display), serif' → ['__Playfair_Display_abc', '__Playfair_Display_Fallback', 'serif']
 */
function resolveFontFamilies(cssFontFamily: string): string[] {
  if (typeof document === 'undefined') return [];
  const probe = document.createElement('span');
  probe.style.cssText = `position:absolute;visibility:hidden;left:-9999px;font-family:${cssFontFamily};`;
  probe.textContent = 'a';
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).fontFamily;
  document.body.removeChild(probe);
  return resolved
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

/**
 * document.styleSheets 의 @font-face 규칙에서 주어진 family 의 woff2 URL 추출.
 * cross-origin 으로 cssRules 접근이 막힌 sheet 는 건너뛴다.
 */
function findFontFileUrl(families: string[]): string | null {
  if (typeof document === 'undefined') return null;
  const familySet = new Set(families.map((f) => f.toLowerCase()));
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
      // woff2 > woff > truetype 순으로 우선.
      const woff2 = src.match(/url\(\s*([^)]*?)\s*\)\s*format\(\s*['"]?woff2['"]?\s*\)/i);
      if (woff2) return woff2[1].replace(/['"]/g, '').trim();
      const woff = src.match(/url\(\s*([^)]*?)\s*\)\s*format\(\s*['"]?woff['"]?\s*\)/i);
      if (woff) return woff[1].replace(/['"]/g, '').trim();
      const any = src.match(/url\(\s*([^)]*?)\s*\)/);
      if (any) return any[1].replace(/['"]/g, '').trim();
    }
  }
  return null;
}

interface CharPath {
  d: string;
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
 */
function layoutText(
  font: OpenType.Font,
  text: string,
  fontSize: number,
): Layout {
  const lineHeight = fontSize * 1.25;
  const baselineOffset = fontSize * 0.82;
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
    const glyph = font.charToGlyph(ch);
    const aw = glyph.advanceWidth ?? 0;
    const advance = (aw / font.unitsPerEm) * fontSize;
    if (ch !== ' ' && aw > 0) {
      const p = font.getPath(ch, cursorX, line * lineHeight + baselineOffset, fontSize);
      const d = p.toPathData(2);
      if (d && d.trim().length > 0) {
        paths.push({ d, line, index: charIndex });
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
  const [font, setFont] = useState<OpenType.Font | null>(null);
  const [failed, setFailed] = useState(false);
  const containerRef = useRef<HTMLSpanElement | null>(null);
  // onUnsupported 가 인라인 콜백으로 들어와도 매 렌더마다 재호출되지 않게
  // ref 로 잡아둔다 (effect deps 에 포함 시 무한 fetch 루프 위험).
  const onUnsupportedRef = useRef(onUnsupported);
  useEffect(() => {
    onUnsupportedRef.current = onUnsupported;
  }, [onUnsupported]);

  // 1) 폰트 URL 탐색 + 파싱 — fontFamily 가 바뀌면 다시 시도.
  useEffect(() => {
    let canceled = false;
    setFont(null);
    setFailed(false);

    // CSS 변수가 fonts.css 가 로드되기 전에 빈 값으로 resolve 될 수 있어,
    // document.fonts.ready 대기 후 URL 을 찾는다.
    const start = async () => {
      try {
        if (document.fonts?.ready) {
          await document.fonts.ready;
        }
        if (canceled) return;
        const families = resolveFontFamilies(fontFamily);
        const url = findFontFileUrl(families);
        if (!url) {
          if (!canceled) {
            setFailed(true);
            onUnsupportedRef.current?.();
          }
          return;
        }
        const f = await loadFont(url);
        if (!canceled) setFont(f);
      } catch {
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
  }, [fontFamily]);

  // 2) 폰트가 준비되면 path 별 stroke-dashoffset (totalLength → 0) → fill 채우기 시퀀스.
  //    pathLength=1 정규화는 브라우저별 미묘한 차이가 있어 getTotalLength() 로
  //    실제 path 길이를 측정해서 dasharray/dashoffset 을 절대값으로 직접 셋.
  //    useLayoutEffect — DOM commit 직후 paint 전에 dash 셋업 + 애니메이션을
  //    걸어 첫 프레임에 path 가 통째로 노출되는 flash 를 막는다.
  useIsomorphicLayoutEffect(() => {
    if (!font || !containerRef.current) return;
    const paths = Array.from(containerRef.current.querySelectorAll('path')) as SVGPathElement[];
    if (paths.length === 0) return;
    // 글자 수에 따라 stagger 자동 조절 — 짧을수록 또렷한 stagger, 길수록 빠르게.
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
      // 실제 path 총 길이 — 여러 subpath 가 있으면 전부 더한 값.
      let totalLen = 0;
      try {
        totalLen = path.getTotalLength();
      } catch {
        totalLen = 0;
      }
      if (totalLen === 0) {
        // 길이를 못 구하면 그냥 보이게 둠 — 폴백.
        path.style.visibility = 'visible';
        return;
      }

      // 초기 상태 — dash 한 개로 전체 path 를 덮고 offset 만큼 밀어 숨김.
      path.style.strokeDasharray = `${totalLen}`;
      path.style.strokeDashoffset = `${totalLen}`;
      path.style.fill = 'rgba(0,0,0,0)';
      path.style.visibility = 'visible';

      const delayMs = i * sg * 1000;

      // outline 그리기 — dashoffset totalLen → 0
      animations.push(
        path.animate(
          [{ strokeDashoffset: totalLen }, { strokeDashoffset: 0 }],
          {
            duration: drawMs,
            delay: delayMs,
            fill: 'forwards',
            easing: 'cubic-bezier(0.55, 0.05, 0.35, 1)',
          },
        ),
      );

      // outline 이 거의 다 그려진 시점부터 fill 채우기.
      animations.push(
        path.animate(
          [
            { fill: 'rgba(0,0,0,0)' },
            { fill: color || 'currentColor' },
          ],
          {
            duration: fillMs,
            delay: delayMs + drawMs * 0.85,
            fill: 'forwards',
            easing: 'ease-in',
          },
        ),
      );
    });

    return () => {
      animations.forEach((a) => a.cancel());
    };
  }, [font, color, staggerSec, drawSec, fillSec, text, fontSize]);

  // 폴백 — 폰트 URL 을 못 찾았으면 부모가 다른 렌더 방식으로 전환할 때까지
  // 일반 텍스트를 그대로 보여준다 (애니메이션 없음).
  if (failed) {
    return <>{text}</>;
  }

  // 로딩 중 — 레이아웃 placeholder 로 invisible 텍스트.
  if (!font) {
    return <span style={{ visibility: 'hidden' }}>{text}</span>;
  }

  const layout = layoutText(font, text, fontSize);

  return (
    <span
      ref={containerRef}
      style={{
        display: 'inline-block',
        // fontSize 가 변할 때 SVG 가 폰트 크기에 맞춰 보이도록 lineHeight 정렬.
        lineHeight: 0,
        // 색은 path 의 stroke 기본값(currentColor) 으로 사용.
        color: color || undefined,
      }}
    >
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
          strokeWidth={Math.max(0.8, fontSize * 0.025)}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {layout.paths.map((p, i) => (
            // 초기엔 visibility: hidden — useLayoutEffect 가 getTotalLength 로
            // dasharray/dashoffset 을 세팅한 뒤 visible 로 바꾼다. 이 한 단계로
            // 첫 프레임에 path 전체가 통째로 보이는 flash 가 사라짐.
            <path
              key={`${p.line}-${p.index}-${i}`}
              d={p.d}
              style={{ visibility: 'hidden' }}
            />
          ))}
        </g>
      </svg>
    </span>
  );
}
