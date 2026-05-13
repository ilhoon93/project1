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

/** 카탈로그가 강제하는 framing 스케일 — prompt 빌더가 이 값으로 비율 cue 박음. */
export type CatalogFraming = 'closeup' | 'halfbody' | 'fullbody';

/**
 * 카탈로그 마스터 reference 의 카메라 거리. fullbody 라도 wide 와 medium 은
 * subject 가 차지하는 비율이 다름 — wide 는 환경이 더 보이고 subject 가 작음.
 */
export type CatalogCameraDistance = 'tight' | 'medium' | 'wide';

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

  // ── 신규 메타데이터 (COMPOSITION ZONE — catalog 가 강제) ────────
  // 모두 옵셔널이지만 강력히 권장. promptHint 만으로는 anchor 의 visual signal
  // 을 못 이기는 실패를 막기 위해 framing/pose/distance 를 별도 cue 로 박는다.

  /**
   * 카탈로그가 강제하는 framing 스케일.
   * - closeup: 가슴-위. 얼굴이 프레임의 ~40% 차지.
   * - halfbody: 허리-위. 얼굴이 프레임의 ~25-30% 차지.
   * - fullbody: 발끝까지. 머리가 프레임 상단 ~12-13% 차지.
   */
  framing?: CatalogFraming;

  /**
   * 카탈로그의 핵심 포즈를 1–2 문장으로 묘사. 모델에게 "이 포즈를 그대로
   * 재현하라" 고 명령. anchor 의 default standing 을 누르는 가장 강력한 cue.
   *
   * 예: "Seated on the floor with legs folded sideways, dress fanned out around her,
   *      right hand under chin, bouquet resting on the dress in front."
   */
  pose?: string;

  /** 카메라 거리 — framing 보조. fullbody + wide 는 환경 컷, fullbody + medium 은 보통. */
  cameraDistance?: CatalogCameraDistance;
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
      'Indoor studio with seamless neutral gray backdrop. Two-source softbox lighting from front-left and front-right at 45° down, soft floor pickup creating gentle shadow under the couple, polished floor reflecting the dress hem. Shot on 50–85mm portrait lens, eye-level camera, shallow depth of field. Groom: black peak-lapel tuxedo with white shirt and black bow tie. Bride: ivory A-line wedding dress with off-shoulder neckline and lace bodice, holding a small white bouquet at waist level. Editorial portrait atmosphere, color grade with subtle warm midtones and neutral highlights.',
    framing: 'fullbody',
    cameraDistance: 'medium',
    pose: 'Standing close together with a slight three-quarter (~15°) turn toward camera, bride leaning gently toward the groom (slight shoulder contact), both looking at camera with soft natural smiles, hands relaxed (bride holds bouquet at waist, groom\'s hand relaxed at side or lightly behind bride\'s back).',
  },
  {
    id: 'meadow-spring',
    label: '야외 가든',
    hint: '사이프러스 배경 + 잔디 + 자연광',
    category: 'outdoor',
    personality: 'together',
    image: '/wedding-snap/catalog/meadow-spring.jpg',
    promptHint:
      'Outdoor garden with tall cypress and pine trees forming a green backdrop, well-kept lawn underfoot, soft overcast natural lighting (no harsh sun, no blown highlights). Shot on 50–85mm lens, eye-level camera, slight background compression with shallow depth of field. Groom: black formal suit with white shirt and black tie. Bride: ivory satin off-shoulder A-line wedding dress holding a small bouquet of white and green florals. Classic Korean studio outdoor wedding aesthetic. Color grade: cool greens with soft warm skin tones, never oversaturated. Gentle breeze hinting at fabric movement.',
    framing: 'fullbody',
    cameraDistance: 'medium',
    pose: 'Both standing on the lawn close together, slightly turned toward each other (~15°), bride holding bouquet near her face with both hands as if to sniff it gently (playful intimate moment), groom standing relaxed beside her looking softly at her or at camera. Couple takes up the center of the frame with green trees as backdrop.',
  },
  {
    id: 'hanok-courtyard',
    label: '한옥 정원',
    hint: '벚꽃 + 기왓장 햇살',
    category: 'tradition',
    personality: 'together',
    image: '/wedding-snap/catalog/hanok-courtyard.jpg',
    promptHint:
      'Traditional Korean hanok courtyard with falling cherry blossom petals in the air and on the stone path, dappled sunlight filtering through the trees, wooden architecture and gray-tile roofline as backdrop. Shot on 50–85mm lens, slight low-angle to frame the eaves. Groom: black peak-lapel tuxedo with white shirt and black bow tie. Bride: ivory A-line dress with subtle beading, holding a small white-and-pink bouquet. Warm cultural lighting with golden highlights on hair and shoulders, color grade biased toward warm peach and soft pink. No harsh shadows.',
    framing: 'fullbody',
    cameraDistance: 'medium',
    pose: 'Standing close together on the stone path with petals drifting around them, slight three-quarter angle, bride leaning gently toward the groom holding her bouquet at waist level, groom standing tall beside her, both with soft natural smiles. Cherry blossom petals scattered around their feet on the stone.',
  },
  {
    id: 'city-goldenhour',
    label: '도심 골든아워',
    hint: '노을빛 유리벽',
    category: 'urban',
    personality: 'together',
    image: '/wedding-snap/catalog/city-goldenhour.jpg',
    promptHint:
      'Modern city street at golden hour (warm orange sun low in the sky, long soft rim light on hair and shoulders — must clearly be golden hour, NOT noon, NOT blue hour). Glass skyscrapers in background reflecting the sunset, wet pavement adding subtle catch lights. Shot on 35–50mm lens for a wider environmental feel, shallow depth of field on subjects. Groom: sharp black tuxedo. Bride: sleek ivory satin A-line dress. Cinematic metropolitan atmosphere, color grade leans warm amber + teal shadow contrast.',
    framing: 'fullbody',
    cameraDistance: 'wide',
    pose: 'Walking gently side by side on the pavement, both turned slightly toward the camera direction of travel, bride lightly holding the groom\'s arm or hand, mid-step natural motion (one foot slightly forward), warm sun rim-lighting their silhouettes from behind. Couple occupies the lower-center of the frame with cityscape extending above.',
  },
  {
    id: 'beach-sunset',
    label: '바닷가 석양',
    hint: '잔잔한 파도 + 노을',
    category: 'beach',
    personality: 'together',
    image: '/wedding-snap/catalog/beach-sunset.jpg',
    promptHint:
      'Quiet beach at golden sunset, soft waves rolling on the shore, light sea breeze hinting at fabric movement, warm horizon glow filling the background. Shot on 50–85mm lens, shallow depth of field, slight backlight rim light from the setting sun. Groom: black beach-formal tuxedo (slightly relaxed fit). Bride: ivory chiffon A-line dress with light lace, hem grazing the wet sand. Warm tropical lighting, color grade with warm amber highlights and soft teal shadows. No harsh sun glare on faces.',
    framing: 'fullbody',
    cameraDistance: 'wide',
    pose: 'Standing close on the wet sand, slightly turned toward each other, foreheads gently almost touching or looking softly toward the horizon together, bride\'s dress hem flowing in the sea breeze, groom\'s hand resting at bride\'s waist or holding her hand. Couple silhouetted against the warm horizon glow.',
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
      'Solo groom portrait — only the groom is in the frame, no bride, no other people. Indoor studio with seamless neutral gray backdrop, two-source softbox lighting from front-left and front-right at 45° down. Shot on 85mm portrait lens, eye-level camera, shallow depth of field. Groom: black peak-lapel tuxedo with white shirt and black bow tie, perfectly tailored, lapels crisp. Editorial portrait atmosphere, neutral color grade with subtle warm midtones.',
    framing: 'halfbody',
    cameraDistance: 'medium',
    pose: 'Confident natural posture facing the camera with a slight (~15°) three-quarter turn, one hand relaxed at the side, the other lightly tucked in jacket pocket or holding the lapel, slight head tilt, soft genuine smile.',
  },
  {
    id: 'bride-bouquet',
    label: '신부 부케',
    hint: '단독 클로즈업 + 부케',
    category: 'studio',
    personality: 'bride-solo',
    image: '/wedding-snap/catalog/bride-bouquet.jpg',
    promptHint:
      'Solo bride portrait — only the bride is in the frame, no groom, no other people. Indoor studio with seamless soft cream / off-white backdrop, soft directional light from front-left like a large window. Shot on 85mm portrait lens, eye-level camera, shallow depth of field. Bride: ivory A-line wedding dress with off-shoulder neckline and lace bodice, holding a lush white-and-blush bouquet near her chest. Color grade: clean cream highlights, soft warm midtones.',
    framing: 'halfbody',
    cameraDistance: 'medium',
    pose: 'Standing facing camera with a slight (~10°) three-quarter turn, holding the bouquet near her chest with both hands, soft natural smile, eyes softly toward the camera, gentle relaxed shoulders.',
  },
  {
    id: 'groom-walk-away',
    label: '신랑 뒤돌아 걷는 컷',
    hint: '복도 + 빈티지 톤',
    category: 'urban',
    personality: 'groom-solo',
    image: '/wedding-snap/catalog/groom-walk-away.jpg',
    promptHint:
      'Solo groom shot — only the groom in frame, no bride. Long perspective hallway or colonnade with arched windows, soft natural light from the side. Shot on 35–50mm lens, slight low-angle, deep depth of field showing the corridor lines converging. Black peak-lapel tuxedo, polished oxford shoes. Color grade: muted warm earth tones with soft blue shadows, subtle film-like texture. Cinematic narrative atmosphere.',
    framing: 'fullbody',
    cameraDistance: 'wide',
    pose: 'Walking away from camera down the corridor, mid-stride with one foot slightly forward, head turned back over the shoulder (~90° head turn) toward camera with a soft natural smile, jacket catching the side light. The corridor recedes behind him with strong perspective lines.',
  },
  {
    id: 'bride-veil-flow',
    label: '신부 베일 자연광',
    hint: '베일 흩날림 + 부드러운 빛',
    category: 'outdoor',
    personality: 'bride-solo',
    image: '/wedding-snap/catalog/bride-veil-flow.jpg',
    promptHint:
      'Solo bride shot — only the bride in frame, no groom, no other people. Soft outdoor setting with a neutral blurred background (light foliage or pale wall), warm late-afternoon natural light from behind producing a gentle rim along the veil. Shot on 85mm portrait lens, slight three-quarter (~20°) angle. Bride: ivory A-line wedding dress with a long tulle veil floating gently in a light breeze, holding a small white bouquet. Color grade: warm pastel with soft pink and cream highlights, dreamy but not over-glowed.',
    framing: 'fullbody',
    cameraDistance: 'medium',
    pose: 'Standing at a slight three-quarter (~20°) angle, long tulle veil floating gently in the breeze behind her, holding a small bouquet at waist level, eyes softly looking aside or slightly down with a calm soft smile, weight on one leg with relaxed contrapposto.',
  },
  {
    id: 'bride-window',
    label: '신부 창가 자연광',
    hint: '실내 창가 + 단독 반신',
    category: 'studio',
    personality: 'bride-solo',
    image: '/wedding-snap/catalog/bride-window.jpg',
    promptHint:
      'Solo bride shot — only the bride in frame, no groom. Indoor room beside a large window with soft natural daylight pouring in from camera-left, sheer curtain diffusing the light. Shot on 50–85mm lens, three-quarter angle so the window light wraps gently around the face. Bride: ivory A-line wedding dress with off-shoulder neckline. Color grade: airy clean whites with cool window light tone, soft warm skin midtones. Calm contemplative mood.',
    framing: 'halfbody',
    cameraDistance: 'medium',
    pose: 'Standing beside the window at a three-quarter (~30°) angle to camera, window light wrapping around the face from camera-left, one hand resting lightly on the windowsill or relaxed at her side, eyes softly looking out the window or slightly toward camera with a calm contemplative soft smile.',
  },
];

export const isSnapCatalogId = (v: string): boolean =>
  SNAP_CATALOG.some((c) => c.id === v);

export const findSnapCatalog = (id: string): SnapCatalogItem | undefined =>
  SNAP_CATALOG.find((c) => c.id === id);
