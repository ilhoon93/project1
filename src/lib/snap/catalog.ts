/**
 * AI 웨딩스냅 카탈로그
 *
 * 미리 만들어 둔 "마스터 샘플 이미지" 50장을 카탈로그로 두고, 사용자가 자기
 * 신랑/신부 얼굴 사진을 입력하면 마스터 샘플의 포즈·구도·배경·의상은 그대로
 * 두고 얼굴만 사용자 얼굴로 교체해 결과를 만든다 (Strategy B — multi-image).
 *
 * ── 카탈로그 이미지 업로드 위치 ──
 *   public/wedding-snap/catalog/{id}.jpg
 *
 * 예: id 가 'studio-classic' 이면 → public/wedding-snap/catalog/studio-classic.jpg
 *
 * 권장 규격: 1024×1536 (portrait_4_3) 세로형, JPG/PNG, 2MB 이하.
 * 마스터 샘플 자체는 가상 모델로 미리 한 번만 생성해 두면 평생 자산이 된다.
 */

export interface SnapCatalogItem {
  /** 식별자 — 파일명/카탈로그 prompt 키와 동일 */
  id: string;
  /** 카탈로그 미리보기에 보일 한글 라벨 */
  label: string;
  /** 부가 설명 (1줄) */
  hint: string;
  /** 카테고리 그룹 (UI 필터/그룹핑용, 옵션) */
  category: 'studio' | 'outdoor' | 'tradition' | 'urban' | 'beach';
  /** public/ 기준 이미지 경로 — 썸네일 + 모델 reference 양쪽으로 사용 */
  image: string;
  /** 모델에 추가로 넘길 scene 컨텍스트 (배경/의상/조명 톤) */
  promptHint: string;
}

// MVP 샘플 5장 — 사용자가 위 경로에 동일 id 의 파일만 올려두면 즉시 동작.
// 50개로 확장할 땐 같은 형태로 객체만 추가하면 됨.
export const SNAP_CATALOG: SnapCatalogItem[] = [
  {
    id: 'studio-classic',
    label: '클래식 스튜디오',
    hint: '뉴트럴 그레이 + 소프트박스',
    category: 'studio',
    image: '/wedding-snap/catalog/studio-classic.jpg',
    promptHint:
      'Indoor studio with seamless neutral gray backdrop, two-source softbox lighting, polished floor. Groom: black peak-lapel tuxedo. Bride: ivory A-line wedding dress with lace bodice. Editorial portrait atmosphere.',
  },
  {
    id: 'meadow-spring',
    label: '봄날 초원',
    hint: '푸른 하늘 + 야생화',
    category: 'outdoor',
    image: '/wedding-snap/catalog/meadow-spring.jpg',
    promptHint:
      'Wide open meadow under bright blue sky, wildflowers, soft natural daylight. Groom: navy blue tuxedo. Bride: ivory chiffon A-line dress. Romantic outdoor mood.',
  },
  {
    id: 'hanok-courtyard',
    label: '한옥 정원',
    hint: '벚꽃 + 기왓장 햇살',
    category: 'tradition',
    image: '/wedding-snap/catalog/hanok-courtyard.jpg',
    promptHint:
      'Traditional Korean hanok courtyard with falling cherry blossoms, dappled sunlight through trees, stone path. Groom: black peak-lapel tuxedo. Bride: ivory A-line dress. Warm cultural lighting.',
  },
  {
    id: 'city-goldenhour',
    label: '도심 골든아워',
    hint: '노을빛 유리벽',
    category: 'urban',
    image: '/wedding-snap/catalog/city-goldenhour.jpg',
    promptHint:
      'Modern city street at golden hour, glass skyscrapers reflecting sunset, wet pavement. Groom: sharp black tuxedo. Bride: sleek ivory A-line dress. Cinematic metropolitan atmosphere.',
  },
  {
    id: 'beach-sunset',
    label: '바닷가 석양',
    hint: '잔잔한 파도 + 노을',
    category: 'beach',
    image: '/wedding-snap/catalog/beach-sunset.jpg',
    promptHint:
      'Quiet beach at golden sunset, soft waves on shore, sea breeze. Groom: black beach-formal tuxedo. Bride: ivory chiffon A-line dress with light lace. Warm tropical lighting.',
  },
];

export const isSnapCatalogId = (v: string): boolean =>
  SNAP_CATALOG.some((c) => c.id === v);

export const findSnapCatalog = (id: string): SnapCatalogItem | undefined =>
  SNAP_CATALOG.find((c) => c.id === id);
