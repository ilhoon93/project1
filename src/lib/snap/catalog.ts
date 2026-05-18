/**
 * AI 웨딩스냅 카탈로그
 *
 * 미리 만들어 둔 "마스터 샘플 이미지" 를 카탈로그로 두고, 사용자가 자기
 * 신랑/신부 anchor (또는 직결 셀카/커플 사진) 를 입력하면 마스터 샘플의
 * 포즈·구도·배경·의상은 그대로 두고 얼굴/체형만 사용자 얼굴로 교체해
 * 결과를 만든다.
 *
 * Solo anchor 도입 후 personality 별로 input 구성이 분기:
 *   * 'together'    → [groomAnchor, brideAnchor, catalogMaster] (3장)
 *   * 'groom-solo'  → [groomAnchor, catalogMaster] (2장)
 *   * 'bride-solo'  → [brideAnchor, catalogMaster] (2장)
 *
 * Couple 모드에서는 solo 카탈로그가 의미 없어 UI 에서 숨김 처리 (커플 사진
 * 에서 한 명만 추출하면 face fidelity 가 떨어지기 때문).
 *
 * ── 카탈로그 이미지 업로드 위치 ──
 *   public/wedding-snap/catalog/{id}.jpg
 *
 * 권장 규격: 1024×1536 (portrait_4_3) 세로형, JPG/PNG, 2MB 이하.
 *
 * promptHint 는 의상 / 렌즈 / 조명 방향 / 배경 톤 / 컬러 그레이드를 한 번에
 * 명시해 카탈로그 컷 사이의 분산을 줄인다. 80~150 단어가 적정.
 */

export type CatalogPersonality = 'together' | 'groom-solo' | 'bride-solo';

export interface SnapCatalogItem {
  /** 식별자 — 파일명/카탈로그 prompt 키와 동일 */
  id: string;
  /** 카탈로그 미리보기에 보일 한글 라벨 */
  label: string;
  /** 부가 설명 (1줄) */
  hint: string;
  /** 카테고리 그룹 (UI 필터/그룹핑용, 옵션) */
  category: 'studio' | 'outdoor' | 'tradition' | 'urban' | 'beach';
  /** 누가 등장하는 컷인지 — anchor 입력 분기 + UI 표시 기준 */
  personality: CatalogPersonality;
  /** public/ 기준 이미지 경로 — 썸네일 + 모델 reference 양쪽으로 사용 */
  image: string;
  /** 모델에 추가로 넘길 scene 컨텍스트 (배경/의상/조명 톤) */
  promptHint: string;
  /**
   * SNAP_CATALOG_FACE_BLUR=on 일 때 카탈로그 마스터에서 흐림 처리할 얼굴 영역.
   * 각 region 은 [x, y, w, h] 형태이며 모두 0~1 정규화 좌표.
   * together 카탈로그는 두 명 → 2 region, solo 는 1 region 권장.
   * 정확한 좌표는 마스터 이미지를 보면서 조정해야 함 — 아래 값은 일반적 위치의 추정치.
   */
  faceMaskRegions?: readonly (readonly [number, number, number, number])[];
  /**
   * (선택) 마스터의 색온도 휴리스틱 계산 대신 수동 지정. 강한 색 그레이드
   * (예: 골든아워 backlit, 시네마틱 teal&orange) 카탈로그는 평균 RGB 기반 추정이
   * 부정확해 명시적으로 지정하는 게 좋다.
   * 일반적 범위: 2700K(warm tungsten) ~ 6500K(daylight). 골든아워 ≈ 2800-3200K.
   */
  manualKelvin?: number;
  /**
   * (선택) moodHint 텍스트도 수동 override. catalog 가 사용하는 컬러 그레이드
   * 분위기를 한 줄로 (예: "honey-amber backlight, soft golden hour film grain").
   * 지정 시 finishing/harmonize 프롬프트에 그대로 주입.
   */
  manualMoodHint?: string;
}

export const SNAP_CATALOG: SnapCatalogItem[] = [
  // ── Together (커플) 컷 ────────────────────────────────────
  {
    id: 'studio-classic',
    label: '클래식 스튜디오',
    hint: '뉴트럴 그레이 + 소프트박스',
    category: 'studio',
    personality: 'together',
    image: '/wedding-snap/catalog/studio-classic.jpg',
    promptHint:
      'Indoor studio with seamless neutral gray backdrop. Two-source softbox lighting from front-left and front-right at 45° down, soft floor pickup creating gentle shadow under the couple, polished floor reflecting the dress hem. Shot on 50–85mm portrait lens, eye-level camera, shallow depth of field. Groom: black peak-lapel tuxedo with white shirt and black bow tie. Bride: ivory A-line wedding dress with off-shoulder neckline and lace bodice, holding a small white bouquet at waist level. Editorial portrait atmosphere, color grade with subtle warm midtones and neutral highlights. Pose: standing close together, slight three-quarter angle, bride leaning gently toward groom, both looking at camera with natural soft smiles.',
    // together: 신랑(왼쪽), 신부(오른쪽) 얼굴 영역. 정면 풀신/반신 컷 기준 추정치.
    faceMaskRegions: [
      [0.30, 0.16, 0.18, 0.22],
      [0.52, 0.16, 0.18, 0.22],
    ],
  },
  {
    id: 'meadow-spring',
    label: '야외 가든',
    hint: '사이프러스 배경 + 잔디 + 자연광',
    category: 'outdoor',
    personality: 'together',
    image: '/wedding-snap/catalog/meadow-spring.jpg',
    promptHint:
      'Outdoor garden with tall cypress and pine trees forming a green backdrop, well-kept lawn underfoot, soft overcast natural lighting (no harsh sun, no blown highlights). Shot on 50–85mm lens, eye-level camera, slight background compression with shallow depth of field. Groom: black formal suit with white shirt and black tie. Bride: ivory satin off-shoulder A-line wedding dress holding a small bouquet of white and green florals. Full-body or three-quarter pose, standing slightly turned toward each other on the lawn, classic Korean studio outdoor wedding aesthetic. Color grade: cool greens with soft warm skin tones, never oversaturated. Gentle breeze hinting at fabric movement.',
    faceMaskRegions: [
      [0.28, 0.16, 0.16, 0.18],
      [0.52, 0.20, 0.16, 0.18],
    ],
  },
  {
    id: 'hanok-courtyard',
    label: '한옥 정원',
    hint: '벚꽃 + 기왓장 햇살',
    category: 'tradition',
    personality: 'together',
    image: '/wedding-snap/catalog/hanok-courtyard.jpg',
    promptHint:
      'Traditional Korean hanok courtyard with falling cherry blossom petals in the air and on the stone path, dappled sunlight filtering through the trees, wooden architecture and gray-tile roofline as backdrop. Shot on 50–85mm lens, slight low-angle to frame the eaves. Groom: black peak-lapel tuxedo with white shirt and black bow tie. Bride: ivory A-line dress with subtle beading, holding a small white-and-pink bouquet. Warm cultural lighting with golden highlights on hair and shoulders, color grade biased toward warm peach and soft pink. Pose: standing close together on the stone path with petals around them, soft natural smiles. No harsh shadows.',
    faceMaskRegions: [
      [0.30, 0.18, 0.16, 0.20],
      [0.52, 0.18, 0.16, 0.20],
    ],
  },
  {
    id: 'city-goldenhour',
    label: '도심 골든아워',
    hint: '노을빛 유리벽',
    category: 'urban',
    personality: 'together',
    image: '/wedding-snap/catalog/city-goldenhour.jpg',
    promptHint:
      'Modern city street at golden hour (warm orange sun low in the sky, long soft rim light on hair and shoulders — must clearly be golden hour, NOT noon, NOT blue hour). Glass skyscrapers in background reflecting the sunset, wet pavement adding subtle catch lights. Shot on 35–50mm lens for a wider environmental feel, shallow depth of field on subjects. Groom: sharp black tuxedo. Bride: sleek ivory satin A-line dress. Cinematic metropolitan atmosphere, color grade leans warm amber + teal shadow contrast. Pose: walking gently side by side or standing close on the pavement, natural casual movement.',
    faceMaskRegions: [
      [0.30, 0.20, 0.14, 0.16],
      [0.50, 0.22, 0.14, 0.16],
    ],
  },
  {
    id: 'beach-sunset',
    label: '바닷가 석양',
    hint: '잔잔한 파도 + 노을',
    category: 'beach',
    personality: 'together',
    image: '/wedding-snap/catalog/beach-sunset.jpg',
    promptHint:
      'Quiet beach at golden sunset, soft waves rolling on the shore, light sea breeze hinting at fabric movement, warm horizon glow filling the background. Shot on 50–85mm lens, shallow depth of field, slight backlight rim light from the setting sun. Groom: black beach-formal tuxedo (slightly relaxed fit). Bride: ivory chiffon A-line dress with light lace, hem grazing the wet sand. Warm tropical lighting, color grade with warm amber highlights and soft teal shadows. Pose: standing close on the wet sand with bare or simple shoes, looking softly at each other or toward the horizon. No harsh sun glare on faces.',
    faceMaskRegions: [
      [0.30, 0.22, 0.16, 0.18],
      [0.52, 0.22, 0.16, 0.18],
    ],
  },
  {
    id: 'bridge-goldenhour',
    label: '브릿지 골든아워',
    hint: '석양 백라이트 + 스톤 발루스트레이드',
    category: 'urban',
    personality: 'together',
    image: '/wedding-snap/catalog/bridge-goldenhour.jpg',
    promptHint:
      'Outdoor scene on an ornate stone bridge at golden hour, low sun directly behind the couple creating strong warm backlight with subtle lens flare and hazy atmosphere, distant city skyline barely visible as silhouettes in the haze. Carved stone balustrade visible to one side, light wind moving the bride’s hair. Shot on 50–85mm lens, eye-level, shallow depth of field with cinematic sun-flare. Groom: black peak-lapel suit with white shirt and dark tie, short well-groomed hair with a neat mustache. Bride: ivory off-shoulder wedding dress with structured bodice, holding a small bouquet of eucalyptus and white florals. Pose: intimate close together — groom leaning in to kiss the bride near her temple or cheek while the bride looks softly toward camera with a quiet natural smile, the hairline catching warm rim light. Color grade: honey-amber highlights with gentle teal shadows, slight film haze and grain — must clearly read as warm late-afternoon, NOT noon, NOT blue hour.',
    // 강한 backlit + honey-amber 시네마틱 그레이드라 평균 RGB 휴리스틱이 부정확.
    // 명시적으로 골든아워 색온도 + mood 지정.
    manualKelvin: 3000,
    manualMoodHint:
      'honey-amber backlit golden hour, warm rim light with teal-shadow film grade, late-afternoon haze',
    // 신랑(왼쪽 상단, 키스 자세로 약간 앞으로 기울임), 신부(오른쪽, 살짝 아래).
    // 정확한 좌표는 마스터 컷을 보면서 미세조정 권장.
    faceMaskRegions: [
      [0.30, 0.32, 0.16, 0.18],
      [0.46, 0.40, 0.16, 0.18],
    ],
  },
  // ── Solo (단독) 컷 ────────────────────────────────────────
  // 이미지 파일은 사용자가 별도로 마스터를 만들어 같은 id 로 저장해야 함.
  // (예: public/wedding-snap/catalog/groom-portrait-studio.jpg)
  {
    id: 'groom-portrait-studio',
    label: '신랑 스튜디오 단독',
    hint: '뉴트럴 그레이 + 정장 클로즈업',
    category: 'studio',
    personality: 'groom-solo',
    image: '/wedding-snap/catalog/groom-portrait-studio.jpg',
    promptHint:
      'Solo groom portrait — only the groom is in the frame, no bride, no other people. Indoor studio with seamless neutral gray backdrop, two-source softbox lighting from front-left and front-right at 45° down. Shot on 85mm portrait lens, chest-up to waist-up framing, eye-level camera, shallow depth of field. Groom: black peak-lapel tuxedo with white shirt and black bow tie, perfectly tailored, lapels crisp. Confident natural posture, slight head tilt, soft genuine smile or composed neutral expression. Editorial portrait atmosphere, neutral color grade with subtle warm midtones.',
    // solo 클로즈업 / 반신: 얼굴 정중앙 상단 — drift 가장 뚜렷한 케이스, blur 효과 큼.
    faceMaskRegions: [[0.30, 0.10, 0.40, 0.45]],
  },
  {
    id: 'bride-bouquet',
    label: '신부 부케',
    hint: '단독 클로즈업 + 부케',
    category: 'studio',
    personality: 'bride-solo',
    image: '/wedding-snap/catalog/bride-bouquet.jpg',
    promptHint:
      'Solo bride portrait — only the bride is in the frame, no groom, no other people. Indoor studio with seamless soft cream / off-white backdrop, soft directional light from front-left like a large window. Shot on 85mm portrait lens, waist-up framing, eye-level camera, shallow depth of field. Bride: ivory A-line wedding dress with off-shoulder neckline and lace bodice, holding a lush white-and-blush bouquet near her chest. Soft natural smile, eyes slightly toward the camera, gentle hand grip on the bouquet. Color grade: clean cream highlights, soft warm midtones.',
    faceMaskRegions: [[0.32, 0.08, 0.36, 0.30]],
  },
  {
    id: 'groom-walk-away',
    label: '신랑 뒤돌아 걷는 컷',
    hint: '복도 + 빈티지 톤',
    category: 'urban',
    personality: 'groom-solo',
    image: '/wedding-snap/catalog/groom-walk-away.jpg',
    promptHint:
      'Solo groom shot — only the groom in frame, no bride. Long perspective hallway or colonnade with arched windows, soft natural light from the side. Shot on 35–50mm lens, slight low-angle, deep depth of field showing the corridor lines converging. Groom walking away from camera, glancing back over his shoulder with a soft natural smile, jacket gently catching the light. Black peak-lapel tuxedo, polished oxford shoes. Color grade: muted warm earth tones with soft blue shadows, subtle film-like texture. Cinematic narrative atmosphere.',
    // walking-away 컷은 얼굴이 작고 옆모습이라 drift 가 덜 보이지만 보존성 측면에서 light region 만.
    faceMaskRegions: [[0.40, 0.18, 0.18, 0.16]],
  },
  {
    id: 'bride-veil-flow',
    label: '신부 베일 자연광',
    hint: '베일 흩날림 + 부드러운 빛',
    category: 'outdoor',
    personality: 'bride-solo',
    image: '/wedding-snap/catalog/bride-veil-flow.jpg',
    promptHint:
      'Solo bride shot — only the bride in frame, no groom, no other people. Soft outdoor setting with a neutral blurred background (light foliage or pale wall), warm late-afternoon natural light from behind producing a gentle rim along the veil. Shot on 85mm portrait lens, three-quarter (knee-up) framing, slight three-quarter (~20°) angle. Bride: ivory A-line wedding dress with a long tulle veil floating gently in a light breeze, holding a small white bouquet, eyes softly looking aside or down. Color grade: warm pastel with soft pink and cream highlights, dreamy but not over-glowed.',
    faceMaskRegions: [[0.35, 0.12, 0.30, 0.28]],
  },
  {
    id: 'bride-window',
    label: '신부 창가 자연광',
    hint: '실내 창가 + 단독 반신',
    category: 'studio',
    personality: 'bride-solo',
    image: '/wedding-snap/catalog/bride-window.jpg',
    promptHint:
      'Solo bride shot — only the bride in frame, no groom. Indoor room beside a large window with soft natural daylight pouring in from camera-left, sheer curtain diffusing the light. Shot on 50–85mm lens, waist-up framing, three-quarter angle so the window light wraps gently around the face. Bride: ivory A-line wedding dress with off-shoulder neckline, hands resting at her side or lightly on the windowsill, looking softly out the window or toward camera. Color grade: airy clean whites with cool window light tone, soft warm skin midtones. Calm contemplative mood.',
    faceMaskRegions: [[0.35, 0.12, 0.30, 0.30]],
  },
  {
    id: 'bride-vintage-car',
    label: '신부 빈티지 카',
    hint: '클래식 컨버터블 + 풍성한 튤',
    category: 'outdoor',
    personality: 'bride-solo',
    image: '/wedding-snap/catalog/bride-vintage-car.jpg',
    promptHint:
      'Solo bride shot — only the bride in frame, no groom, no other people. Seated inside a vintage convertible automobile with polished mahogany wood trim and cream leather interior, the voluminous ivory tulle skirt of her gown overflowing dramatically across the seat and pooling out of frame. Soft sunlit landscape visible through the side window — distant cypress trees and a faint lake horizon with warm hazy glow. Shot on 50–85mm portrait lens, chest-up to waist-up framing, slight three-quarter angle so the bride looks softly out toward the window. Bride: strapless ivory wedding dress with intricate lace bodice and detached lace sleeves on upper arms, pearl drop earrings, hair pulled back into a sleek smooth low style or soft loose waves. One hand resting gently near her collarbone or shoulder, eyes off-camera in a quiet introspective gaze, soft natural lips. Color grade: warm golden ambient with creamy highlights and rich amber midtones, gentle haze. Editorial bridal magazine atmosphere.',
    // 신부 얼굴이 프레임 우상단에 위치 (가로형 컷). 정확한 좌표는 마스터 컷을
    // 보면서 미세조정 권장 — SNAP_CATALOG_FACE_BLUR=on 일 때만 영향.
    faceMaskRegions: [[0.60, 0.10, 0.20, 0.30]],
  },
];

export const isSnapCatalogId = (v: string): boolean =>
  SNAP_CATALOG.some((c) => c.id === v);

export const findSnapCatalog = (id: string): SnapCatalogItem | undefined =>
  SNAP_CATALOG.find((c) => c.id === id);
