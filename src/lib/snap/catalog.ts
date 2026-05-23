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
  /**
   * (선택) true 면 카탈로그/스냅생성 picker 양쪽에서 숨김.
   * 사용 케이스:
   *   - 마스터 이미지가 아직 안 올라온 항목 (정의는 유지하고 노출만 차단)
   *   - 운영 중에 일시적으로 내릴 항목
   * 과거 생성물 lookup (`findSnapCatalog`) 은 hidden 무시하므로 마이페이지에서
   *  여전히 라벨이 보인다. 새 선택만 차단.
   */
  hidden?: boolean;
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
    hidden: true, // 마스터 이미지 미업로드
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
    hidden: true, // 마스터 이미지 미업로드
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
    hidden: true, // 마스터 이미지 미업로드 (city-goldenhour-balcony 가 유사 컨셉으로 신규 추가됨)
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
    hidden: true, // 마스터 이미지 미업로드
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
    image: '/wedding-snap/catalog/studio-couple-puppy.jpg',
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
    image: '/wedding-snap/catalog/studio-couple-overhead.jpg',
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
    image: '/wedding-snap/catalog/countryside-bicycle-sunset.jpg',
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
  {
    id: 'garden-champagne-toast',
    label: '가든 샴페인 토스트',
    hint: '정원 + 샴페인 + 보타이 + 슬립 드레스',
    category: 'outdoor',
    personality: 'together',
    intensity: 'low',
    image: '/wedding-snap/catalog/garden-champagne-toast.jpg',
    promptHint:
      'Outdoor refined private garden scene with lush dense green foliage and tall white delphinium / hydrangea blooms filling the entire background, bright warm late-morning natural sunlight filtering through the leaves creating soft dappled highlights on hair and shoulders, no harsh shadows. Couple seated together at a small round table draped in soft ivory linen, set with a polished silver champagne bucket holding a chilled bottle, two cream taper candles in silver candlesticks, and a silver footed bowl of fresh green grapes and yellow pears in the foreground. Shot on 50–85mm portrait lens, three-quarter (waist-up) framing, slight low-angle camera, shallow depth of field with creamy floral bokeh behind. Groom: black peak-lapel formal suit with crisp white shirt, neat solid-black silk bow tie, and a single small white rose boutonniere on the lapel, short neat dark hair, calm warm soft smile. Bride: ivory champagne silk satin spaghetti-strap slip wedding dress with delicate cowl neckline, long dark hair pulled back in a clean smooth low chignon, dainty drop earrings, soft natural rosy makeup, big bright genuine open-mouth laughing smile while looking warmly at the groom. Pose: seated face-to-face at the table, both raising matching coupé-style champagne glasses to clink in a romantic toast at chest level, bride leaning warmly toward groom with one hand on his arm. Color grade: bright airy outdoor whites with fresh saturated garden greens and warm cream skin midtones, refined romantic European garden editorial atmosphere — must clearly read as warm bright late-morning daylight in a private garden, NOT golden hour, NOT studio.',
    manualKelvin: 5400,
    manualMoodHint:
      'bright warm late-morning daylight in a refined private garden with white florals and lush greenery, romantic champagne toast moment, joyful candid laughter, airy European editorial mood',
    // 신랑(왼쪽), 신부(오른쪽) — 마주보고 앉아 잔 부딪치는 자세, 얼굴은 거의 같은 높이.
    faceMaskRegions: [
      [0.26, 0.18, 0.20, 0.22],
      [0.56, 0.18, 0.20, 0.22],
    ],
  },
  {
    id: 'studio-couple-blackwhite',
    label: '흑백 스튜디오 풀신',
    hint: '모노크롬 + 클래식 풀신 + 부케',
    category: 'studio',
    personality: 'together',
    intensity: 'low',
    image: '/wedding-snap/catalog/studio-couple-blackwhite.jpg',
    promptHint:
      'Indoor studio with seamless soft warm-gray gradient backdrop, monochrome black-and-white editorial portrait. Single soft large diffused key light from camera-left at 45° creating gentle clean highlights and very soft fall-off shadow, no harsh shadows. Shot on 50–85mm portrait lens, full-body framing capturing the bride and groom head-to-toe, eye-level camera, shallow depth of field. Bride: clean ivory satin V-neck wedding dress with elegant short puff sleeves and small pearl-button front detail down the bodice, soft natural A-line skirt grazing the floor, long dark hair pulled back into a smooth low bun with side wisps, dainty pearl drop earrings, soft natural makeup with quiet warm smile, holding a small loose bouquet of dried baby\'s breath wrapped with a thin ivory ribbon down low at her right hip. Groom: sharp black peak-lapel two-piece formal tuxedo with crisp white shirt, neat solid-black silk bow tie, and a delicate white baby\'s-breath boutonniere on the left lapel, short neat dark side-swept hair, calm warm closed-mouth genuine smile, polished black oxford shoes. Pose: standing very close side-by-side facing camera straight on, the bride to camera-left and groom to camera-right, groom\'s right arm gently linked around the bride\'s waist with hand softly visible at her side, both shoulders slightly squared back and warm direct eye contact with camera. Color grade: pure monochrome black-and-white film tones with rich deep blacks on the tuxedo, smooth midtone grays on the backdrop, clean specular highlights on the dress satin and shirt — must clearly read as classic timeless B&W K-prewedding studio editorial, NOT color, NOT outdoor.',
    manualMoodHint:
      'monochrome black-and-white classic K-prewedding studio full-body editorial with rich deep blacks, smooth gray midtones and clean satin highlights',
    // 신부(왼쪽), 신랑(오른쪽) — 풀신 정자세 투샷, 얼굴은 프레임 상단.
    faceMaskRegions: [
      [0.30, 0.14, 0.16, 0.18],
      [0.54, 0.14, 0.16, 0.18],
    ],
  },
  {
    id: 'studio-shoulder-lean',
    label: '스튜디오 어깨 기댐 클로즈업',
    hint: '화이트 배경 + 머리 맞댄 클로즈업 + 흰 부케',
    category: 'studio',
    personality: 'together',
    intensity: 'low',
    image: '/wedding-snap/catalog/studio-shoulder-lean.jpg',
    promptHint:
      'Indoor studio with seamless soft bright white painted backdrop, soft large diffused beauty light from front-center and slightly above creating clean luminous skin tones and very gentle shadows, no harsh shadows. Shot on 85mm portrait lens, chest-up close framing with both faces nearly cheek-to-cheek and centered, eye-level camera, shallow depth of field. Groom: sharp medium-gray notch-lapel formal suit jacket with crisp white shirt and slim black silk necktie, short neat dark side-swept hair, calm cool composed soft neutral expression with quiet eyes looking directly at camera. Bride: strapless ivory wedding dress with delicate ruched bodice (visible at lower edge of frame), long dark-brown softly waved hair flowing freely past her shoulder with side parting, dainty crystal-drop earring on the visible ear, soft natural makeup with rosy lip and warm bright genuine smile looking directly at camera. Pose: couple standing very close together with bride to camera-right gently leaning her head and temple onto the groom\'s left shoulder, the groom standing straight and tall to camera-left, both clearly facing camera with warm direct eye contact, in the foreground at the bottom of the frame the bride lifts a lush round bouquet of white garden roses, ivory spray roses and trailing greenery softly into view just below their chests. Color grade: bright airy whites with clean warm cream skin midtones, very low contrast, dreamy minimalist K-prewedding beauty editorial — must clearly read as soft indoor studio beauty light, NOT outdoor, NOT golden hour.',
    // 신랑(왼쪽), 신부(오른쪽, 어깨에 기댐) — 클로즈업 투샷, 얼굴이 프레임 큰 비중 차지.
    faceMaskRegions: [
      [0.18, 0.10, 0.32, 0.40],
      [0.50, 0.16, 0.32, 0.40],
    ],
  },
  {
    id: 'yacht-sunset-hug',
    label: '요트 일몰 백허그',
    hint: '요트 갑판 + 화이트 린넨 + 잔잔한 바다',
    category: 'beach',
    personality: 'together',
    intensity: 'high',
    image: '/wedding-snap/catalog/yacht-sunset-hug.jpg',
    promptHint:
      'Outdoor scene on the polished wooden teak deck of a private sailing yacht moored on calm pastel-pink open sea at warm late-afternoon golden hour, white sail mast and stainless steel railing softly visible at the edges of the frame, distant hazy island silhouette barely visible on the horizon to camera-left, soft warm peach and lavender sunset sky filling the upper background, gentle warm sun from camera-left creating soft rim light on hair and shoulders. Shot on 35–50mm lens for environmental sailing feel, three-quarter (knee-up) framing, slight low-angle camera, shallow depth of field on the couple. Groom: relaxed cream / off-white linen long-sleeve shirt (loose fit, top buttons casually undone) with rolled-up cream linen trousers, bare feet on the warm teak deck, short tousled dark hair gently moved by the sea breeze, bright big genuine open-mouth laughing smile with eyes softly squinted in the warm sun. Bride: simple soft ivory spaghetti-strap slip dress (just above knee length) with delicate cowl neckline, long honey-brown softly waved hair flowing freely in the sea breeze, dainty drop earrings, soft natural makeup with rosy lip, bright big warm laughing smile. Pose: groom seated relaxed on the wooden deck with knees slightly bent, bride seated close behind him wrapping both arms warmly around his shoulders and chest from behind in a gentle back-hug, leaning her cheek tenderly against his temple, both laughing brightly together in a candid joyful sun-soaked moment. Color grade: cinematic warm peach-amber sky with soft cool blue ocean midtones, warm cream skin highlights and gentle hazy sunset glow, film softness — must clearly read as warm romantic golden-hour ocean sailing, NOT noon, NOT blue hour, NOT studio.',
    manualKelvin: 3200,
    manualMoodHint:
      'romantic warm golden-hour ocean sailing on a private yacht with peach sky and soft pink sea, candid joyful back-hug moment, gentle sea breeze and film softness',
    // 신랑(왼쪽·중앙, 앞쪽), 신부(오른쪽·약간 위, 뒤에서 백허그) — 갑판 투샷 추정치.
    faceMaskRegions: [
      [0.34, 0.20, 0.18, 0.20],
      [0.54, 0.16, 0.18, 0.20],
    ],
  },
  {
    id: 'conservatory-sofa-couple',
    label: '온실 화이트 소파',
    hint: '온실 유리벽 + 화이트 카우치 + 네이비 슈트',
    category: 'studio',
    personality: 'together',
    intensity: 'low',
    image: '/wedding-snap/catalog/conservatory-sofa-couple.jpg',
    promptHint:
      'Indoor bright conservatory / glass-house living room scene with floor-to-ceiling white-framed glass windows behind the couple, lush tropical green palm fronds and foliage softly visible outside in the green-bokeh garden behind, soft warm diffused natural daylight pouring in from the windows creating gentle clean highlights on the couple and the cream sofa, no harsh shadows. Shot on 50–85mm portrait lens, three-quarter (waist-up) framing, eye-level camera, shallow depth of field. Couple seated very close together on a clean cream-upholstered modern sofa. Bride: strapless ivory layered tulle wedding gown with delicate ruched sweetheart neckline and voluminous skirt cascading across the sofa, long dark-brown softly waved hair with soft side-parted bangs flowing freely past her shoulders, dainty small gold ring on visible hand, soft natural rosy makeup with warm bright smile, seated to camera-left leaning her head and temple gently onto the groom\'s right shoulder, one hand softly resting at her chin in a relaxed pose. Groom: clean tailored deep navy two-piece notch-lapel formal suit with crisp white shirt (no tie, top button casually unbuttoned), short neat dark side-swept hair, calm warm genuine bright closed-mouth smile, both hands gently clasped together resting on his knees, seated to camera-right with his shoulders squared toward camera. Pose: both clearly facing camera with warm direct eye contact and big natural smiles, relaxed intimate K-prewedding magazine moment. Color grade: bright airy whites with fresh saturated tropical greens softly blurred behind, clean warm cream skin midtones — must clearly read as soft warm indoor natural-window-light conservatory, NOT outdoor, NOT golden hour.',
    // 신부(왼쪽, 어깨에 기댐), 신랑(오른쪽, 정자세) — 소파 투샷 추정치.
    faceMaskRegions: [
      [0.20, 0.18, 0.22, 0.24],
      [0.54, 0.20, 0.22, 0.24],
    ],
  },
  {
    id: 'tokyo-alley-couple',
    label: '도쿄 골목 자판기',
    hint: '도쿄 골목 + 자판기 + 검정 머메이드 + 베이지 슈트',
    category: 'urban',
    personality: 'together',
    intensity: 'medium',
    image: '/wedding-snap/catalog/tokyo-alley-couple.jpg',
    promptHint:
      'Outdoor narrow Japanese back-alley street scene in a Tokyo old-town district at warm late-afternoon daylight (soft hazy daylight, NOT golden hour, NOT noon). A row of glowing red/yellow Asahi vending machines lining the left side of the alley, mid-rise old buildings on both sides with hanging Japanese hiragana/katakana shop signs (e.g., ケンク, おわそ) softly visible deeper in the alley, a bicycle parked against a wall in the mid-background, red brick pavement underfoot. Shot on 35–50mm lens for environmental travel feel, full-body framing in tall vertical aspect, slight low-angle camera, shallow depth of field on the couple with creamy alley bokeh behind. Bride: sleek floor-length black satin halter-neck mermaid wedding dress with subtle small slit and small sweep train trailing behind, long dark-brown straight hair with soft side-parted bangs flowing freely past her shoulders, dainty drop earrings, soft natural makeup with rosy lip, holding a small rustic dried bouquet of pampas and orange-tinted dried florals wrapped with twine at her side, calm cool serene neutral expression. Groom: tailored warm beige / camel-tan two-piece notch-lapel formal suit with crisp light-blue striped dress shirt and dark slim necktie, dark brown leather oxford shoes, short neat dark side-swept hair, calm cool serene neutral expression. Pose: bride and groom standing close back-to-back on the alley pavement, bride to camera-left turned slightly toward camera with one shoulder open to lens looking softly at camera over her left shoulder, groom to camera-right standing tall straight at camera, both calm serene editorial neutral expressions (no smiles), refined K-prewedding travel editorial mood. Color grade: warm desaturated earth tones with rich blacks on the dress, muted warm beige on the suit, soft red glow from the vending machines as warm accent, gentle film grain — must clearly read as warm hazy late-afternoon Tokyo alley travel scene, NOT golden hour, NOT studio.',
    manualKelvin: 4800,
    manualMoodHint:
      'warm hazy late-afternoon Tokyo back-alley travel editorial with red vending machine glow, refined cool neutral K-prewedding mood, gentle film grain',
    // 신부(왼쪽), 신랑(오른쪽) — back-to-back 풀신 자세.
    faceMaskRegions: [
      [0.20, 0.30, 0.18, 0.18],
      [0.56, 0.22, 0.18, 0.18],
    ],
  },
  {
    id: 'wall-casual-noir',
    label: '캐주얼 흑백 벽 + 선글라스',
    hint: '벨벳 드레스 + 들꽃 + 선글라스 흑백',
    category: 'outdoor',
    personality: 'together',
    intensity: 'low',
    image: '/wedding-snap/catalog/wall-casual-noir.jpg',
    promptHint:
      'Outdoor scene against a plain weathered cream-painted plaster wall with subtle texture, weathered wooden plank floor visible at the bottom of the frame, soft even diffused daylight (overcast / shaded), monochrome black-and-white editorial portrait. Shot on 50–85mm portrait lens, full-body framing in tall vertical aspect, eye-level camera, deep depth of field with subject sharp against the wall. Bride: short-puff-sleeve dark velvet midi dress (knee-length, fitted silhouette), holding a small loose bouquet of fresh daisies and dried wheat stems casually at chest level with both hands, hair pulled back into a clean low updo, small black cat-eye sunglasses, chunky black lace-up combat boots, calm cool serene neutral expression with closed mouth. Groom: black fine-knit round-neck long-sleeve sweater with crisp white turtleneck inner peeking at the collar, dark straight trousers, polished black derby shoes, short neat dark side-swept hair, large black square sunglasses, both hands casually tucked into trouser pockets, calm cool serene neutral expression with closed mouth. Pose: standing side-by-side against the wall facing camera straight on, bride to camera-left, groom to camera-right leaning relaxed with one shoulder slightly tilted toward the wall, both in a calm cool retro-90s gen-Z editorial pose with sunglasses on and no smiles. Color grade: pure monochrome black-and-white film tones with rich deep blacks, smooth midtone grays on the plaster wall, clean specular highlights — must clearly read as classic timeless B&W vintage editorial casual K-prewedding, NOT color, NOT golden hour, NOT studio.',
    manualMoodHint:
      'monochrome black-and-white retro gen-Z 90s casual editorial against a textured plaster wall, both wearing sunglasses with cool neutral expressions, film softness',
    // 신부(왼쪽), 신랑(오른쪽) — 풀신 정자세 투샷.
    faceMaskRegions: [
      [0.22, 0.12, 0.18, 0.18],
      [0.54, 0.10, 0.18, 0.18],
    ],
  },
  {
    id: 'jeju-stonewall-cheer',
    label: '제주 돌담 부케 환호',
    hint: '제주 현무암 돌담 + 푸른 바다 + 부케 환호',
    category: 'beach',
    personality: 'together',
    intensity: 'medium',
    image: '/wedding-snap/catalog/jeju-stonewall-cheer.jpg',
    promptHint:
      'Outdoor scene on top of a low traditional Jeju-island volcanic basalt stone wall with the deep blue ocean and rocky coastline stretching to a clear sharp horizon behind, bright saturated blue sky with fluffy white cumulus clouds filling the upper background, bright warm late-morning natural sunlight from camera-front-right creating clean highlights, no harsh shadows. Shot on 50–85mm portrait lens, full-body framing in tall vertical aspect, slight low-angle camera, shallow depth of field on the couple. Groom: clean warm beige / oatmeal-tan two-piece notch-lapel formal suit with crisp white shirt and slim dark-navy necktie, dark brown leather oxford shoes, short neat dark side-swept hair, calm warm genuine closed-mouth smile, seated relaxed on the stone wall with knees casually crossed. Bride: strapless ivory layered tulle ball-gown wedding dress with delicate ruched sweetheart bodice and dramatic voluminous skirt cascading lushly down the stone wall and onto the rocks, long dark-brown hair pulled back into a soft loose low bun with side wisps, soft natural rosy makeup with bright big genuine open-mouth laughing smile, seated close beside groom on the wall with body slightly leaning toward him. Pose: both seated together on the basalt stone wall, bride to camera-right enthusiastically raising her right arm high above her head holding a beautiful small round bouquet of pink garden roses, white spray roses and fresh greenery in a joyful celebratory cheer gesture, groom to camera-left looking warmly at the bride with a calm content smile, both faces clearly visible. Color grade: bright airy outdoor whites with deep saturated ocean blues and clean warm cream skin midtones, fresh joyful Korean coastal K-prewedding magazine atmosphere — must clearly read as warm bright late-morning daylight at the Jeju coast, NOT golden hour, NOT studio.',
    manualKelvin: 5500,
    manualMoodHint:
      'bright warm late-morning daylight at the Jeju basalt-stone coast under blue sky and deep blue ocean, joyful celebratory bouquet-cheer moment, fresh Korean coastal K-prewedding mood',
    // 신랑(왼쪽), 신부(오른쪽, 부케 들고 환호) — 풀신 앉은 투샷.
    faceMaskRegions: [
      [0.26, 0.34, 0.18, 0.18],
      [0.56, 0.36, 0.18, 0.18],
    ],
  },
  {
    id: 'paris-bridge-night',
    label: '파리 다리 야경',
    hint: '파리 다리 + 가로등 + 부케 환호 + 트위드',
    category: 'urban',
    personality: 'together',
    intensity: 'high',
    image: '/wedding-snap/catalog/paris-bridge-night.jpg',
    promptHint:
      'Outdoor scene on a Parisian stone bridge over the Seine river at warm blue-hour twilight, ornate vintage black wrought-iron street lamp with warm tungsten glow standing prominently to camera-right behind the groom, distant Haussmannian Parisian rooftops and faint Notre-Dame-style spires softly visible in the deep blue-purple dusk sky on the horizon, the river surface and distant city lights softly bokeh-blurred behind, cobblestone pavement and decorative iron railing along the bridge. Shot on 35–50mm lens for environmental travel feel, full-body framing in tall vertical aspect, slight low-angle camera with sky filling upper background, shallow depth of field on the couple. Bride: clean ivory off-shoulder satin A-line wedding dress with delicate ruched sweetheart bodice and softly draped knee-length skirt, long dark-brown softly waved hair flowing freely past her shoulders, dainty drop earrings, soft natural rosy makeup with bright big genuine open-mouth laughing smile. Groom: vintage warm brown tweed three-piece formal suit (jacket + matching waistcoat + trousers) with crisp light-blue dress shirt and slim brown silk necktie, polished brown leather oxford shoes, short neat dark side-swept hair with subtle vintage texture, bright big genuine open-mouth laughing smile. Pose: bride to camera-left enthusiastically leaning back against the iron railing with right arm raised high holding a small round bouquet of pink garden roses and greenery in a joyful celebratory cheer, left arm extended out to the side in playful motion, groom to camera-right one arm wrapped warmly around the lamppost leaning out playfully with other arm extended in mirrored cheer pose, both laughing brightly together in a candid joyful retro travel moment. Color grade: cinematic deep blue-purple twilight sky with warm tungsten lamp glow as accent, soft warm skin midtones lit by the lamp, gentle film grain — must clearly read as warm romantic Paris blue-hour evening travel, NOT noon, NOT golden hour, NOT studio.',
    manualKelvin: 4200,
    manualMoodHint:
      'Paris bridge at warm blue-hour twilight with vintage tungsten street-lamp glow, joyful celebratory retro travel editorial, candid laughter, cinematic film grain',
    // 신부(왼쪽), 신랑(오른쪽, 가로등 옆) — 풀신 환호 자세.
    faceMaskRegions: [
      [0.22, 0.34, 0.16, 0.16],
      [0.54, 0.30, 0.16, 0.16],
    ],
  },
  {
    id: 'jeju-rocky-coast',
    label: '제주 해안 정자세',
    hint: '제주 해안 현무암 + 푸른 하늘 + 단정 정자세',
    category: 'beach',
    personality: 'together',
    intensity: 'medium',
    image: '/wedding-snap/catalog/jeju-rocky-coast.jpg',
    promptHint:
      'Outdoor scene standing on rugged dark volcanic basalt rocks at the Jeju-island coastline with the deep blue ocean stretching to a clean sharp horizon behind, bright saturated blue sky with fluffy white cumulus clouds filling the upper background, dry pale beige beach grass scattered around the rocks, bright warm late-morning natural sunlight from camera-front-right creating clean soft highlights, no harsh shadows. Shot on 50–85mm portrait lens, full-body framing in tall vertical aspect, slight low-angle camera, shallow depth of field on the couple. Bride: ivory long-sleeve high-neck illusion-lace wedding dress with delicate scattered floral lace embroidery on the bodice and soft voluminous A-line tulle skirt cascading down to the rocks, long dark-brown hair pulled back into a soft low bun with side wisps, dainty drop earrings, soft natural rosy makeup with quiet warm closed-mouth smile, holding a small loose bouquet of fresh white spray roses and trailing greenery at her right hip with both hands. Groom: sharp black peak-lapel two-piece formal tuxedo with crisp white shirt, neat solid-black silk necktie, and a delicate white floral boutonniere on the left lapel, polished black oxford shoes, short neat dark side-swept hair, calm warm genuine closed-mouth smile. Pose: couple standing very close together facing camera straight on with shoulders slightly squared, bride to camera-left with body slightly turned toward groom, groom to camera-right tall and straight with right arm bent at elbow gently linked with bride\'s left arm at her hand, both in calm refined editorial standing pose with warm direct eye contact and quiet natural smiles. Color grade: bright airy outdoor whites with deep saturated ocean blues and clean warm cream skin midtones, refined classic Korean coastal K-prewedding magazine atmosphere — must clearly read as warm bright late-morning daylight at the Jeju coast, NOT golden hour, NOT studio.',
    manualKelvin: 5500,
    manualMoodHint:
      'bright warm late-morning daylight at the Jeju basalt coast under blue sky and deep blue ocean, refined classic upright Korean coastal K-prewedding mood',
    // 신부(왼쪽), 신랑(오른쪽) — 풀신 정자세 투샷.
    faceMaskRegions: [
      [0.22, 0.20, 0.16, 0.16],
      [0.52, 0.20, 0.16, 0.16],
    ],
  },
  {
    id: 'city-goldenhour-balcony',
    label: '도심 골든아워 발코니',
    hint: '발코니 돌난간 + 도심 스카이라인 + 강한 백라이트',
    category: 'urban',
    personality: 'together',
    intensity: 'high',
    image: '/wedding-snap/catalog/city-goldenhour-balcony.jpg',
    promptHint:
      'Outdoor scene on an ornate carved-stone balcony overlooking a distant downtown city skyline at warm late-afternoon golden hour (strong warm low sun directly behind the couple creating strong honey-amber backlight with subtle lens flare and warm hazy atmosphere, distant skyscrapers and rolling hills softly silhouetted in the hazy sky to camera-right). Carved baroque stone balustrade with decorative columns visible to camera-left and along the lower foreground, soft warm breeze gently moving the bride\'s long hair. Shot on 50–85mm portrait lens, three-quarter / waist-up framing, eye-level camera, shallow depth of field with cinematic warm sun-flare. Groom: clean black notch-lapel two-piece formal suit with crisp white shirt and slim solid-black silk necktie, short neat dark side-swept hair with soft natural texture, calm warm soft genuine closed-mouth smile, standing close behind and slightly to camera-left of bride. Bride: clean ivory off-shoulder satin A-line wedding dress with elegant ruched ruffle neckline and softly draped sweetheart bodice, long honey-brown softly waved hair flowing freely past her shoulders catching warm rim light, dainty drop earrings, soft natural rosy makeup with warm gentle closed-mouth smile, holding a beautiful round bridal bouquet of white garden roses, white spray roses and trailing greenery in both hands resting gently at her waist. Pose: intimate close together — groom leaning in to softly press his cheek tenderly against the bride\'s left temple from behind-left, his right arm wrapped warmly around her waist with hand softly resting on her hip, bride looking softly toward camera with quiet warm natural smile while groom looks lovingly down at her. Color grade: cinematic honey-amber highlights with gentle teal shadows, slight film haze and grain — must clearly read as warm late-afternoon golden hour with strong backlight, NOT noon, NOT blue hour, NOT studio.',
    manualKelvin: 3000,
    manualMoodHint:
      'cinematic warm golden-hour balcony backlit moment with honey-amber highlights, teal shadows, soft sun-flare and warm rim-lit hair, romantic K-prewedding mood',
    // 신랑(왼쪽 상단, 신부 뒤에서 기댐), 신부(오른쪽, 살짝 앞쪽).
    faceMaskRegions: [
      [0.22, 0.16, 0.20, 0.22],
      [0.50, 0.20, 0.22, 0.24],
    ],
  },
  {
    id: 'agave-rustwall-couple',
    label: '아가베 + 적갈색 벽 어반네추럴',
    hint: '적갈색 벽 + 용설란 + 캐주얼 어반네추럴',
    category: 'outdoor',
    personality: 'together',
    intensity: 'medium',
    image: '/wedding-snap/catalog/agave-rustwall-couple.jpg',
    promptHint:
      'Outdoor refined urban-natural scene against a large rich rust-red / terracotta painted vertical wood-plank wall filling the entire background, a large blue-green agave succulent plant in the foreground-left at ground level, warm sandy-beige ground underfoot. Soft warm late-afternoon natural daylight from camera-front creating clean even highlights with no harsh shadows. Shot on 50–85mm portrait lens, full-body framing in tall vertical aspect, slight low-angle camera, shallow depth of field on the couple with crisp wall texture behind. Bride: clean ivory long-sleeve high-mock-neck fitted floor-length mermaid dress with subtle thigh-high slit, short softly-curled bob-length dark hair, deep rich burgundy lip, dainty drop earrings, calm cool serene neutral expression, holding a small loose bouquet of dried deep-burgundy garden roses and dried wheat stems casually at her right side. Groom: warm camel / caramel-brown short-sleeve knit polo shirt tucked into dark chocolate-brown straight wide-leg trousers with a thin brown leather belt, polished brown leather loafers, longer tousled dark hair with soft natural texture, calm cool serene neutral expression with both hands tucked into trouser pockets, leaning relaxed against the wall. Pose: bride to camera-left standing tall and straight close beside groom, groom to camera-right leaning one shoulder casually against the wall, both calmly facing camera with refined editorial neutral expressions (no smiles), warm earth-toned styling. Color grade: warm saturated rust-red wall tones with creamy ivory dress, deep blue-green agave and warm cream skin midtones, refined Korean editorial earth-toned K-prewedding magazine atmosphere — must clearly read as warm late-afternoon outdoor natural daylight, NOT golden hour, NOT studio.',
    manualKelvin: 5000,
    manualMoodHint:
      'warm late-afternoon outdoor daylight against a rich rust-red wood-plank wall with blue-green agave accent, refined editorial earth-toned styling, cool neutral expressions',
    // 신부(왼쪽), 신랑(오른쪽, 벽에 기댐) — 풀신 정자세 투샷, 얼굴은 프레임 상단.
    faceMaskRegions: [
      [0.32, 0.16, 0.16, 0.16],
      [0.54, 0.14, 0.16, 0.16],
    ],
  },
  {
    id: 'studio-classic-greenbouquet',
    label: '클래식 스튜디오 그린 부케',
    hint: '시멘트 벽 + 풀턱 튤 + 그린 폭포 부케',
    category: 'studio',
    personality: 'together',
    intensity: 'low',
    image: '/wedding-snap/catalog/studio-classic-greenbouquet.jpg',
    promptHint:
      'Indoor studio with seamless soft warm-gray textured concrete-style painted wall backdrop, soft warm diffused front beauty light creating clean luminous highlights on the couple with very gentle fall-off shadows on the floor, no harsh shadows. Shot on 50–85mm portrait lens, full-body framing in tall vertical aspect capturing the couple head-to-toe, eye-level camera, shallow depth of field. Bride: ivory champagne off-shoulder long-sleeve sheer-tulle puff-sleeve A-line wedding ball-gown with delicate beaded sweetheart bodice and dramatic voluminous tulle skirt cascading lushly to the floor with subtle sweep train, long dark-brown softly waved hair flowing freely past her shoulders with side parting, dainty drop earrings, soft natural rosy makeup with warm bright closed-mouth smile, holding a beautiful lush trailing cascade bouquet of white garden roses, white ranunculus and abundant cascading fresh green eucalyptus, ivy and trailing greenery dropping dramatically down past her waist. Groom: sharp black peak-lapel three-piece formal suit (jacket + matching waistcoat + trousers) with crisp white dress shirt, neat solid-black silk necktie, and a small fresh white floral boutonniere on the left lapel, short neat dark side-swept hair, calm warm genuine bright closed-mouth smile, standing tall and straight beside the bride. Pose: bride to camera-left and groom to camera-right standing very close together facing camera straight on, bride\'s right hand holding the trailing bouquet at chest level with greenery cascading down, groom\'s left arm gently linked with bride\'s right arm at the elbow, both warmly facing camera with soft direct eye contact and gentle natural smiles. Color grade: bright airy whites with clean warm cream skin midtones and fresh green floral accents, refined classic Korean studio K-prewedding magazine atmosphere — must clearly read as soft warm indoor studio light, NOT outdoor, NOT golden hour.',
    // 신부(왼쪽, 머리 약간 낮음 — 키 차이), 신랑(오른쪽 약간 위) — 풀신 정자세.
    faceMaskRegions: [
      [0.32, 0.12, 0.16, 0.16],
      [0.56, 0.08, 0.16, 0.18],
    ],
  },
  {
    id: 'city-walk-vsign-noir',
    label: '흑백 도심 워킹 V사인',
    hint: '도심 거리 + 화이트 슈트 + 선글라스 + V사인',
    category: 'urban',
    personality: 'together',
    intensity: 'medium',
    image: '/wedding-snap/catalog/city-walk-vsign-noir.jpg',
    promptHint:
      'Outdoor downtown city street scene walking past Haussmannian / Beaux-Arts stone European-style ornate stone facade buildings (column carvings visible to camera-left), a vintage black wrought-iron street lamp visible mid-frame and parked classic black sedans softly visible to camera-right, distant pointed cathedral / cathedral spire softly visible deeper in the street, monochrome black-and-white editorial portrait. Bright warm midday natural daylight from camera-front creating clean even highlights. Shot on 50–85mm portrait lens, chest-up close framing, eye-level camera, shallow depth of field on the couple with creamy city bokeh behind. Groom: crisp clean ivory / off-white two-piece notch-lapel formal linen suit jacket with matching white inner crew-neck tank top (no shirt + tie), short neat dark side-swept hair, large black square wayfarer sunglasses, calm cool soft confident closed-mouth smile, both hands clasped together softly in front at chest level. Bride: clean ivory off-shoulder asymmetric draped satin mini cocktail dress with structured sweetheart neckline, hair pulled back neatly with a clean white satin headband, dainty earrings, soft natural rosy makeup with bright big genuine open-mouth laughing smile, right hand raised flirtatiously near her face making a playful V peace sign with fingers. Pose: standing close together walking down the sidewalk side-by-side, bride to camera-right gently linking her left arm warmly around the groom\'s right arm and looking softly at camera with playful smile + V sign, groom to camera-left standing tall facing camera straight on with cool confident smile, refined retro K-prewedding travel editorial moment. Color grade: pure monochrome black-and-white film tones with rich deep blacks, smooth midtone grays and clean specular highlights, gentle film grain — must clearly read as classic timeless B&W urban editorial travel portrait, NOT color, NOT studio, NOT golden hour.',
    manualMoodHint:
      'monochrome black-and-white retro classic K-prewedding city-walk travel editorial with cool confident styling, V-sign playful charm, gentle film grain',
    // 신랑(왼쪽, 선글라스), 신부(오른쪽, V사인) — 클로즈업 투샷.
    faceMaskRegions: [
      [0.20, 0.10, 0.30, 0.42],
      [0.52, 0.18, 0.26, 0.36],
    ],
  },
  {
    id: 'studio-noir-floor-purple',
    label: '화이트 바닥 검정 드레스 라일락',
    hint: '화이트 바닥 + 검정 할터넥 + 라일락 부케',
    category: 'studio',
    personality: 'together',
    intensity: 'low',
    image: '/wedding-snap/catalog/studio-noir-floor-purple.jpg',
    promptHint:
      'Indoor studio with seamless pure bright white painted wall and matching white seamless floor backdrop, soft large diffused front beauty light from front-center creating clean luminous highlights and very soft shadow under the couple, no harsh shadows. Couple seated relaxed close together on the white floor. Shot on 50–85mm portrait lens, full-body framing in tall vertical aspect capturing the couple head-to-toe with floor space below, eye-level camera at floor height, shallow depth of field. Bride: elegant sleeveless black flowing chiffon halter-neck floor-length dress with high neck collar and dramatic floor-pooling skirt cascading across the white floor to camera-left, hair pulled back into a clean smooth low bun with side bang, long dramatic dangling crystal-chandelier silver earrings catching the light, deep rich burgundy lip, soft natural makeup with warm bright closed-mouth smile, seated to camera-left with legs softly folded under the skirt and pointed pumps peeking out. Groom: clean black peak-lapel notch-lapel two-piece formal suit with matching black inner crew-neck turtleneck (no shirt + tie), short neat dark side-swept hair, calm cool composed soft neutral expression with closed mouth, seated to camera-right with one leg outstretched and one knee bent up, posture relaxed and confident, dark sock and polished black derby shoes visible. Between them in the center of the frame at the bride\'s lap level: a beautiful lush small round loose bouquet of fresh pastel lilac sweet-peas, lilac freesia and soft purple stock florals with delicate green stems, both warmly held by bride\'s right hand and groom\'s left hand together. Pose: bride leaning her temple softly onto groom\'s right shoulder with warm bright smile looking at camera, groom seated tall and straight beside her with one hand gently resting on the bouquet stems, calm refined editorial moment. Color grade: bright airy whites with rich deep blacks and saturated pastel-lilac floral accent, clean warm cream skin midtones, refined minimalist Korean studio K-prewedding magazine atmosphere — must clearly read as soft indoor studio beauty light, NOT outdoor, NOT golden hour.',
    // 신부(왼쪽), 신랑(오른쪽, 약간 위) — 바닥에 앉은 자세, 얼굴은 프레임 상단 1/3.
    faceMaskRegions: [
      [0.26, 0.14, 0.16, 0.18],
      [0.50, 0.12, 0.18, 0.20],
    ],
  },
  {
    id: 'studio-ivory-satin-couple',
    label: '크림 스튜디오 새틴 머메이드',
    hint: '아이보리 크림 + 새틴 머메이드 + 크림 슈트',
    category: 'studio',
    personality: 'together',
    intensity: 'low',
    image: '/wedding-snap/catalog/studio-ivory-satin-couple.jpg',
    promptHint:
      'Indoor studio with seamless soft warm cream / champagne-toned painted wall backdrop, soft large diffused beauty light from front-center creating clean luminous warm highlights and very soft shadow under the couple, no harsh shadows. Shot on 50–85mm portrait lens, full-body framing in tall vertical aspect capturing the couple head-to-toe with floor space below, eye-level camera, shallow depth of field. Bride: elegant fitted ivory champagne-satin spaghetti-strap floor-length mermaid wedding dress with delicate square neckline and dramatic long sweep train cascading luxuriously across the floor to camera-left, long dark hair flowing freely past her shoulders with side parting, dainty drop earrings, soft natural rosy makeup with warm bright closed-mouth smile, standing to camera-left holding a lush small loose cascading bouquet of white spray roses, white carnations and trailing greenery (with a long black satin ribbon flowing down) in her right hand at her hip. Groom: clean tailored ivory / off-white champagne three-piece notch-lapel formal suit (jacket + matching waistcoat + trousers) with crisp white dress shirt, neat slim pale-champagne silk necktie, and a small fresh white floral boutonniere on the left lapel, polished black velvet derby loafers, short neat dark side-swept hair, calm warm genuine closed-mouth bright smile, standing tall and straight beside the bride to camera-right with one hand casually tucked into his trouser pocket. Pose: bride to camera-left and groom to camera-right standing close together facing camera straight on, bride\'s left arm gently linked warmly around the groom\'s right arm at the elbow, both warmly facing camera with soft direct eye contact and gentle natural smiles. Color grade: bright airy warm cream highlights with subtle champagne tones throughout the gown and suit, clean warm cream skin midtones, refined classic Korean K-prewedding magazine champagne studio atmosphere — must clearly read as soft warm indoor studio light, NOT outdoor, NOT golden hour.',
    // 신부(왼쪽), 신랑(오른쪽) — 풀신 정자세, 얼굴은 프레임 상단.
    faceMaskRegions: [
      [0.34, 0.14, 0.16, 0.16],
      [0.54, 0.10, 0.16, 0.18],
    ],
  },
  {
    id: 'studio-ceremony-closeup',
    label: '결혼식 클로즈업 + 티아라',
    hint: '티아라 + 베일 + 레이스 풀턱 + 보타이 + 부케',
    category: 'studio',
    personality: 'together',
    intensity: 'low',
    image: '/wedding-snap/catalog/studio-ceremony-closeup.jpg',
    promptHint:
      'Indoor warm cream ceremony hall scene with cream-painted classical Corinthian / fluted column architecture and lush green-and-white floral arrangements (white roses + soft greenery) softly out of focus on both sides of the frame as creamy bokeh, soft warm natural daylight from a tall hidden window creating gentle clean highlights on the couple, warm cinematic ceremony glow with no harsh shadows. Shot on 85mm portrait lens, chest-up close framing with both faces nearly cheek-to-cheek and centered, eye-level camera, shallow depth of field. Groom: sharp black peak-lapel two-piece formal tuxedo with crisp white dress shirt, neat solid-black silk bow tie tied at the collar, and a small fresh white-and-green floral boutonniere on the left lapel, short neat dark side-swept hair with soft natural texture, calm warm genuine bright open-mouth smile showing teeth and warm crinkled eyes looking directly at camera. Bride: ivory long-sleeve sheer-illusion fine-lace wedding dress with delicate floral lace embroidery throughout the bodice and sleeves and small ruched lace neckline, a delicate silver-tone bridal tiara / crown with subtle crystals nestled in her hair, long fine-mesh cathedral-length white tulle veil draped softly behind her hair and trailing past her shoulders, hair pulled back into a soft loose low bun with side wisps and small dainty pearl drop earrings, soft natural rosy makeup with warm bright genuine closed-mouth smile, holding a beautiful round lush bouquet of white garden roses, white ranunculus and fresh green eucalyptus and trailing greenery at chest level. Pose: bride to camera-right and groom to camera-left standing very close cheek-to-cheek with both shoulders gently squared and faces clearly facing camera with warm direct eye contact and bright genuine smiles, refined classic Korean wedding-day ceremony portrait moment. Color grade: warm cream ceremony highlights with soft sage-green floral accents and warm skin midtones, refined timeless Korean wedding-ceremony editorial atmosphere — must clearly read as warm cinematic indoor ceremony natural light, NOT outdoor, NOT golden hour, NOT studio gray backdrop.',
    manualKelvin: 4500,
    manualMoodHint:
      'warm cinematic indoor wedding ceremony with cream classical architecture and white-and-green florals, refined timeless Korean wedding-day editorial mood, soft natural window light',
    // 신랑(왼쪽), 신부(오른쪽) — 클로즈업 투샷, 얼굴이 프레임 큰 비중 차지.
    faceMaskRegions: [
      [0.16, 0.06, 0.34, 0.46],
      [0.50, 0.10, 0.34, 0.44],
    ],
  },
  {
    id: 'paris-eiffel-walk',
    label: '파리 에펠탑 보도 워킹',
    hint: '에펠탑 + 센강 보도 + 베이지 슈트 + 빨간 장미',
    category: 'urban',
    personality: 'together',
    intensity: 'high',
    image: '/wedding-snap/catalog/paris-eiffel-walk.jpg',
    promptHint:
      'Outdoor Paris scene walking hand-in-hand along the Seine river embankment stone pavement, iconic Eiffel Tower clearly visible centered in the soft-focus background rising tall against a clean saturated blue sky with thin wispy white clouds, the Seine river softly visible to camera-left with a couple of tour boats blurred at the far shore and tree-lined river bank softly in the mid-background. Strong warm late-afternoon natural sunlight from camera-front-right creating clean warm rim on hair and shoulders with subtle warm lens flare. Shot on 50–85mm portrait lens, full-body framing in tall vertical aspect, eye-level camera, shallow depth of field on the couple. Groom: tailored warm beige / camel-tan two-piece notch-lapel formal suit with matching black inner crew-neck (no shirt + tie), polished black leather derby shoes, short neat dark side-swept hair, calm warm soft genuine closed-mouth smile, walking to camera-left holding the bride\'s right hand with his left. Bride: clean champagne / pale-ivory long-sleeve satin midi A-line dress with delicate V-neckline and softly flowing skirt grazing just below the knees, beige low-heel pumps, long dark-brown softly waved hair flowing freely past her shoulders catching warm rim light, dainty drop earrings, soft natural rosy makeup with warm gentle closed-mouth smile, walking to camera-right holding a small handful of fresh deep-red garden roses casually in her left hand at her side. Pose: couple walking gently side-by-side along the stone pavement holding hands warmly, bride leaning slightly toward groom with quiet warm smile, both warmly facing camera with soft direct eye contact mid-step. Color grade: warm honey-amber daylight highlights with clean saturated blue sky and fresh deep-red rose accent, warm cream skin midtones, romantic European travel K-prewedding magazine atmosphere — must clearly read as warm bright late-afternoon Paris daylight, NOT golden hour with strong backlight, NOT studio.',
    manualKelvin: 5200,
    manualMoodHint:
      'warm bright late-afternoon Paris daylight at the Seine with Eiffel Tower backdrop, romantic European travel K-prewedding mood, deep-red rose accent against beige and champagne styling',
    // 신랑(왼쪽), 신부(오른쪽) — 풀신 워킹 투샷.
    faceMaskRegions: [
      [0.30, 0.26, 0.18, 0.18],
      [0.52, 0.32, 0.18, 0.18],
    ],
  },
  {
    id: 'vintage-90s-street-vsign',
    label: '90s 빈티지 거리 V사인',
    hint: '90년대 거리 + 풀턱 + 빨간 장미 + V사인',
    category: 'urban',
    personality: 'together',
    intensity: 'medium',
    image: '/wedding-snap/catalog/vintage-90s-street-vsign.jpg',
    promptHint:
      'Outdoor vintage 1990s Korean / Asian downtown city street scene with vintage classic cars (cream sedan and dark sedan) softly parked at the curb behind, mid-rise old buildings with hanging shop signs softly visible deeper in the background, occasional small pedestrian softly visible at the far edge of the frame, scattered yellow ginkgo leaves on the pavement. Soft warm late-afternoon natural sunlight from camera-front filtering through the trees creating warm dappled highlights on hair and shoulders, hazy retro film atmosphere. Shot on 50–85mm portrait lens, three-quarter (waist-up to knee-up) close framing, eye-level camera, shallow depth of field with creamy retro street bokeh behind. Bride: ivory champagne off-shoulder sweetheart-neckline classic 90s puff-sleeve voluminous full ball-gown wedding dress with delicate cascading layered ruffle skirt and rosette appliqué details, long flowing white tulle cathedral veil softly draped behind the hair and trailing past her shoulders, classic 90s bridal pearl necklace and pearl drop earrings, soft natural rosy makeup with warm bright genuine open-mouth laughing smile, right hand raised flirtatiously near her face making a playful V peace sign with fingers, holding a beautiful round bouquet of fresh deep-red garden roses with white spray roses and fresh green eucalyptus and trailing greenery in her left hand at chest level. Groom: classic 90s-style black two-button notch-lapel formal suit jacket with bright royal-blue dress shirt and a wide saturated deep-red silk patterned necktie, warm caramel-tan straight wide-leg trousers, polished black derby shoes, short neat dark side-swept hair with soft natural texture, calm warm genuine closed-mouth smile, right hand raised behind the bride\'s shoulder making a matching playful V peace sign with fingers. Pose: bride to camera-right standing centered in the frame, groom to camera-left standing slightly behind her with arm wrapped warmly around her shoulders, both playfully raising V signs near their faces, both warmly facing camera with bright genuine smiles, candid retro joyful 90s Korean wedding moment. Color grade: warm hazy retro film tones with rich saturated deep-red rose / tie accents, soft cream highlights and warm skin midtones, gentle vintage 90s film grain — must clearly read as warm hazy late-afternoon 90s retro daylight, NOT golden hour, NOT studio.',
    manualKelvin: 5000,
    manualMoodHint:
      'warm hazy late-afternoon 1990s retro Korean street film editorial with rich red accents on rose / tie, classic 90s ball-gown puff sleeves and royal-blue + caramel styling, playful V-sign joy, vintage film grain',
    // 신랑(왼쪽 약간 위·뒤), 신부(오른쪽 중앙·앞) — 클로즈업 투샷 V사인.
    faceMaskRegions: [
      [0.18, 0.08, 0.28, 0.32],
      [0.46, 0.14, 0.30, 0.36],
    ],
  },
  {
    id: 'vintage-90s-street-fullbody',
    label: '90s 빈티지 거리 풀신',
    hint: '90년대 거리 + 빈티지 차 + 클래식 풀신',
    category: 'urban',
    personality: 'together',
    intensity: 'medium',
    image: '/wedding-snap/catalog/vintage-90s-street-fullbody.jpg',
    promptHint:
      'Outdoor vintage 1990s Korean / Asian downtown city street scene with vintage classic cream / beige sedan parked at the curb directly behind the couple, mid-rise old downtown buildings with hanging shop signs softly visible deeper in the background as soft retro skyline, soft pedestrian softly visible at the far edge of the frame. Soft warm midday natural sunlight from camera-front creating warm dappled highlights on hair and shoulders, hazy vintage film atmosphere. Shot on 35–50mm lens for environmental retro street feel, full-body framing in tall vertical aspect, slight low-angle camera, shallow depth of field with creamy retro street bokeh behind. Bride: ivory champagne classic 90s puff-sleeve sweetheart-neckline voluminous full ball-gown wedding dress with abundant cascading layered ruffle skirt and rosette appliqué details, long flowing white tulle cathedral veil and 90s bridal headpiece, classic 90s bridal pearl necklace and pearl drop earrings, soft natural rosy makeup with warm bright genuine open-mouth laughing smile, both hands cradling a beautiful large round bouquet of fresh deep-red garden roses with white spray roses and trailing greenery at her chest. Groom: classic 90s-style black two-button notch-lapel formal suit jacket with bright royal-blue dress shirt and a wide saturated deep-red silk patterned necktie, warm caramel-tan straight wide-leg trousers, polished black derby shoes, short neat dark side-swept hair with soft natural texture, calm warm genuine closed-mouth smile, standing tall and straight beside the bride. Pose: bride to camera-right standing tall centered in front of the vintage car holding the bouquet at chest level with warm bright laughing smile, groom to camera-left standing close beside her facing camera straight on with one hand casually tucked into the trouser pocket and the other resting gently behind the bride\'s lower back, both warmly facing camera with bright genuine smiles, candid retro joyful 90s Korean wedding moment. Color grade: warm hazy retro film tones with rich saturated deep-red rose / tie accents, soft cream highlights and warm skin midtones, gentle vintage 90s film grain — must clearly read as warm hazy midday 1990s retro daylight, NOT golden hour, NOT studio.',
    manualKelvin: 5200,
    manualMoodHint:
      'warm hazy midday 1990s retro Korean street film editorial in front of vintage classic sedan, joyful candid wedding moment, vintage film grain',
    // 신랑(왼쪽), 신부(오른쪽 중앙) — 풀신 정자세 + 부케 투샷.
    faceMaskRegions: [
      [0.22, 0.10, 0.18, 0.20],
      [0.50, 0.12, 0.20, 0.22],
    ],
  },
  {
    id: 'cinema-popcorn-couple',
    label: '영화관 팝콘 데이트',
    hint: '영화관 + 빨간 시트 + 팝콘 + 풀턱 + 보타이',
    category: 'urban',
    personality: 'together',
    intensity: 'low',
    image: '/wedding-snap/catalog/cinema-popcorn-couple.jpg',
    promptHint:
      'Indoor empty modern movie cinema theater scene with rows of plush vibrant red cinema seats stretching diagonally back into the dark background on both sides, dim warm cinematic lighting with a single bright cool-blue projector light beam glowing from the back-center wall above casting subtle volumetric light into the dark room. Couple seated together in the center seat of the front-center row, soft cool ambient glow on the couple from the projector beam mixed with warm soft fill from camera-front. Shot on 35–50mm lens for environmental cinema feel, three-quarter (waist-up) framing, eye-level camera, shallow depth of field on the couple with the red seats softly bokeh-blurred behind. Bride: soft champagne / pale-blush layered tulle ball-gown wedding dress with delicate beaded sweetheart bodice and voluminous skirt cascading lushly across the cinema seat, long honey-brown softly waved hair flowing freely past her shoulders, dainty drop earrings, soft natural rosy makeup with warm bright closed-mouth smile, seated to camera-left with both hands softly clasped together in her lap. Groom: sharp black peak-lapel two-piece formal tuxedo with crisp white dress shirt and neat solid-black silk bow tie tied at the collar, short neat dark side-swept hair, calm warm genuine bright closed-mouth smile, seated to camera-right with one leg casually crossed over the other, holding a large white-and-black vertical-striped classic cinema-style popcorn bucket overflowing with warm golden popcorn in both hands resting at his lap, sharing the popcorn warmly between them. Pose: bride and groom seated very close shoulder-to-shoulder both warmly facing camera with bright genuine smiles, popcorn bucket centered between them as the focal joyful element, intimate playful cinema date wedding moment. Color grade: rich saturated red seat tones with subtle cool-blue projector glow accent and warm cream skin midtones, refined cinematic playful K-prewedding magazine atmosphere — must clearly read as warm cinematic indoor cinema room with subtle cool projector glow, NOT outdoor, NOT golden hour, NOT studio gray backdrop.',
    manualKelvin: 4000,
    manualMoodHint:
      'cinematic indoor movie theater scene with saturated red cinema seats and subtle cool-blue projector glow, joyful intimate cinema date K-prewedding mood, popcorn as warm focal accent',
    // 신부(왼쪽), 신랑(오른쪽) — 앉은 자세 투샷, 얼굴은 프레임 상단.
    faceMaskRegions: [
      [0.30, 0.20, 0.18, 0.22],
      [0.54, 0.22, 0.18, 0.22],
    ],
  },
  {
    id: 'hanbok-couple-studio',
    label: '한복 스튜디오 핑크·라일락',
    hint: '핑크 치마 + 라일락 답호 + 베이지 배경',
    category: 'tradition',
    personality: 'together',
    intensity: 'low',
    image: '/wedding-snap/catalog/hanbok-couple-studio.jpg',
    promptHint:
      'Indoor studio with seamless soft warm-cream / champagne-toned painted wall backdrop, soft large diffused front beauty light from front-center creating clean luminous warm highlights and very soft shadow on the floor, no harsh shadows. Shot on 50–85mm portrait lens, full-body framing in tall vertical aspect capturing the couple head-to-toe, eye-level camera, shallow depth of field. Bride: traditional Korean hanbok consisting of a clean cream / off-white short jeogori (top) with crisp white inner collar trim, soft pink goreum tie, and a long soft pastel pink chima (skirt) flowing down to the floor with subtle hand-embroidery detail at the hem, long dark hair pulled back into a smooth low bun and adorned with an ornate silver-and-pearl traditional Korean bridal hair accessory / dwikkoji headpiece, soft natural rosy makeup with warm bright genuine open-mouth smile showing teeth, holding the groom\'s hand at her side. Groom: traditional Korean men\'s hanbok with clean cream / off-white inner jeogori top and matching wide off-white baji trousers, layered with a long elegant pastel lilac / soft purple sleeveless dapho (Korean men\'s vest-coat / overcoat) tied at the chest with a wide pastel-lilac silk goreum bow, traditional white seon-hye flat shoes, short neat dark side-swept hair, calm warm genuine closed-mouth bright smile, standing tall and straight beside the bride to camera-right gently holding her hand. Pose: bride to camera-left and groom to camera-right standing close together facing camera straight on, holding hands warmly between them at waist level, both warmly facing camera with soft direct eye contact and bright genuine smiles, refined classic Korean traditional hanbok studio K-prewedding portrait moment. Color grade: bright airy warm cream highlights with soft pastel pink and pastel lilac fabric accents and clean warm cream skin midtones, refined classic Korean traditional K-prewedding magazine atmosphere — must clearly read as soft warm indoor studio light with traditional hanbok styling, NOT outdoor, NOT golden hour.',
    manualKelvin: 5000,
    manualMoodHint:
      'soft warm indoor studio light with refined classic traditional Korean hanbok styling in pastel pink chima and pastel lilac dapho, bright joyful K-prewedding portrait mood',
    // 신부(왼쪽), 신랑(오른쪽) — 풀신 정자세, 얼굴은 프레임 상단 1/3.
    faceMaskRegions: [
      [0.22, 0.10, 0.18, 0.20],
      [0.56, 0.06, 0.18, 0.20],
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
    hidden: true, // 마스터 이미지 미업로드
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
    hidden: true, // 마스터 이미지 미업로드 (bride-garden-twirl 가 유사 컨셉)
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
    hidden: true, // 마스터 이미지 미업로드
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
    image: '/wedding-snap/catalog/groom-monochrome-suit.jpg',
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
  {
    id: 'bride-vintage-car-stand',
    label: '신부 빈티지카 + 숲',
    hint: '클래식 컨버터블 + 숲 + 차에 기대선 자세',
    category: 'outdoor',
    personality: 'bride-solo',
    intensity: 'medium',
    image: '/wedding-snap/catalog/bride-vintage-car-stand.jpg',
    promptHint:
      'Solo bride shot — only the bride in frame, no groom, no other people. Outdoor lush green forest scene with tall straight evergreen pine trees forming a dense vertical green backdrop, soft diffused warm late-morning natural daylight filtering through the canopy creating soft dappled highlights, no harsh shadows. A classic vintage cream / off-white Volkswagen Beetle convertible automobile (top down) parked in front of the trees with the front headlight and chrome-trim grille visible, the bride leaning casually against the front-left fender of the car. Shot on 50–85mm portrait lens, full-body framing in tall vertical aspect, eye-level camera, shallow depth of field with creamy green forest bokeh behind. Bride: ivory fitted high-neck halter-style lace mermaid wedding dress with delicate floral lace embroidery throughout the bodice and skirt, small subtle sweep train, long dark hair pulled back into a clean smooth low ponytail, dainty pearl drop earrings, soft natural rosy makeup with warm bright closed-mouth smile, holding a small loose bouquet of fresh white spray roses and trailing greenery wrapped with twine in her right hand resting at her hip. Pose: standing close in front of the vintage car, body slightly turned to camera-right with right hand leaning lightly on the car fender, left hand softly holding the bouquet at her hip, face turned directly toward camera with warm direct eye contact and quiet bright smile. Color grade: bright airy outdoor whites with fresh saturated forest greens and warm cream skin midtones, refined classic Korean editorial bridal magazine atmosphere — must clearly read as soft warm late-morning daylight in a lush forest, NOT golden hour, NOT studio.',
    manualKelvin: 5400,
    manualMoodHint:
      'soft warm late-morning daylight in a lush green pine forest with a vintage cream convertible car, refined classic Korean bridal editorial mood, fresh greens with warm skin midtones',
    // solo 풀신 — 얼굴은 프레임 상단 중앙, 비교적 작게.
    faceMaskRegions: [[0.40, 0.20, 0.22, 0.20]],
  },
  {
    id: 'groom-vintage-window',
    label: '신랑 빈티지 인테리어 창가',
    hint: '클래식 인테리어 + 창가 + 벨벳 턱시도 + 옆모습',
    category: 'studio',
    personality: 'groom-solo',
    intensity: 'medium',
    image: '/wedding-snap/catalog/groom-vintage-window.jpg',
    promptHint:
      'Solo groom portrait — only the groom is in the frame, no bride, no other people. Indoor warm cinematic classic vintage interior scene with sage-green painted wall and dark mahogany wood wainscoting in the background, an antique carved dark-wood chair softly visible to camera-right, vintage wood-frame doorway with warm directional natural sunlight pouring in from a hidden window to camera-left creating a strong warm key light on the groom\'s face and shoulder with rich deep shadow on the right side, deep moody dramatic lighting. Shot on 50–85mm portrait lens, waist-up framing, eye-level camera, shallow depth of field. Groom: sharp black velvet shawl / peak-lapel formal tuxedo with crisp white wing-collar shirt and neat solid-black silk bow tie tied at the collar, jacket buttoned at the top button only, short neat dark side-swept hair softly textured, calm pensive composed neutral expression with mouth softly closed and slight head tilt. Pose: seated relaxed on the antique wooden chair facing camera-left in profile (~80° three-quarter angle to camera-right), left elbow resting on the knee with hand softly relaxed downward, right hand resting on the other knee, head turned to look softly out the unseen window to camera-left with quiet introspective gaze and gentle natural lips, classic cinematic 1930s-era refined groom editorial moment. Color grade: cinematic warm tungsten highlights with deep sage-green wall midtones and rich shadow detail, soft film grain — must clearly read as warm cinematic vintage interior natural-window light, NOT studio, NOT outdoor, NOT golden hour outdoors.',
    manualKelvin: 3600,
    manualMoodHint:
      'warm cinematic vintage 1930s-era classic interior with sage-green wall and warm window key light, pensive introspective groom editorial, soft film grain',
    // solo 반신 — 얼굴은 프레임 상단 중앙, 옆모습 자세. region 우측 치우침.
    faceMaskRegions: [[0.46, 0.10, 0.30, 0.28]],
  },
  {
    id: 'bride-sofa-ballgown',
    label: '신부 화이트 카우치 볼가운',
    hint: '카우치 + 풀튤 볼가운 + 부케 + 자연광',
    category: 'studio',
    personality: 'bride-solo',
    intensity: 'low',
    image: '/wedding-snap/catalog/bride-sofa-ballgown.jpg',
    promptHint:
      'Solo bride shot — only the bride in frame, no groom, no other people. Indoor bright studio scene with seamless soft cream / off-white sheer-curtained window backdrop, a small clean cream-upholstered antique sofa centered in the frame, soft warm diffused natural daylight pouring in from large window behind the sofa through the sheer curtains creating clean luminous backlit highlights on hair and shoulders with very soft fall-off shadows, no harsh shadows. Shot on 50–85mm portrait lens, three-quarter (waist-up) framing, eye-level camera, shallow depth of field. Bride: strapless ivory wedding ball-gown with delicate ruched sweetheart lace-and-beaded bodice and dramatic voluminous full tulle ball-gown skirt cascading lushly across the entire sofa and beyond the lower edges of the frame, long honey-brown softly waved hair flowing freely past her shoulders catching soft warm backlit rim light, large dramatic crystal-drop earrings catching the light, soft natural rosy makeup with warm bright genuine closed-mouth smile, seated calmly in the center of the sofa with one elbow propped softly on the seat-back and right hand gently raised under her chin in a relaxed elegant pose. To camera-right resting on the sofa beside her: a beautiful round loose bouquet of pastel-pink garden roses, blush spray roses, soft lilac sweet-peas, peach lisianthus and trailing eucalyptus greenery wrapped with a soft ivory satin ribbon. Pose: seated centered on the sofa facing camera straight on with body slightly turned and head tilted softly to one side, warm direct eye contact with camera and gentle natural smile. Color grade: bright airy backlit whites with clean warm cream skin midtones, very low contrast, dreamy minimalist K-prewedding bridal magazine beauty editorial — must clearly read as soft warm indoor natural-window-light studio, NOT outdoor, NOT golden hour.',
    // solo 반신 — 얼굴은 프레임 상단 중앙, 비교적 크게.
    faceMaskRegions: [[0.36, 0.10, 0.30, 0.30]],
  },
  {
    id: 'bride-garden-ballgown',
    label: '신부 정원 풀턱 + 사이드 브레이드',
    hint: '돌담 정원 + 풀튤 볼가운 + 사이드 브레이드 + 부케',
    category: 'outdoor',
    personality: 'bride-solo',
    intensity: 'low',
    image: '/wedding-snap/catalog/bride-garden-ballgown.jpg',
    promptHint:
      'Solo bride shot — only the bride in frame, no groom, no other people. Outdoor refined private garden scene with a textured stone garden wall partially visible in the background covered with climbing dark-green ivy and tall lush dense leafy trees overhead filtering soft warm dappled afternoon natural sunlight onto the bride creating gentle warm rim on hair and shoulders, lush short green lawn underfoot at the bottom of the frame. Shot on 50–85mm portrait lens, full-body framing in tall vertical aspect, slight low-angle camera, shallow depth of field on the bride with creamy green foliage bokeh behind. Bride: clean ivory off-shoulder fitted-bodice voluminous full ball-gown wedding dress with delicate scattered floral lace appliqué embroidery throughout the bodice and skirt and dramatic full tulle layered skirt cascading lushly down to the lawn, long dark-brown hair styled into a single thick side-braided ponytail draped softly over her right shoulder, small dainty earrings, soft natural rosy makeup with warm gentle closed-mouth smile, holding a lush small loose cascade bouquet of white garden roses and fresh green eucalyptus and trailing greenery in her right hand at her hip. Pose: standing centered in the garden facing camera straight on with body slightly turned, both hands gently holding the bouquet at her right hip, looking softly toward camera with warm gentle closed-mouth smile and quiet eyes, refined classic Korean bridal magazine garden moment. Color grade: warm dappled greens with bright ivory dress and clean warm cream skin midtones, refined classic Korean K-prewedding magazine garden atmosphere — must clearly read as soft warm late-afternoon dappled garden daylight, NOT golden hour, NOT studio.',
    manualKelvin: 5400,
    manualMoodHint:
      'soft warm late-afternoon dappled garden daylight with stone-wall and ivy backdrop, refined classic Korean bridal editorial mood with side-braided hair and full ball-gown',
    // solo 풀신 — 얼굴은 프레임 상단 중앙, 비교적 작게.
    faceMaskRegions: [[0.40, 0.16, 0.22, 0.20]],
  },
];

export const isSnapCatalogId = (v: string): boolean =>
  SNAP_CATALOG.some((c) => c.id === v);

export const findSnapCatalog = (id: string): SnapCatalogItem | undefined =>
  SNAP_CATALOG.find((c) => c.id === id);
