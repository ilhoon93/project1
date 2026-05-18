/**
 * 카탈로그 마스터 이미지의 컬러/조명 메타데이터 추출 + in-memory 캐시.
 *
 * Phase 1 (harmonize) 와 prompt 동적 주입의 공통 소스. 카탈로그 마스터
 * (`public/wedding-snap/catalog/{id}.jpg`) 를 sharp 로 읽어 LAB 평균 / 추정
 * 색온도 / mood 라벨을 한 번 추출한 뒤 프로세스 메모리에 캐시 (Map).
 *
 * 같은 카탈로그 재사용 시 추가 비용/지연 0 — cold start 한 번만 약 50ms
 * (sharp 파싱) + 카탈로그 파일이 storage 가 아니라 public/ 아래 정적 자산이라
 * 네트워크 호출도 없음. 카탈로그 변경 시 서버 재배포로 자연 무효화.
 */

import sharp from 'sharp';
import path from 'path';
import { findSnapCatalog } from '@/lib/snap/catalog';

export interface CatalogColorMeta {
  /** L*a*b* 평균값. L: 0~100, a: -128~127, b: -128~127. */
  avgLab: { L: number; a: number; b: number };
  /** RGB 평균값 (0~255). recomb/linear 매트릭스 계산 편의용. */
  avgRgb: { r: number; g: number; b: number };
  /** 추정 색온도 (Kelvin). 프롬프트 동적 주입용. ~2500K(warm) ~ ~7500K(cool). */
  kelvin: number;
  /**
   * 자연어 mood 한 줄 — 프롬프트에 직접 삽입 가능.
   * 예: "warm golden-hour highlights, soft pastel midtones".
   */
  moodHint: string;
}

const cache = new Map<string, CatalogColorMeta>();

/**
 * RGB → 추정 색온도 (Kelvin). 정확한 변환은 불가능하지만 R/B 비율로 따뜻함/차가움을
 * 근사 추정해 프롬프트 hint 로 쓸 수준은 됨. (전문 컬러 사이언스 아님 — 인덱스 정도)
 *
 * 휴리스틱:
 *   R/B > 1.15 → ~3500K (warm tungsten/sunset)
 *   1.00~1.15 → ~5000K (warm daylight)
 *   0.90~1.00 → ~5800K (neutral daylight)
 *   0.80~0.90 → ~6500K (cool overcast)
 *   < 0.80    → ~7500K (blue hour)
 */
function estimateKelvin(r: number, g: number, b: number): number {
  // g 채널은 보통 가운데라 안정적 — R/B 비율 기준으로 단순 매핑.
  const ratio = b > 0 ? r / b : 1;
  if (ratio > 1.25) return 3000;
  if (ratio > 1.15) return 3500;
  if (ratio > 1.05) return 4500;
  if (ratio > 0.98) return 5500;
  if (ratio > 0.90) return 6000;
  if (ratio > 0.82) return 6800;
  return 7500;
}

/** Kelvin → 자연어 라벨 (프롬프트 직접 삽입용). */
function kelvinToLabel(k: number): string {
  if (k <= 3200) return 'warm tungsten / sunset (~3000K)';
  if (k <= 4000) return 'warm golden-hour (~3500K)';
  if (k <= 5000) return 'warm daylight (~4500K)';
  if (k <= 5800) return 'neutral daylight (~5500K)';
  if (k <= 6500) return 'cool daylight / soft overcast (~6000K)';
  return 'cool overcast / blue-hour (~7000K)';
}

/**
 * sRGB → LAB 변환. D65 illuminant 기준. sharp .stats() 가 RGB 만 주므로 직접 변환.
 * 비주얼 정밀도는 약간 부족하지만 색매칭 deltaE 계산엔 충분.
 */
function rgbToLab(r: number, g: number, b: number): { L: number; a: number; b: number } {
  // sRGB → linear RGB
  const lin = (c: number) => {
    const x = c / 255;
    return x > 0.04045 ? Math.pow((x + 0.055) / 1.055, 2.4) : x / 12.92;
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);

  // linear RGB → XYZ (D65)
  const X = R * 0.4124564 + G * 0.3575761 + B * 0.1804375;
  const Y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
  const Z = R * 0.0193339 + G * 0.119192 + B * 0.9503041;

  // XYZ → LAB (D65 reference white)
  const Xn = 0.95047;
  const Yn = 1.0;
  const Zn = 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X / Xn);
  const fy = f(Y / Yn);
  const fz = f(Z / Zn);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/**
 * 카탈로그 마스터의 컬러 메타 추출. 첫 호출 시 sharp 로 분석 → 캐시. 이후 캐시 hit.
 *
 * catalogId 가 존재하지만 이미지 파일이 없는 경우(빌드/테스트 환경) null 반환.
 * 호출 측이 메타 없이도 동작하도록 graceful degradation 처리해야 함.
 */
export async function getCatalogColorMeta(
  catalogId: string,
): Promise<CatalogColorMeta | null> {
  const cached = cache.get(catalogId);
  if (cached) return cached;

  const item = findSnapCatalog(catalogId);
  if (!item) return null;

  // image 는 '/wedding-snap/catalog/xxx.jpg' 같은 public 경로.
  // process.cwd() 기준 public/ 하위로 풀어 절대 경로 만든다.
  const relPath = item.image.startsWith('/') ? item.image.slice(1) : item.image;
  const absPath = path.join(process.cwd(), 'public', relPath);

  try {
    const stats = await sharp(absPath).stats();
    const [rCh, gCh, bCh] = stats.channels;
    if (!rCh || !gCh || !bCh) return null;
    const avgRgb = { r: rCh.mean, g: gCh.mean, b: bCh.mean };
    const avgLab = rgbToLab(avgRgb.r, avgRgb.g, avgRgb.b);
    // catalog 정의에 manualKelvin / manualMoodHint 가 있으면 우선 사용 (휴리스틱은
    // 평균 RGB 기반이라 강한 색 그레이드 카탈로그에서 정확도가 떨어질 수 있음).
    const heuristicKelvin = estimateKelvin(avgRgb.r, avgRgb.g, avgRgb.b);
    const kelvin = item.manualKelvin ?? heuristicKelvin;
    const moodHint = item.manualMoodHint ?? kelvinToLabel(kelvin);

    const meta: CatalogColorMeta = { avgLab, avgRgb, kelvin, moodHint };
    cache.set(catalogId, meta);
    return meta;
  } catch (e) {
    // 파일 없음 / 권한 / sharp 디코드 실패 — 메타 없이 진행하도록 null 반환.
    console.warn(`[catalog-metadata] failed to extract ${catalogId}:`, e);
    return null;
  }
}

/** 테스트 / 캐시 워밍업 용. */
export function clearCatalogMetaCache(): void {
  cache.clear();
}
