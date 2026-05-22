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
   * (옵션) 카탈로그 스타일 강도 — 입력↔카탈로그 갭이 얼마나 크게 작용할지의 정성적 등급.
   *   - 'low'    : 중립 스튜디오, 부드러운 자연광. 거의 어떤 입력과도 잘 어울림.
   *   - 'medium' : 일반 야외 / 한옥. 평균적 변환량.
   *   - 'high'   : 강한 backlight / 시네마틱 그레이드 / 강한 sun-flare 등. 야경·저조도
   *                입력 사진에서 얼굴 변형 위험 증가. UI 에서 사용자에게 사전 경고.
   * 미지정 시 'medium' 으로 간주.
   */
  intensity?: 'low' | 'medium' | 'high';
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
    intensity: 'low',
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
    intensity: 'low',
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
    intensity: 'medium',
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
    intensity: 'high',
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
    intensity: 'high',
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
    intensity: 'high',
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
  {
    id: 'beach-classic-white',
    label: '비치 클래식 화이트',
    hint: '화이트 슈트 + 베일 + 잔잔한 파도',
    category: 'beach',
    personality: 'together',
    intensity: 'medium',
    image: '/wedding-snap/catalog/beach-classic-white.jpg',
    promptHint:
      'Quiet seaside at warm late-afternoon daylight (soft low sun in clear pale-blue sky, gently breaking waves on calm shoreline in the background, light sea breeze hinting at fabric movement). Shot on 50–85mm portrait lens, full-body / three-quarter framing, eye-level camera, shallow depth of field with crisp soft natural light. Groom: clean ivory/white formal suit with mandarin/Nehru-style collar, no tie, dark hair tied back in a low bun and a neat short beard. Bride: ivory A-line wedding dress with delicate lace bodice and off-shoulder neckline, a long flowing tulle veil/cape draping behind her, hair pulled back in a soft updo with small pearl pins. Pose: standing close facing each other in profile, foreheads gently touching, holding hands in front at waist level, soft natural smiles with eyes closed or softly cast down. Color grade: bright airy whites with pale-blue sky tones and warm cream skin midtones, gentle film softness — must clearly read as warm bright daylight, NOT night, NOT studio.',
    // 신부(왼쪽, 살짝 아래), 신랑(오른쪽, 살짝 위) — 프로파일-투-프로파일 자세 기준 추정치.
    // 정확한 좌표는 마스터 컷을 보면서 미세조정 권장.
    faceMaskRegions: [
      [0.30, 0.32, 0.18, 0.18],
      [0.48, 0.28, 0.18, 0.18],
    ],
  },
  {
    id: 'seoul-nightview',
    label: '서울 야경 루프탑',
    hint: '루프탑 + N서울타워 야경',
    category: 'urban',
    personality: 'together',
    intensity: 'medium',
    image: '/wedding-snap/catalog/seoul-nightview.jpg',
    promptHint:
      'Outdoor rooftop terrace overlooking the Seoul city skyline at twilight / blue hour — Namsan mountain and N Seoul Tower clearly visible in the distance, dense cityscape of mid-rise buildings with warm tungsten window lights glowing across the frame, glass guardrail at the rooftop edge with subtle uplight LEDs along the floor. Shot on 35–50mm lens for a wider environmental feel, full-body framing, eye-level camera, shallow depth of field on subjects with soft city bokeh behind. Groom: charcoal / dark-gray three-piece suit with dark tie and white shirt, short neat black hair, calm composed soft smile. Bride: sleek ivory satin floor-length wedding dress with subtle cowl / draped neckline, hair pulled back in a low chignon with small pearl drop earrings. Pose: standing close side by side at the railing, bride’s hand resting on the groom’s lapel or arm, both facing camera with soft natural smiles. Color grade: cinematic blue-hour palette with cool city-light blues, warm tungsten window glow as accent, gentle film grain — must clearly read as evening twilight / blue hour, NOT noon, NOT golden hour.',
    // 야경 + 강한 도시광·tungsten 윈도우 글로우 혼재 → 평균 RGB 휴리스틱이 부정확.
    // 명시적으로 블루아워 색온도 + mood 지정.
    manualKelvin: 4200,
    manualMoodHint:
      'Seoul blue-hour cityscape, cool ambient blue sky with warm tungsten window-light accents, gentle film grain',
    // 신랑(왼쪽), 신부(오른쪽, 살짝 아래) — 풀신 투샷 루프탑 기준 추정치.
    // 정확한 좌표는 마스터 컷을 보면서 미세조정 권장.
    faceMaskRegions: [
      [0.28, 0.20, 0.16, 0.16],
      [0.50, 0.22, 0.14, 0.14],
    ],
  },
  {
    id: 'studio-floral-pastel',
    label: '플라워 파스텔 스튜디오',
    hint: '파스텔 라일락·핑크 플라워 + 화이트 벽',
    category: 'studio',
    personality: 'together',
    intensity: 'low',
    image: '/wedding-snap/catalog/studio-floral-pastel.jpg',
    promptHint:
      'Indoor studio with seamless bright white wall backdrop and abundant floral arrangements framing the couple — tall stems of pastel lilac delphinium, blush garden roses, soft pink lisianthus, cream hydrangea, and fresh green foliage flanking both sides of the frame and trailing along the floor. Soft diffused natural light (large window / softbox) creating gentle floral shadows on the wall. Shot on 50–85mm portrait lens, eye-level camera, three-quarter to full-body framing, shallow depth of field. Couple seated close together on a low cream platform or bench, low enough that the dress drapes naturally. Groom: black peak-lapel suit with white shirt and pale champagne / ivory tie, short neat black hair, soft natural smile. Bride: strapless ivory ball-gown wedding dress with full tulle skirt and subtle beaded bodice, hair in soft long waves with small earring accent, one hand resting lightly on the groom’s arm. Pose: groom seated, bride leaning gently into him with her arm wrapped around his, both facing camera with soft genuine smiles. Color grade: airy bright whites with pastel lilac and blush highlights, clean warm skin midtones — romantic dreamy bridal magazine atmosphere, never oversaturated.',
    // 신랑(왼쪽), 신부(오른쪽, 거의 같은 높이) — 앉은 자세 투샷 기준 추정치.
    // 정확한 좌표는 마스터 컷을 보면서 미세조정 권장.
    faceMaskRegions: [
      [0.30, 0.30, 0.16, 0.18],
      [0.48, 0.32, 0.16, 0.18],
    ],
  },
  {
    id: 'desert-warm-walk',
    label: '사막 웨딩 워킹',
    hint: '모래언덕 + 햇살 + 캐주얼 워킹',
    category: 'outdoor',
    personality: 'together',
    intensity: 'medium',
    image: '/wedding-snap/catalog/desert-warm-walk.jpg',
    promptHint:
      'Outdoor sand dune landscape with soft rolling beige sand stretching to a distant horizon, sparse tufts of pale dune grass in the mid-ground, hazy bright daylight (high sun softened by light haze, NOT golden hour, NOT noon glare). Shot on 35–50mm lens for environmental walking feel, full-body framing, eye-level camera, shallow depth of field on subjects with creamy sand bokeh behind. Groom: clean white button-up shirt (sleeves casually rolled or pushed up) with tan / khaki chinos, short dark hair with a neat short beard, relaxed natural posture. Bride: vivid coral-red lace mermaid dress with ruffle V-neckline shoulder straps and small bead detailing, long loose blonde-toned waves blowing in the breeze, a small matching red feather hair accent. Pose: couple walking side by side across the dune holding hands, both laughing and looking at each other with big genuine smiles mid-step — candid joyful prewedding movement, not a static pose. Color grade: warm sandy beige highlights with pale-cream sky and rich saturated red on the dress, soft daylight haze. Sense of warmth and joy, light wind motion in fabric and hair.',
    // 강한 채도 빨강 드레스 + 햇살 haze → 평균 RGB 휴리스틱이 빨강 쪽으로 치우칠 위험.
    // 톤은 자연 햇살 daylight 로 명시 고정.
    manualKelvin: 5200,
    manualMoodHint:
      'warm hazy daylight on beige sand dunes, saturated red dress as focal accent, joyful candid walking motion',
    // 신랑(왼쪽), 신부(오른쪽) — 양쪽으로 벌어진 워킹 투샷이라 얼굴 간격이 넓음.
    // 정확한 좌표는 마스터 컷을 보면서 미세조정 권장.
    faceMaskRegions: [
      [0.18, 0.18, 0.16, 0.18],
      [0.62, 0.20, 0.16, 0.18],
    ],
  },
  {
    id: 'meadow-casual-shades',
    label: '잔디밭 캐주얼 선글라스',
    hint: '데님 셔츠 + 튤 드레스 + 부케 + 선글라스',
    category: 'outdoor',
    personality: 'together',
    intensity: 'medium',
    image: '/wedding-snap/catalog/meadow-casual-shades.jpg',
    promptHint:
      'Outdoor scene seated on a lush green lawn (uniform short grass filling the entire background, no trees or sky visible — just grass), warm late-afternoon natural sunlight from camera-left creating soft rim on hair and shoulders. Shot on 50–85mm portrait lens, three-quarter / waist-up framing, slight low-angle from ground level, shallow depth of field on the couple. Bride: spaghetti-strap white tulle wedding dress with layered ruffle skirt cascading over crossed legs, sheer cathedral veil softly draped behind her hair, hair in a clean middle-parted low style, sleek black cat-eye sunglasses, tan suede ankle boots, one hand propping up her chin with elbow on knee — relaxed cool posture. Groom: dark indigo denim button-up shirt (slightly faded), dark navy trousers, white tube socks, navy canvas sneakers, short neat dark hair, large black square sunglasses, seated with knees up and back relaxed, both hands cradling a wild bouquet of pink hyacinth, yellow craspedia, purple statice and trailing red amaranthus between his knees. Pose: bride seated on the grass to the left, groom seated to her right slightly higher, both facing camera straight on with calm cool neutral expressions, no smiles, gen-Z 90s editorial vibe. Color grade: muted natural greens with warm cream skin midtones, slight film softness, contrasted vintage prewedding mood — must read as warm bright daytime, NOT studio, NOT golden hour.',
    manualKelvin: 5000,
    manualMoodHint:
      'warm late-afternoon natural sunlight on uniform green lawn, retro 90s gen-Z editorial mood, both wearing sunglasses, film softness',
    // 신부(왼쪽, 더 아래·바닥쪽), 신랑(오른쪽, 약간 위) — 풀신 앉은 자세 기준 추정치.
    faceMaskRegions: [
      [0.22, 0.22, 0.18, 0.18],
      [0.56, 0.16, 0.18, 0.20],
    ],
  },
  {
    id: 'bridge-night-noir',
    label: '브릿지 야경 누아르',
    hint: '검정 슈트·드레스 + 가로등 + 야경 보케',
    category: 'urban',
    personality: 'together',
    intensity: 'high',
    image: '/wedding-snap/catalog/bridge-night-noir.jpg',
    promptHint:
      'Outdoor scene on a city bridge / pedestrian overpass at night, distant skyline visible as blurred bokeh of warm tungsten window lights and cool blue LED accents, painted steel guardrail visible behind the couple, asphalt road slightly visible beyond. Single warm tungsten street lamp out of frame upper-left providing strong directional key light, deep moody shadows on the right side of faces, cinematic noir mood. Shot on 50–85mm portrait lens, three-quarter framing, eye-level camera, shallow depth of field with creamy city bokeh behind. Bride: elegant sleeveless black halter-neck cocktail dress with high mock-neck collar, long dramatic crystal-drop earrings catching the lamp light, sleek low-ponytail hair with side parting, soft natural makeup with neutral lip, holding a small bouquet of saturated red carnations and dahlias close at her waist. Groom: black three-piece formal suit (jacket + waistcoat + trousers) with crisp white shirt and slim black silk bow / scarf-tie, short neat dark hair, soft natural composed expression. Pose: standing close together with groom slightly behind bride, his right hand gently resting on bride\'s left shoulder, both turned 3/4 toward camera-right looking softly off into the distance (NOT at camera), calm cinematic introspective mood. Color grade: cinematic warm tungsten highlights with deep cool teal-blue shadows, rich blacks, gentle film grain — must clearly read as warm-lit urban night, NOT golden hour, NOT studio.',
    // 강한 tungsten 가로등 + 야경 cool 보케 혼재 → 평균 RGB 휴리스틱 부정확.
    manualKelvin: 3200,
    manualMoodHint:
      'urban bridge at night under warm tungsten street lamp, cinematic noir mood with teal-blue shadows and rich blacks, distant city bokeh, gentle film grain',
    // 신부(왼쪽, 앞쪽), 신랑(오른쪽, 뒤쪽) — 반신 그루밍 자세.
    faceMaskRegions: [
      [0.18, 0.32, 0.18, 0.20],
      [0.46, 0.28, 0.18, 0.20],
    ],
  },
  {
    id: 'canola-field-walk',
    label: '유채꽃밭 산책',
    hint: '노란 유채꽃 + 흰 셔츠 + 미니 드레스 캐주얼',
    category: 'outdoor',
    personality: 'together',
    intensity: 'low',
    image: '/wedding-snap/catalog/canola-field-walk.jpg',
    promptHint:
      'Outdoor scene in a vast yellow canola / rapeseed flower field in full bloom, soft rolling green hills and pale blue sky with thin wispy clouds in the distance, late-morning warm natural sunlight from camera-right creating soft rim on hair and shoulders. Shot on 50–85mm portrait lens, full-body framing, eye-level camera, shallow depth of field with creamy yellow floral bokeh. Groom: crisp white long-sleeve dress shirt (slightly relaxed fit), narrow black slim necktie, dark brown straight trousers, short neat black hair with a soft natural smile. Bride: strapless white short bubble-hem mini wedding dress with structured bodice, hair pulled back into a clean low ponytail, tan / brown suede ankle boots, holding a small bouquet of white florals in her free hand. Pose: couple walking gently side by side through a narrow path between the yellow blooms, holding hands at waist height, turned slightly toward each other with big natural smiles and warm eye contact mid-step — candid joyful prewedding movement. Color grade: saturated cheerful yellows with warm cream skin midtones and clean pale blue sky, fresh airy K-prewedding magazine atmosphere — must read as bright warm spring daylight, NOT golden hour, NOT studio.',
    manualKelvin: 5400,
    manualMoodHint:
      'bright warm spring daylight in a yellow canola flower field, fresh saturated yellows with clean pale-blue sky, joyful candid walking motion',
    // 신랑(왼쪽), 신부(오른쪽, 약간 아래 — 키 차이) — 풀신 워킹 투샷 기준 추정치.
    faceMaskRegions: [
      [0.30, 0.20, 0.16, 0.18],
      [0.52, 0.26, 0.16, 0.18],
    ],
  },
  {
    id: 'studio-couple-puppy',
    label: '스튜디오 강아지 동반',
    hint: '블러시 튤 가운 + 검정 니트 + 푸들',
    category: 'studio',
    personality: 'together',
    intensity: 'low',
    image: '/wedding-snap/catalog/studio-couple-puppy.png',
    promptHint:
      'Indoor studio with seamless soft cream / off-white painted wall backdrop, couple seated together on a dark charcoal-gray modern sofa, soft diffused daylight from a large window out of frame camera-left creating clean gentle highlights and no harsh shadows. Shot on 50–85mm portrait lens, three-quarter (waist-up) framing, eye-level camera, shallow depth of field. Bride: strapless soft blush-pink layered tulle wedding gown with subtle beaded bodice and voluminous skirt cascading across the sofa, long straight dark hair with soft side-swept fringe, dainty small earrings, soft natural makeup with rosy lip, seated slightly turned toward the groom with one hand gently resting on top of his head or shoulder, calm warm smile looking at camera. Groom: clean black fine-knit round-neck sweater with simple white inner shirt collar peeking at the neckline, short neat dark hair, soft natural composed smile looking at camera. Between them in the groom\'s lap: a small fluffy apricot-brown toy poodle puppy with a tiny white ribbon collar, sitting calmly facing camera. Color grade: airy bright cream highlights with soft blush accent on the gown and clean warm skin midtones, gentle film softness — romantic intimate K-prewedding magazine atmosphere with a heart-warming pet companion, never oversaturated. Must clearly read as soft indoor natural-window-light studio, NOT outdoor, NOT golden hour.',
    // 신부(왼쪽 약간 위), 신랑(오른쪽 중앙) — 앉은 투샷 + 강아지 푸들이 신랑 무릎.
    faceMaskRegions: [
      [0.18, 0.18, 0.20, 0.22],
      [0.48, 0.26, 0.22, 0.24],
    ],
  },
  {
    id: 'studio-couple-overhead',
    label: '스튜디오 머리 위 손 장난',
    hint: '화이트 스튜디오 + 신부 신랑 머리 위 장난 포즈',
    category: 'studio',
    personality: 'together',
    intensity: 'low',
    image: '/wedding-snap/catalog/studio-couple-overhead.png',
    promptHint:
      'Indoor studio with seamless pure bright white painted wall backdrop, soft large diffused front beauty light from slightly above and camera-left creating clean luminous skin tones and very gentle shadows. Shot on 85mm portrait lens, chest-up close framing, eye-level camera with both faces clearly centered, shallow depth of field. Groom: clean black peak-lapel formal suit jacket with crisp white shirt and slim black necktie, short neat dark hair, calm composed soft smile, seated lower in the frame facing camera straight on. Bride: strapless ivory wedding dress with delicate beaded bodice, long straight dark hair softly draped behind shoulders, dainty drop earrings, soft natural rosy makeup, standing close behind the seated groom and leaning gently forward over his head, both of her hands resting playfully and lightly on top of the groom\'s head with relaxed fingers (not gripping, just gently placed), her face peeking over his head from above with a warm bright genuine smile looking directly at camera. Pose: cheerful playful intimate K-prewedding moment, bride above and slightly behind, groom centered and slightly lower — both clearly visible and facing camera with soft natural eye contact. Color grade: bright airy whites with clean warm cream skin midtones, very low contrast, dreamy minimalist K-prewedding beauty editorial — must clearly read as soft studio beauty light, NOT outdoor, NOT golden hour.',
    // 신부(상단, 살짝 작음 — 뒤쪽), 신랑(중앙·하단, 더 큼 — 앞쪽).
    faceMaskRegions: [
      [0.34, 0.10, 0.30, 0.30],
      [0.30, 0.42, 0.38, 0.36],
    ],
  },
  {
    id: 'countryside-bicycle-sunset',
    label: '시골길 자전거 골든아워',
    hint: '빈티지 자전거 + 해바라기 바구니 + 노을',
    category: 'outdoor',
    personality: 'together',
    intensity: 'high',
    image: '/wedding-snap/catalog/countryside-bicycle-sunset.png',
    promptHint:
      'Outdoor scene on a quiet narrow rural dirt road cutting through Korean countryside at golden hour (warm low sun in the sky filling the horizon with soft peach and lavender clouds — must clearly be golden hour, NOT noon, NOT blue hour). Distant low forested hills and a scattered handful of small rural houses with blue and red metal roofs in the mid-ground, a few wooden utility poles with thin power lines extending along the road. Shot on 35–50mm lens for environmental feel, full-body framing, eye-level camera, shallow depth of field on the couple with warm hazy sunset bokeh behind. Groom: warm beige / camel-tan two-piece formal suit with white shirt and dark slim tie, short neat dark hair, calm soft smile, seated on a vintage cream-colored single-speed bicycle with a woven brown wicker front basket overflowing with fresh sunflowers and small white wildflowers, gently pedaling forward along the dirt road. Bride: soft champagne-beige / pale blush long satin wedding dress with delicate spaghetti straps and subtle ruffle hem, long dark hair softly tied back, holding lightly onto the groom\'s shoulders or seated side-saddle on the rear rack of the bicycle, leaning playfully toward him with a big genuine open-mouth laugh of pure joy. Pose: candid joyful prewedding moment mid-ride, bicycle moving slowly toward camera at slight angle, both leaning into each other with bright natural laughter. Color grade: cinematic warm honey-amber highlights with soft peach sky and gentle teal-shadow countryside greens, light film grain and warm sunset haze — must clearly read as warm late-afternoon golden hour rural Korea, NOT studio, NOT noon.',
    manualKelvin: 3000,
    manualMoodHint:
      'Korean countryside golden hour, warm peach-amber sky with honey rim light on hair, sunflower basket bicycle ride, joyful candid laughter, cinematic film grain',
    // 신랑(왼쪽·중앙, 자전거에 앉음), 신부(오른쪽·뒤, 살짝 위) — 자전거 투샷 기준 추정치.
    faceMaskRegions: [
      [0.36, 0.46, 0.16, 0.16],
      [0.52, 0.40, 0.16, 0.16],
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
  {
    id: 'bride-garden-twirl',
    label: '신부 가든 베일 트월',
    hint: '머메이드 + 베일 + 꽃잎 흩날림 + 모션',
    category: 'outdoor',
    personality: 'bride-solo',
    intensity: 'medium',
    image: '/wedding-snap/catalog/bride-garden-twirl.jpg',
    promptHint:
      'Solo bride shot — only the bride in frame, no groom, no other people. Outdoor green park scene with lush dense foliage trees filling the background (no buildings, sky barely visible at top), soft hazy afternoon daylight providing even diffuse illumination. White rose petals floating and falling in mid-air around the bride for dynamic motion. Shot on 50–85mm portrait lens, three-quarter framing (upper-thigh up), eye-level camera, shallow depth of field on subject with creamy green foliage bokeh. Bride: structured strapless ivory mermaid wedding dress with delicate lace bodice and dramatic layered ruffle mermaid skirt cascading to the ground, long cathedral-length tulle veil floating in the breeze diagonally across the frame, hair in a clean center-parted low chignon with side wisps, small pearl drop earrings, soft natural makeup with rosy lip. Pose: standing facing slightly away then turning her upper body BACK toward camera over her left shoulder (~30–40° three-quarter angle, face still clearly visible), right arm raised high holding a small bouquet of white garden roses with greenery up above her head, left hand pulling the floating veil out and across her front waist creating a dramatic sweeping motion, bright big genuine smile with eyes on camera. Color grade: bright airy daylight greens with clean ivory whites and warm cream skin midtones, dreamy joyful motion atmosphere — must read as bright outdoor afternoon, NOT golden hour, NOT studio.',
    manualKelvin: 5500,
    manualMoodHint:
      'bright outdoor afternoon under hazy diffused daylight in a green park, joyful dynamic motion with floating veil and falling petals, bright genuine smile',
    // 신부 얼굴이 프레임 중앙에서 약간 우측, 베일·팔 사이로 노출 — 3/4 over-shoulder 자세.
    faceMaskRegions: [[0.40, 0.20, 0.22, 0.20]],
  },
  {
    id: 'bride-veil-closeup',
    label: '신부 베일 클로즈업',
    hint: '화이트 미니멀 + 베일 너머 시선',
    category: 'studio',
    personality: 'bride-solo',
    intensity: 'low',
    image: '/wedding-snap/catalog/bride-veil-closeup.jpg',
    promptHint:
      'Solo bride shot — only the bride in frame, no groom, no other people. Indoor studio with pure seamless bright white backdrop, soft large diffused front beauty light from slightly above creating clean luminous skin tones, no harsh shadows. Shot on 85mm portrait lens, chest-up close-up framing, slight three-quarter angle (~20° to camera-right) with face turned back softly toward camera. Bride: strapless ivory wedding dress with sheer ruffled tulle / chiffon bodice detail, single small freshwater pearl drop earring on the visible side, very natural soft "no-makeup" makeup with rosy cheeks and a soft nude-pink lip, long straight black hair tucked behind one shoulder. Long fine-mesh white tulle veil draped over her head and softly trailing past her shoulders, the mesh delicately texturing the skin where it overlaps. Pose: head tilted slightly to one side, eyes gazing softly toward camera with calm gentle expression, one hand gently lifting a soft ruffled lace piece of the dress fabric up near her chin / cheek so the lace partially frames the lower face without covering eyes or nose. Color grade: airy bright whites with warm cream skin midtones, very low contrast, dreamy minimalist beauty editorial — must clearly read as soft studio beauty, NOT outdoor.',
    // 클로즈업 컷 — 얼굴이 프레임의 큰 비중을 차지. blur region 도 충분히 넓게.
    faceMaskRegions: [[0.30, 0.14, 0.36, 0.40]],
  },
  {
    id: 'hanok-greenhanbok-peek',
    label: '한옥 한복 문 너머 엿보기',
    hint: '연두 치마 + 문 너머 살짝 + 장난스러운 포즈',
    category: 'tradition',
    personality: 'bride-solo',
    intensity: 'medium',
    image: '/wedding-snap/catalog/hanok-greenhanbok-peek.jpg',
    promptHint:
      'Solo bride shot — only the bride in frame, no groom, no other people. Traditional Korean hanok interior view: a warm cream / off-white painted heavy wooden door partially open in the foreground (subject leaning around its right edge), beyond the door a soft teal-painted hanji wall and dark red-orange lacquered wooden beams across the top of the frame, glimpse of another wooden door panel deeper inside. Soft natural indoor daylight from an unseen window providing gentle warm illumination on her face, no harsh shadows. Shot on 50–85mm portrait lens, three-quarter (knee-up) framing, eye-level camera, moderate depth of field so the door edge and her face are both crisp. Bride: traditional Korean hanbok consisting of a warm dove-gray short jeogori (top) with white collar trim and clean white goreum tie, and a long soft mint-green chima (skirt) flowing down. Long straight black hair styled in a single thick side-braided ponytail draped over her right shoulder, no veil, no other accessories. Pose: standing playfully behind the heavy wooden door, leaning around its right edge to peek out toward camera, both hands lightly gripping the door\'s top edge near her face, head tilted slightly to one side, lips slightly parted in a soft surprised / playful expression, eyes wide and curious looking straight at camera, gentle smile. Color grade: warm muted earth tones with soft mint accent from the chima and warm dark red from the wooden beams, refined natural traditional editorial mood — must clearly read as traditional indoor daylight, NOT golden hour, NOT studio.',
    manualKelvin: 4500,
    manualMoodHint:
      'traditional Korean hanok interior in soft warm natural daylight, mint chima and dove-gray jeogori with warm wood and teal wall accents, playful curious peek-around-door pose',
    // 신부 얼굴이 프레임 좌측 1/3 위치, 문 우측 edge 너머 — 살짝 좌측 치우침.
    faceMaskRegions: [[0.30, 0.12, 0.30, 0.30]],
  },
  {
    id: 'groom-monochrome-suit',
    label: '신랑 흑백 슈트',
    hint: '모노크롬 + 클래식 슈트 + 커프스 자세',
    category: 'studio',
    personality: 'groom-solo',
    intensity: 'low',
    image: '/wedding-snap/catalog/groom-monochrome-suit.png',
    promptHint:
      'Solo groom portrait — only the groom is in the frame, no bride, no other people. Monochrome black-and-white editorial portrait. Indoor studio with seamless soft gradient dark-gray to medium-gray backdrop, single soft directional key light from camera-left at 45° down, gentle fill from camera-right preserving shadow detail on the right side of the face and suit. Shot on 85mm portrait lens, waist-up framing, slight three-quarter (~10–15°) body angle to camera-right with face turned back toward camera, shallow depth of field. Groom: sharp black two-piece notch-lapel formal suit with a crisp white dress shirt and slim solid-black silk necktie tied neatly, jacket buttoned at the top button only, short neat dark hair brushed back, calm composed neutral expression with mouth softly closed, slight head tilt down catching shadow under the brow. Pose: both hands brought together near waist level, right hand gently adjusting the left jacket cuff / cuff link in a refined editorial gesture, eyes looking directly at camera with quiet confidence. Color grade: pure monochrome black-and-white film tones with rich deep blacks, smooth midtone grays and clean specular highlights on the shirt — must clearly read as classic B&W editorial menswear portrait, NOT color, NOT outdoor.',
    manualMoodHint:
      'monochrome black-and-white editorial menswear portrait with rich deep blacks, smooth gray midtones and clean white shirt highlights',
    // solo 반신 — 얼굴은 프레임 상단 중앙, 비교적 크게.
    faceMaskRegions: [[0.32, 0.08, 0.36, 0.32]],
  },
  {
    id: 'bride-villa-staircase',
    label: '신부 빌라 돌계단',
    hint: '돌계단 + 머메이드 + 긴 베일 + 산 배경',
    category: 'outdoor',
    personality: 'bride-solo',
    intensity: 'medium',
    image: '/wedding-snap/catalog/bride-villa-staircase.jpg',
    promptHint:
      'Solo bride shot — only the bride in frame, no groom, no other people. Outdoor European Mediterranean villa scene on a wide ornate carved-stone staircase ascending diagonally upward from lower-left to upper-right of the frame, antique baroque stone balustrade and large carved stone urns overflowing with vivid orange geraniums lining the steps, hazy distant green mountain ridges and soft pale-blue cloudy sky filling the upper background. Soft warm late-morning natural daylight from camera-right creating gentle rim on hair and the back of the gown. Shot on 50–85mm portrait lens, full-body framing, slight low-angle from a few steps below, shallow depth of field on the bride with creamy stone bokeh behind. Bride: ivory open-back mermaid wedding dress with delicate beaded lace bodice and dramatic voluminous layered tulle skirt cascading down the stone steps behind her, very long fine cathedral-length tulle veil floating diagonally across the frame to camera-right in a soft breeze, dark hair pulled back into a sleek smooth low chignon, dainty earrings, soft natural makeup, holding a small rounded bouquet of pale blue hydrangea and white florals in her left hand near her waist. Pose: standing on the staircase with body turned to climb upward (back toward camera) but face softly turned back over her right shoulder toward camera with a calm gentle natural smile, the open back and silhouette of the gown clearly visible. Color grade: warm cream highlights with soft pastel-blue sky and gentle terracotta accents from the geraniums, refined European luxury bridal editorial atmosphere — must clearly read as warm hazy daylight at a Mediterranean villa, NOT golden hour, NOT studio.',
    manualKelvin: 5200,
    manualMoodHint:
      'warm hazy late-morning daylight at a Mediterranean villa stone staircase, refined luxury bridal editorial, pastel-blue sky with cream stone and terracotta floral accents, flowing tulle veil',
    // 신부 얼굴은 프레임 중앙 약간 상단 — over-shoulder 자세로 작게 노출.
    faceMaskRegions: [[0.40, 0.22, 0.18, 0.18]],
  },
  {
    id: 'bride-paris-eiffel',
    label: '신부 파리 에펠탑',
    hint: '에펠탑 + 센강 돌난간 + 골든아워',
    category: 'outdoor',
    personality: 'bride-solo',
    intensity: 'high',
    image: '/wedding-snap/catalog/bride-paris-eiffel.jpg',
    promptHint:
      'Solo bride shot — only the bride in frame, no groom, no other people. Outdoor Paris scene seated on a weathered cream-stone Seine river embankment wall, iconic Eiffel Tower clearly visible in the soft-focus background slightly off-camera-left rising into a hazy warm peach golden-hour sky, the calm Seine river surface reflecting the warm light behind her with a couple of tour boats softly blurred at the far shore, Haussmannian Parisian rooftops faintly visible across the river. Strong warm low golden-hour sun from camera-right creating bright honey rim light on hair and a soft glowing halo behind the figure. Shot on 50–85mm portrait lens, full-body framing in tall vertical aspect, eye-level camera with bride positioned to camera-right and Eiffel Tower in the negative space to camera-left, shallow depth of field with creamy warm bokeh on the cityscape. Bride: soft champagne / pale ivory tulle wedding gown with a deep V-neckline plunging bodice and very voluminous flowing multi-layer tulle skirt cascading and draping luxuriously over the stone wall and down to the ground, long dark-brown softly waved hair flowing freely past her shoulders with subtle golden highlights catching the sun, dainty necklace, soft natural rosy makeup, holding a beautiful round bridal bouquet of cream-white garden roses, white lisianthus, and trailing eucalyptus greenery resting gently in her lap with both hands. Pose: seated sideways on the stone wall facing camera-right (toward the river / Eiffel Tower side) with body in profile, but face softly turned back over her right shoulder toward camera with a calm gentle warm smile and direct soft eye contact, posture relaxed and elegant. Color grade: cinematic warm honey-amber golden hour with soft peach sky, warm cream skin midtones, gentle film haze and grain — must clearly read as warm Paris golden hour, NOT noon, NOT blue hour, NOT studio.',
    manualKelvin: 3100,
    manualMoodHint:
      'Paris Eiffel Tower at warm honey-amber golden hour, soft peach sky with hazy rim-lit hair, romantic European luxury bridal editorial, gentle film grain',
    // 신부가 프레임 우측에 배치, 얼굴은 우측 상단 1/3 위치 — 에펠탑은 좌측 배경.
    faceMaskRegions: [[0.50, 0.22, 0.22, 0.20]],
  },
  {
    id: 'groom-meadow-bowtie',
    label: '신랑 잔디밭 보타이',
    hint: '푸른 잔디 + 보타이 슈트 + 부케 + 함박웃음',
    category: 'outdoor',
    personality: 'groom-solo',
    intensity: 'medium',
    image: '/wedding-snap/catalog/groom-meadow-bowtie.jpg',
    promptHint:
      'Solo groom portrait — only the groom is in the frame, no bride, no other people. Outdoor wide green grass meadow with low rolling forested hills in the distance, bright fluffy white cumulus clouds in a clean saturated blue sky filling the upper half of the frame, warm late-afternoon natural sunlight from camera-right creating gentle rim on hair and shoulders. Shot on 50–85mm portrait lens, three-quarter / knee-up framing, slight low-angle camera capturing both the groom and the sky, shallow depth of field on subject with soft green meadow bokeh behind. Groom: clean classic black two-piece notch-lapel formal suit with crisp white dress shirt and neat solid-black silk bow tie tied at the collar, top button fastened, short neat dark-brown side-swept hair with soft natural texture, bright big genuine open-mouth smile with teeth showing and warm crinkled eyes looking directly at camera. Pose: standing relaxed and centered on the lawn, body facing camera straight on with shoulders slightly squared back, left hand casually tucked into the trouser pocket, right hand naturally lowered at his side gently holding a small bouquet of fresh white garden roses, white spray roses, and trailing greenery — bouquet visible just at the lower-right of the frame near the hip. Color grade: bright airy outdoor daylight with saturated clean blue sky, fresh vivid greens and warm cream skin midtones, joyful fresh K-prewedding magazine atmosphere — must clearly read as bright warm late-afternoon daylight, NOT golden hour, NOT studio, NOT noon glare.',
    manualKelvin: 5500,
    manualMoodHint:
      'bright warm late-afternoon outdoor daylight in a green meadow under blue sky with white clouds, joyful big genuine smile, fresh saturated K-prewedding mood',
    // solo 풀신 — 얼굴은 프레임 중앙 상단, 비교적 작게.
    faceMaskRegions: [[0.40, 0.18, 0.22, 0.20]],
  },
  {
    id: 'groom-bouquet-sniff',
    label: '신랑 부케 향',
    hint: '스튜디오 + 흰 부케 + 향 맡는 자세',
    category: 'studio',
    personality: 'groom-solo',
    intensity: 'low',
    image: '/wedding-snap/catalog/groom-bouquet-sniff.jpg',
    promptHint:
      'Solo groom portrait — only the groom is in the frame, no bride, no other people. Indoor studio with seamless soft cool light-gray painted backdrop, single soft large diffused key light from camera-left at 45° creating gentle clean highlights on the face and suit lapel with very soft fall-off shadow on the right side, no harsh shadows. Shot on 85mm portrait lens, three-quarter (knee-up) framing, eye-level camera, shallow depth of field. Groom: sharp tailored black two-piece notch-lapel formal suit with crisp white dress shirt (collar unbuttoned at the very top, no tie) and a small fresh white floral boutonniere pinned to the left lapel, short neat dark-brown side-swept hair with soft natural texture, calm soft serene closed-eyes expression with a gentle peaceful half-smile. Pose: standing centered facing camera, right hand tucked casually into the trouser pocket, left hand raised holding a beautiful lush bridal bouquet of white lilies, white carnations, white spray roses and trailing eucalyptus greenery (wrapped at the stems with a soft ivory satin ribbon trailing down) lifted gently up to his face so he can softly close his eyes and breathe in the floral scent — refined romantic editorial moment of a groom enjoying the bouquet. Color grade: cool airy light-gray backdrop with clean warm cream skin midtones and rich black suit tones, calm refined minimalist K-prewedding studio editorial atmosphere — must clearly read as soft indoor studio diffused light, NOT outdoor, NOT golden hour.',
    // solo 반신 — 얼굴은 프레임 상단, 부케에 살짝 가려져 있어 region 은 살짝 우측 + 좁게.
    faceMaskRegions: [[0.38, 0.14, 0.30, 0.30]],
  },
];

export const isSnapCatalogId = (v: string): boolean =>
  SNAP_CATALOG.some((c) => c.id === v);

export const findSnapCatalog = (id: string): SnapCatalogItem | undefined =>
  SNAP_CATALOG.find((c) => c.id === id);
