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

/**
 * 카탈로그 컷의 프레이밍 (얼굴 크기 / body 비율). 2분류:
 *   - 'closeup' : 클로즈업/반신 — 얼굴 위주 (chest-up / shoulder / waist-up).
 *   - 'full'    : 전신 — 무릎 위 이상 보이는 컷 (knee-up / three-quarter / full-body).
 * 필터 UI 에서 사용자가 원하는 프레이밍만 추리는 데 쓰임. 미지정 시 'full' 로 간주.
 * (이전 'half' 는 closeup 으로 통합 — 사용자 입장에선 얼굴 크게 보이는 컷 vs 풀신
 *  으로 단순 구분이 명확함.)
 */
export type CatalogFraming = 'closeup' | 'full';

/**
 * 카탈로그 배경 단순 분류 — 필터 UI 는 "스튜디오 / 야외" 2그룹만 노출.
 * 내부 category 5종을 다음과 같이 묶음:
 *   - 'studio'  : studio
 *   - 'outdoor' : outdoor + tradition(한옥) + urban(도심) + beach(해변)
 */
export type CatalogBackdrop = 'studio' | 'outdoor';

export interface SnapCatalogItem {
  /** 식별자 — 파일명/카탈로그 prompt 키와 동일 */
  id: string;
  /** 카탈로그 미리보기에 보일 한글 라벨 */
  label: string;
  /** 부가 설명 (1줄) */
  hint: string;
  /** 카테고리 그룹 (UI 필터/그룹핑용, 옵션) */
  category: 'studio' | 'outdoor' | 'tradition' | 'urban' | 'beach';
  /**
   * 컷의 프레이밍 (얼굴 크기 / body 비율). 미지정 시 'full' 로 간주.
   * 필터 UI 에서 사용자가 클로즈업/반신/전신 중 원하는 컷만 추리는 데 쓰임.
   * 마스터 컷 promptHint 의 framing 표현 (chest-up / waist-up / knee-up / full-body)
   * 을 기준으로 분류.
   */
  framing?: CatalogFraming;
  /**
   * 컷에 측면얼굴 (profile, 등 돌림, 어깨 너머 시선 등) 이 포함됐는지.
   * 셀카 모드에서 함께 컷 + 전신 + 측면 = 변형 위험이 크므로 "비추" 판정에 사용.
   * 셀카 단독 컷에서는 영향 없음 (solo 는 항상 safe).
   * 기본 false (정면).
   */
  hasSideAngle?: boolean;
  /**
   * 컷이 앉아있는 자세인지 (sofa, chair, stone wall, car interior 등).
   * 커플 모드에서 사용자 입력이 전신이면서 카탈로그가 앉은 자세면 구도 미스매치로
   * 얼굴이 강하게 재구성될 수 있어 "주의" 판정에 사용.
   * 기본 false (서 있음).
   */
  isSeated?: boolean;
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
   * @deprecated 이 필드는 더 이상 사용되지 않습니다. picker 노출 차단은 admin
   * 페이지(`/admin/snap-catalog-tags`) 에서 `hidden` 태그를 세팅해 관리하세요.
   * 호환성을 위해 type 만 유지하지만 catalog-availability 가 이 값을 무시
   * 합니다 (PR B 이후). 모든 항목의 hidden:true 정의는 catalog.ts 에서 제거됨.
   */
  hidden?: boolean;
}

export const SNAP_CATALOG: SnapCatalogItem[] = [
  // ── Together (커플) 컷 ────────────────────────────────────
  {
    id: 'beach-classic-white',
    label: '비치 클래식 화이트',
    hint: '화이트 슈트 + 베일 + 잔잔한 파도',
    category: 'beach',
    personality: 'together',
    intensity: 'medium',
    framing: 'full',
    hasSideAngle: true, // standing close facing each other in profile (both side)
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
    framing: 'full',
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
    framing: 'full',
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
    framing: 'full',
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
    id: 'bridge-night-noir',
    label: '브릿지 야경 누아르',
    hint: '검정 슈트·드레스 + 가로등 + 야경 보케',
    category: 'urban',
    personality: 'together',
    intensity: 'high',
    framing: 'full',
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
    framing: 'full',
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
    framing: 'closeup',
    isSeated: true, // seated together on sofa
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
    framing: 'closeup',
    isSeated: true, // groom seated, bride leaning over
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
    framing: 'full',
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
    framing: 'closeup',
    isSeated: true, // seated face-to-face at small round table
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
    framing: 'full',
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
    framing: 'closeup',
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
    framing: 'full',
    hasSideAngle: true, // back-hug, 신부 측면
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
    framing: 'closeup',
    isSeated: true, // seated very close together on cream sofa
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
    framing: 'full',
    hasSideAngle: true, // back-to-back, face turned over shoulder
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
    framing: 'full',
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
    framing: 'full',
    isSeated: true, // both seated together on basalt stone wall
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
    framing: 'full',
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
    framing: 'full',
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
    framing: 'closeup',
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
    framing: 'full',
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
    framing: 'full',
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
    framing: 'closeup',
    hasSideAngle: true, // back to camera-right, face turned back over shoulder
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
    framing: 'full',
    isSeated: true, // seated relaxed on white floor
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
    framing: 'full',
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
    framing: 'closeup',
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
    framing: 'full',
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
    framing: 'closeup',
    image: '/wedding-snap/catalog/vintage-90s-street-vsign.jpg',
    promptHint:
      'TIGHT CLOSE-UP PORTRAIT — both faces dominantly fill the upper half of the frame, chest-up framing only (no waist, no full body visible). Bouquet visible just at the bottom edge of the frame. Outdoor vintage 1990s Korean / Asian downtown city street scene with vintage classic cars (cream sedan and dark sedan) softly parked at the curb FAR behind (heavily out of focus), mid-rise old buildings with hanging shop signs softly visible deeper in the background, occasional small pedestrian softly visible at the far edge of the frame, scattered yellow ginkgo leaves on the pavement. Soft warm late-afternoon natural sunlight from camera-front filtering through the trees creating warm dappled highlights on hair and shoulders, hazy retro film atmosphere. Shot on 85mm portrait lens, chest-up close framing (NEVER full body, NEVER knee-up — only chest and faces visible), eye-level camera, very shallow depth of field with creamy retro street bokeh behind. Bride: ivory champagne off-shoulder sweetheart-neckline classic 90s puff-sleeve ball-gown wedding dress with delicate cascading layered ruffle skirt and rosette appliqué details (only the upper bodice visible in this tight crop), long flowing white tulle cathedral veil softly draped behind the hair and trailing past her shoulders, classic 90s bridal pearl necklace and pearl drop earrings, soft natural rosy makeup with warm bright genuine open-mouth laughing smile, right hand raised flirtatiously near her face making a playful V peace sign with fingers, holding a beautiful round bouquet of fresh deep-red garden roses with white spray roses and fresh green eucalyptus and trailing greenery in her left hand at chest level (bouquet visible just at the lower edge of the frame). Groom: classic 90s-style black two-button notch-lapel formal suit jacket with bright royal-blue dress shirt and a wide saturated deep-red silk patterned necktie (only the upper jacket and collar visible in this tight crop), short neat dark side-swept hair with soft natural texture, calm warm genuine closed-mouth smile, right hand raised behind the bride\'s shoulder making a matching playful V peace sign with fingers. Pose: bride to camera-right with face centered in the frame, groom to camera-left with face close to bride\'s cheek slightly behind her, both playfully raising V signs near their faces, both warmly facing camera with bright genuine smiles, both faces clearly the focal point of the frame — candid retro joyful 90s Korean wedding close-up moment. Color grade: warm hazy retro film tones with rich saturated deep-red rose / tie accents, soft cream highlights and warm skin midtones, gentle vintage 90s film grain — must clearly read as warm hazy late-afternoon 90s retro daylight TIGHT CHEST-UP CLOSE-UP, NOT full body, NOT knee-up, NOT golden hour, NOT studio.',
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
    framing: 'full',
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
    id: 'cinema-redseat-couple',
    label: '영화관 레드시트 데이트',
    hint: '영화관 + 빨간 시트 + 정장 + 풀튤 드레스',
    category: 'urban',
    personality: 'together',
    intensity: 'low',
    framing: 'closeup',
    isSeated: true, // seated together in cinema seats
    image: '/wedding-snap/catalog/cinema-redseat-couple.jpg',
    promptHint:
      'Indoor empty modern movie cinema theater scene with rows of plush vibrant red cinema seats stretching diagonally back into the dark background on both sides, dim warm cinematic lighting with two small warm wall sconces softly glowing on the back wall behind the couple, soft warm ambient fill on the couple from camera-front. Shot on 35–50mm lens for environmental cinema feel, three-quarter (waist-up) framing, slight high-angle camera looking gently down at the couple from a row behind, shallow depth of field on the couple with the red seats softly bokeh-blurred behind and in the foreground. Bride: soft ivory champagne off-shoulder layered tulle ball-gown wedding dress with delicate beaded sweetheart bodice and voluminous skirt cascading lushly across the cinema seat, hair in a soft swept-back short style with subtle volume, dainty drop earrings, soft natural rosy makeup with warm gentle closed-mouth smile, leaning her chin and arm tenderly on the back of the seat in front of her facing camera. Groom: sharp black peak-lapel two-piece formal tuxedo with crisp white dress shirt and neat solid-black silk bow tie tied at the collar, short neat dark side-swept hair, round thin-framed glasses, calm warm soft closed-mouth smile, seated to camera-left right beside bride with one arm wrapped warmly around her shoulder. Pose: bride and groom seated very close shoulder-to-shoulder both facing camera with calm warm gentle smiles, intimate refined cinema date wedding moment, no popcorn, no other props. Color grade: rich saturated red seat tones with warm cream skin midtones and subtle warm-tungsten ambient glow, refined cinematic intimate K-prewedding magazine atmosphere — must clearly read as warm intimate indoor cinema room, NOT outdoor, NOT golden hour, NOT studio gray backdrop.',
    manualKelvin: 3200,
    manualMoodHint:
      'warm intimate indoor movie theater scene with saturated red cinema seats and soft warm-tungsten ambient glow, refined cinematic intimate K-prewedding mood',
    // 신랑(왼쪽, 약간 위), 신부(오른쪽, 앞 좌석 등받이에 기댐).
    faceMaskRegions: [
      [0.32, 0.30, 0.18, 0.22],
      [0.52, 0.36, 0.18, 0.22],
    ],
  },
  {
    id: 'hanbok-couple-studio',
    label: '한복 스튜디오 핑크·라일락',
    hint: '핑크 치마 + 라일락 답호 + 베이지 배경',
    category: 'tradition',
    personality: 'together',
    intensity: 'low',
    framing: 'full',
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
  {
    id: 'studio-arch-window-couple',
    label: '아치 창 + 베이지 슈트 머메이드',
    hint: '아치형 창 + 베이지 슈트 + 화이트 머메이드 풀신',
    category: 'studio',
    personality: 'together',
    intensity: 'low',
    framing: 'full',
    image: '/wedding-snap/catalog/studio-arch-window-couple.jpg',
    promptHint:
      'Indoor bright studio with a tall white-framed arched window backdrop opening onto a lush green garden softly visible outside, soft warm diffused natural daylight pouring through the arched window creating clean luminous backlit highlights on the couple, no harsh shadows, polished cream concrete floor. Shot on 50–85mm portrait lens, full-body framing in tall vertical aspect, eye-level camera, shallow depth of field on the couple with creamy green foliage bokeh behind. Groom: clean tailored warm beige / oatmeal-tan two-piece notch-lapel formal suit with crisp white dress shirt and slim solid-black silk necktie, polished black derby shoes, short neat dark side-swept hair, calm warm genuine closed-mouth bright smile, standing tall to camera-left holding a small loose round bouquet of fresh white anemones and trailing greenery in his right hand at waist level between the couple. Bride: elegant ivory champagne satin halter-neck floor-length mermaid wedding dress with subtle high neckline and dramatic long sweep train cascading luxuriously across the floor to camera-right, hair pulled back into a clean smooth low ponytail with side wisps, dainty drop earrings, soft natural rosy makeup with warm bright genuine closed-mouth smile, standing close to camera-right with body slightly turned toward groom and one arm warmly linked around his arm at the elbow. Pose: bride to camera-right and groom to camera-left standing very close together facing camera straight on, both clearly facing camera with warm direct eye contact and bright genuine smiles, refined classic Korean K-prewedding magazine garden-light studio atmosphere. Color grade: bright airy whites with fresh saturated garden greens softly blurred behind and clean warm cream skin midtones — must clearly read as soft warm indoor natural-window-light studio, NOT outdoor, NOT golden hour.',
    faceMaskRegions: [
      [0.30, 0.10, 0.18, 0.18],
      [0.52, 0.14, 0.18, 0.18],
    ],
  },
  {
    id: 'garden-finger-heart',
    label: '가든 손가락 하트',
    hint: '꽃밭 + 베일 + 손가락 하트 클로즈업',
    category: 'outdoor',
    personality: 'together',
    intensity: 'low',
    framing: 'closeup',
    image: '/wedding-snap/catalog/garden-finger-heart.jpg',
    promptHint:
      'Outdoor lush garden scene with abundant pink, peach and cream roses softly out of focus filling the entire background, warm dappled afternoon natural sunlight filtering through the leaves creating soft warm rim on hair and shoulders, no harsh shadows. Shot on 85mm portrait lens, chest-up close framing with both faces nearly cheek-to-cheek and centered, eye-level camera, shallow depth of field with creamy floral bokeh behind. Bride: clean ivory strapless sweetheart-neckline wedding dress with subtle beaded bodice softly visible at the lower edge, long fine-mesh white tulle cathedral veil softly draped behind her head and trailing past her shoulders, long honey-brown softly waved hair flowing freely past her shoulders, dainty drop earrings, soft natural rosy makeup with warm bright genuine open-mouth laughing smile, right hand raised in front of her chest making half of a small finger-heart shape (curved thumb + index finger). Groom: sharp black peak-lapel two-piece formal tuxedo with crisp white dress shirt, neat solid-black silk bow tie tied at the collar, and a small fresh white floral boutonniere on the left lapel, short neat dark side-swept hair, calm warm genuine soft closed-mouth smile, left hand raised in front of his chest meeting the bride\'s hand to complete a small joined finger-heart shape between them. Pose: bride to camera-left and groom to camera-right standing very close cheek-to-cheek facing camera straight on with bright warm direct eye contact, their joined fingers forming a small heart shape centered just below their faces, refined romantic playful K-prewedding garden moment. Color grade: bright airy outdoor whites with fresh saturated rose-garden pinks/peaches and clean warm cream skin midtones, romantic K-prewedding magazine garden atmosphere — must clearly read as warm dappled late-afternoon outdoor daylight, NOT golden hour, NOT studio.',
    manualKelvin: 5400,
    manualMoodHint:
      'warm dappled late-afternoon garden daylight with pink/peach rose-garden bokeh, playful joined finger-heart moment, romantic K-prewedding mood',
    faceMaskRegions: [
      [0.18, 0.10, 0.32, 0.50],
      [0.50, 0.10, 0.32, 0.50],
    ],
  },
  {
    id: 'beige-wall-cheek-lean',
    label: '베이지 벽 머리 기댐',
    hint: '베이지 벽 + 들꽃 부케 + 머리 기댐',
    category: 'outdoor',
    personality: 'together',
    intensity: 'low',
    framing: 'closeup',
    image: '/wedding-snap/catalog/beige-wall-cheek-lean.jpg',
    promptHint:
      'Outdoor refined scene against a clean warm beige / cream painted plaster wall as backdrop with soft dappled leaf shadows from a nearby tree filtering across the wall, a small visible green branch with leaves softly entering the upper-left edge of the frame, warm soft late-afternoon natural daylight from camera-front creating clean gentle highlights with no harsh shadows. Shot on 85mm portrait lens, chest-up close framing with bride leaning her head softly onto groom, eye-level camera, shallow depth of field. Groom: clean black notch-lapel two-piece formal suit with matching black inner dress shirt (no separate white shirt, no tie), short neat dark side-swept hair, calm warm soft genuine closed-mouth smile, standing tall to camera-left with both arms wrapped warmly around the bride from behind in a gentle hug. Bride: clean ivory sleeveless V-neck delicate-lace overlay sleeveless wedding dress with subtle tulle bodice, long dark hair flowing freely past her shoulders with side parting, dainty crystal-drop earring on the visible ear, soft natural rosy makeup with warm bright genuine closed-mouth smile, standing close in front of groom to camera-right gently leaning her head and temple onto the groom\'s right shoulder while looking softly at camera, holding a small loose bouquet of fresh white daisies, chamomile florals and trailing greenery in both hands lifted gently up at chest level between her and the groom. Pose: couple very close cheek-to-shoulder with bride to camera-right and groom to camera-left, both warmly facing camera with soft direct eye contact and gentle smiles, refined romantic intimate K-prewedding magazine moment. Color grade: warm cream wall tones with soft dappled leaf shadows and clean warm cream skin midtones, refined Korean K-prewedding magazine warm-natural atmosphere — must clearly read as soft warm late-afternoon natural daylight against a warm wall, NOT golden hour, NOT studio gray backdrop.',
    manualKelvin: 5200,
    manualMoodHint:
      'warm late-afternoon outdoor daylight against a warm beige plaster wall with soft dappled leaf shadows, refined intimate K-prewedding mood',
    faceMaskRegions: [
      [0.18, 0.18, 0.28, 0.38],
      [0.48, 0.26, 0.28, 0.38],
    ],
  },
  {
    id: 'meadow-blue-sky-couple',
    label: '들판 푸른 하늘 풀신',
    hint: '잔디 들판 + 푸른 하늘 + 백합 부케 + 풀신 정자세',
    category: 'outdoor',
    personality: 'together',
    intensity: 'medium',
    framing: 'full',
    image: '/wedding-snap/catalog/meadow-blue-sky-couple.jpg',
    promptHint:
      'Outdoor wide green grassy meadow with low rolling forested hills in the mid-ground and clean saturated deep-blue clear sky filling the upper half of the frame, bright warm late-morning natural sunlight from camera-front-right creating clean gentle highlights, no harsh shadows. Shot on 50–85mm portrait lens, full-body framing in tall vertical aspect, slight low-angle camera, shallow depth of field on the couple with soft green meadow and distant hill bokeh. Groom: sharp black peak-lapel two-piece formal tuxedo with crisp white dress shirt, neat solid-black silk necktie, and a small fresh white floral boutonniere on the left lapel, polished black oxford shoes, short neat dark side-swept hair, calm warm genuine soft closed-mouth smile, standing tall to camera-left holding the bride\'s hand at his side. Bride: clean ivory champagne satin strapless sweetheart-neckline classic ball-gown wedding dress with subtle ruched bodice and dramatic voluminous floor-length skirt cascading lushly to the grass with subtle sweep train, hair pulled back into a clean smooth low updo with side bang, dainty drop earrings, soft natural rosy makeup with warm bright genuine closed-mouth smile, holding a beautiful round loose bouquet of fresh white lily-of-the-valley sprays and trailing greenery in both hands at her waist. Pose: bride to camera-right and groom to camera-left standing close together holding hands warmly facing camera straight on, both with shoulders gently squared toward camera and warm direct eye contact, refined classic Korean K-prewedding magazine meadow moment. Color grade: bright airy outdoor whites with fresh saturated grass greens and clean saturated deep-blue sky and warm cream skin midtones, refined classic Korean K-prewedding magazine meadow atmosphere — must clearly read as warm bright late-morning daylight in a green meadow under blue sky, NOT golden hour, NOT studio.',
    manualKelvin: 5500,
    manualMoodHint:
      'warm bright late-morning outdoor daylight in a green meadow under deep saturated blue sky, refined classic K-prewedding mood',
    faceMaskRegions: [
      [0.32, 0.22, 0.16, 0.16],
      [0.54, 0.22, 0.16, 0.16],
    ],
  },
  {
    id: 'brick-cherry-blossom',
    label: '적벽돌 + 벚꽃',
    hint: '한국 전통건축물 + 벚꽃 + 원숄더 베이지 새틴',
    category: 'tradition',
    personality: 'together',
    intensity: 'low',
    framing: 'full',
    image: '/wedding-snap/catalog/brick-cherry-blossom.jpg',
    promptHint:
      'Outdoor refined scene against a tall warm red-brick wall of a Korean traditional-modern brick building (small wooden-frame window centered behind the couple at upper-third height), abundant pale-pink cherry blossom branches in full bloom arching across the top of the frame and softly framing both sides, warm dappled spring daylight filtering through the cherry blossoms creating soft warm rim on hair and shoulders, no harsh shadows, warm brick step at the bottom of the frame. Shot on 50–85mm portrait lens, full-body framing in tall vertical aspect, slight low-angle camera, shallow depth of field on the couple with crisp brick texture behind and creamy cherry-blossom bokeh. Groom: sharp dark navy peak-lapel two-piece formal suit with crisp white dress shirt, neat solid-black silk necktie, and a small fresh white floral boutonniere on the left lapel, polished black derby shoes, short neat dark side-swept hair, calm warm composed soft closed-mouth smile, standing tall to camera-left with one hand casually tucked into trouser pocket and one shoulder leaning lightly against the brick wall. Bride: clean ivory champagne satin one-shoulder asymmetric-neckline floor-length flowing slip-style wedding dress with subtle ruched bodice and soft natural A-line skirt cascading lushly to the brick step with subtle sweep train, long dark hair pulled back into a clean smooth low chignon with side wisps, dainty drop earrings, soft natural rosy makeup with warm gentle closed-mouth smile, holding a small loose bouquet of white anemones and trailing greenery in her right hand at her hip, standing close to camera-right facing camera straight on. Pose: bride and groom standing close together facing camera with calm composed gentle smiles, refined romantic Korean K-prewedding magazine spring blossom moment. Color grade: warm dappled spring daylight with rich saturated red-brick tones and soft pastel pink cherry-blossom accents and clean warm cream skin midtones, refined romantic Korean K-prewedding magazine spring atmosphere — must clearly read as warm dappled spring daylight, NOT golden hour, NOT studio.',
    manualKelvin: 5400,
    manualMoodHint:
      'warm dappled spring daylight against red-brick wall with pastel-pink cherry blossom canopy, refined romantic Korean K-prewedding spring blossom mood',
    faceMaskRegions: [
      [0.32, 0.32, 0.14, 0.14],
      [0.54, 0.32, 0.14, 0.14],
    ],
  },
  {
    id: 'ceremony-flower-wall',
    label: '예식장 꽃벽 + 촛불',
    hint: '예식장 꽃 월 + 촛불 통로 + 풀턱 베일',
    category: 'studio',
    personality: 'together',
    intensity: 'low',
    framing: 'full',
    image: '/wedding-snap/catalog/ceremony-flower-wall.jpg',
    promptHint:
      'Indoor warm cinematic Korean wedding ceremony hall scene with a dramatic full white-and-cream floral wall backdrop (lush abundant white garden roses, ivory ranunculus, white hydrangea, and cream peonies filling the entire wall from floor to ceiling), a luxurious crystal chandelier glowing softly above, two rows of warm-glowing tall pillar candles in tall slim glass hurricanes lining both sides of the aisle in the foreground, white rose petals scattered across the polished dark wood aisle floor. Soft warm cinematic ceremony glow with clean luminous front light and no harsh shadows. Shot on 50–85mm portrait lens, full-body framing in tall vertical aspect, slight low-angle camera, shallow depth of field with creamy floral and candle bokeh behind. Groom: sharp black peak-lapel two-piece formal velvet tuxedo with crisp white dress shirt, neat solid-black silk bow tie tied at the collar, and a small fresh white-and-green floral boutonniere on the left lapel, polished black oxford shoes, short neat dark side-swept hair, calm warm genuine bright open-mouth smile, standing tall to camera-left with bride\'s arm warmly linked around his. Bride: clean ivory strapless sweetheart-neckline classic wedding ball-gown with delicate intricate floral lace appliqué embroidery throughout the bodice and skirt and dramatic voluminous full tulle layered skirt cascading lushly down to the aisle floor with dramatic sweep train, long fine-mesh white tulle cathedral veil softly draped behind her head and trailing past her shoulders, hair pulled back into a clean smooth low updo, dainty pearl drop earrings, soft natural rosy makeup with warm bright genuine open-mouth laughing smile, holding a beautiful lush round bouquet of fresh white lily-of-the-valley sprays, white peonies and trailing greenery in both hands at chest level. Pose: bride to camera-right and groom to camera-left standing close together arm-in-arm facing camera straight on with bright warm direct eye contact and genuine joyful smiles, refined romantic Korean K-prewedding wedding-day ceremony portrait moment. Color grade: warm cream ceremony highlights with abundant white-floral accents, warm tungsten chandelier and candle glow, and clean warm cream skin midtones, refined timeless Korean wedding-ceremony editorial atmosphere — must clearly read as warm cinematic indoor ceremony with warm-tungsten + white-floral palette, NOT outdoor, NOT golden hour.',
    manualKelvin: 4200,
    manualMoodHint:
      'warm cinematic Korean wedding-ceremony with full white floral wall and warm-tungsten chandelier and candle glow, refined timeless wedding-day editorial mood',
    faceMaskRegions: [
      [0.30, 0.22, 0.14, 0.14],
      [0.56, 0.22, 0.14, 0.14],
    ],
  },
  {
    id: 'budapest-bastion-sunset',
    label: '부다페스트 어부의 요새 골든아워',
    hint: '돌 아치 + 도시 강 + 골든아워 강한 백라이트',
    category: 'urban',
    personality: 'together',
    intensity: 'high',
    framing: 'full',
    isSeated: true, // bride seated on stone balustrade
    image: '/wedding-snap/catalog/budapest-bastion-sunset.jpg',
    promptHint:
      'Outdoor scene at the Fisherman\'s Bastion overlooking Budapest at warm late-afternoon golden hour (strong warm low sun in the sky filling the horizon with rich saturated orange and pink clouds, distant Danube river and the Hungarian Parliament building softly visible across the river — must clearly be golden hour, NOT noon, NOT blue hour). Two tall ornate white carved-stone neo-Romanesque arches framing the couple on both sides with low carved stone balustrade in the foreground, soft warm honey rim light catching the bride\'s hair and veil from camera-right. Shot on 50–85mm portrait lens, full-body framing in tall vertical aspect, eye-level camera with the arches framing the couple, shallow depth of field with creamy warm sunset cityscape bokeh. Groom: sharp black peak-lapel two-piece formal suit with crisp white dress shirt and slim solid-black silk necktie, polished black oxford shoes, short neat dark side-swept hair, calm warm composed soft closed-mouth smile, standing tall to camera-left with one shoulder leaning lightly against the stone arch column and one hand casually tucked into trouser pocket. Bride: clean ivory off-shoulder sleeveless fitted floor-length lace-mermaid wedding dress with delicate floral lace embroidery throughout the bodice and skirt and dramatic long sweep train, long fine-mesh white tulle cathedral veil softly draped behind her head and trailing dramatically across the stone floor to camera-right, hair pulled back into a clean smooth low chignon, dainty drop earrings, soft natural rosy makeup with warm bright genuine open-mouth laughing smile, holding a small round bouquet of fresh white spray roses and trailing greenery in both hands at her waist. Pose: bride seated softly on the stone balustrade to camera-right turned slightly toward the groom with bright joyful laughing smile, groom standing tall to camera-left with body turned warmly toward the bride looking softly at her with calm content smile, refined romantic European travel K-prewedding magazine sunset moment. Color grade: cinematic warm honey-amber golden-hour highlights with rich saturated pink-orange sky and warm city silhouette, gentle film haze and grain — must clearly read as warm romantic European golden hour, NOT noon, NOT blue hour, NOT studio.',
    manualKelvin: 3000,
    manualMoodHint:
      'cinematic warm honey-amber golden hour at the Budapest Fisherman\'s Bastion with carved-stone arches and rich pink-orange Danube sky, romantic European travel K-prewedding mood',
    faceMaskRegions: [
      [0.24, 0.30, 0.16, 0.18],
      [0.52, 0.36, 0.16, 0.18],
    ],
  },
  {
    id: 'beach-backhug-redbouquet',
    label: '해변 백허그 + 빨간 부케',
    hint: '해변 + 검정 슬립 + 빨간 카네이션 + 백허그 클로즈업',
    category: 'beach',
    personality: 'together',
    intensity: 'high',
    framing: 'closeup',
    image: '/wedding-snap/catalog/beach-backhug-redbouquet.jpg',
    promptHint:
      'Outdoor scene on a quiet beach at warm late-afternoon golden hour with calm turquoise ocean and softly breaking waves stretching to a flat horizon directly behind the couple, soft warm pastel-peach and pale-pink sunset sky filling the upper background, warm beige wet sand underfoot, soft warm rim light from camera-back-right creating gentle honey glow on hair. Shot on 85mm portrait lens, chest-up close framing with bride centered in front and groom slightly behind hugging her from behind, eye-level camera, shallow depth of field with creamy ocean-and-sky bokeh. Bride: elegant sleeveless black satin spaghetti-strap fitted slip-style wedding dress with subtle cowl neckline softly visible at the lower edge, long dark hair pulled back into a clean smooth low ponytail, dainty earrings, soft natural rosy makeup with bright big genuine open-mouth laughing smile, both hands cradling a beautiful lush large round bouquet of saturated deep-red carnations and red roses (wrapped at the stems with a flowing dark-red satin ribbon) lifted gently up at chest level. Groom: clean black peak-lapel two-piece formal suit with crisp white dress shirt and slim solid-black silk necktie, short neat dark side-swept hair, calm warm genuine soft closed-mouth smile with eyes softly closed, standing close behind the bride with both arms wrapped warmly around her waist from behind in a gentle back-hug, leaning his face tenderly into her right shoulder. Pose: groom hugging bride from behind close cheek-to-shoulder, both warmly facing camera with bride laughing joyfully and groom smiling softly with eyes closed in tender intimate moment, refined romantic candid joyful K-prewedding beach moment. Color grade: cinematic warm pastel-peach golden-hour sky with cool turquoise ocean accent and saturated deep-red bouquet accent, warm cream skin midtones, gentle film softness — must clearly read as warm romantic late-afternoon beach golden hour, NOT noon, NOT studio.',
    manualKelvin: 3200,
    manualMoodHint:
      'warm pastel-peach golden-hour beach with turquoise ocean and saturated deep-red carnation bouquet accent, romantic candid back-hug joyful K-prewedding mood',
    faceMaskRegions: [
      [0.16, 0.30, 0.30, 0.40],
      [0.50, 0.16, 0.30, 0.36],
    ],
  },
  {
    id: 'hanok-sunset-leather-jacket',
    label: '한옥 노을 + 가죽 재킷 캐주얼',
    hint: '한옥 + 노을 + 가죽재킷 + 미니 레이스 베일',
    category: 'tradition',
    personality: 'together',
    intensity: 'high',
    framing: 'full',
    isSeated: true, // couple seated together on low stone wall
    image: '/wedding-snap/catalog/hanok-sunset-leather-jacket.jpg',
    promptHint:
      'Outdoor refined Korean countryside scene with a traditional Korean hanok house with curved gray-tile rooftop softly silhouetted in the warm hazy mid-background, distant rural countryside and a small Western-style house with red roof barely visible deeper in the background, warm cement / stone low wall in the foreground, soft warm late-afternoon golden-hour sunlight from camera-back creating warm honey rim on hair and shoulders, hazy warm atmosphere. Shot on 50–85mm portrait lens, three-quarter (knee-up) close framing with the couple seated together on the low stone wall, eye-level camera, shallow depth of field with creamy warm hanok and countryside bokeh behind. Groom: clean dark-brown / black classic leather biker jacket with collar over a soft sky-blue dress shirt and slim solid-black silk necktie, clean off-white straight trousers, polished brown leather western-style ankle boots, short neat dark side-swept hair, calm warm genuine soft closed-mouth smile, seated to camera-left on the stone wall with one leg casually crossed and one arm warmly wrapped around the bride\'s shoulders from behind. Bride: clean ivory short-sleeve sweetheart-neckline knee-length fitted-bodice intricate-lace mini wedding dress with subtle full skirt, long fine-mesh white tulle cathedral veil softly draped behind her head and floating dramatically in the breeze, hair pulled back into a clean smooth low chignon with side wisps, dainty drop earrings, soft natural rosy makeup with warm bright genuine open-mouth laughing smile, holding a small loose bouquet of fresh bright-yellow sunflowers, white daisies and chamomile florals in her right hand at chest level, seated close beside groom to camera-right with body slightly turned toward camera with one hand softly placed on his lap. Pose: couple seated close together on the stone wall with bride to camera-right slightly leaning toward groom, both warmly facing camera with bright genuine smiles, refined modern casual Korean K-prewedding traditional-meets-casual moment. Color grade: cinematic warm honey-amber golden-hour highlights with rich saturated traditional hanok red-tile-rooftop accent and warm cream skin midtones, gentle film haze — must clearly read as warm late-afternoon Korean countryside golden hour, NOT noon, NOT studio.',
    manualKelvin: 3100,
    manualMoodHint:
      'warm honey-amber golden hour at Korean hanok countryside, modern casual leather-jacket and lace mini-dress styling with sunflower bouquet, refined romantic K-prewedding golden-hour mood',
    faceMaskRegions: [
      [0.26, 0.30, 0.18, 0.20],
      [0.52, 0.30, 0.18, 0.20],
    ],
  },
  {
    id: 'nyc-times-square-couple',
    label: '뉴욕 타임스퀘어',
    hint: '도심 LED 광고판 + 풀턱 + 네이비 슈트',
    category: 'urban',
    personality: 'together',
    intensity: 'medium',
    framing: 'closeup',
    hasSideAngle: true, // body turned 3/4 back, faces over shoulder
    image: '/wedding-snap/catalog/nyc-times-square-couple.jpg',
    promptHint:
      'Outdoor downtown Manhattan New York Times Square street scene with abundant glowing large LED video billboards (vivid colorful advertising signs softly visible — Chicago Broadway musical signs, vintage cinema marquees, taxi cabs softly visible in the deep midground), bright warm late-afternoon natural daylight, hazy busy city pedestrian crowd softly blurred deeper in the street. Shot on 50–85mm portrait lens, three-quarter (waist-up) close framing, slight three-quarter (~30°) angle with the couple turned slightly toward camera-back-right and faces looking softly back toward camera, eye-level camera, shallow depth of field with creamy vivid Times Square LED bokeh behind. Groom: sharp dark navy notch-lapel two-piece formal suit with crisp soft-blue striped dress shirt (no tie, top button casually undone), short neat dark side-swept hair, calm warm composed soft closed-mouth smile, standing close to camera-left with one arm warmly wrapped behind the bride\'s back. Bride: clean ivory champagne strapless sweetheart-neckline classic full wedding ball-gown with delicate ruched bodice and subtle beaded detail softly visible at the lower edge of the frame, long dark-brown softly waved hair flowing freely past her shoulders, dainty drop earring catching the city light on the visible ear, soft natural rosy makeup with warm bright genuine closed-mouth smile, standing close to camera-right with body warmly turned toward groom. Pose: couple standing close together with body turned in three-quarter angle (back to camera-right) and faces softly turned back over their shoulders toward camera with warm direct eye contact and gentle natural smiles, refined romantic Korean travel K-prewedding magazine NYC moment. Color grade: warm bright urban daylight with rich saturated colorful LED-billboard accents, warm cream skin midtones, refined K-prewedding international travel editorial atmosphere — must clearly read as warm bright late-afternoon Times Square daylight with colorful LED bokeh, NOT golden hour, NOT studio.',
    manualKelvin: 5400,
    manualMoodHint:
      'warm bright late-afternoon NYC Times Square daylight with colorful LED-billboard bokeh, refined romantic K-prewedding international travel editorial mood',
    faceMaskRegions: [
      [0.16, 0.10, 0.30, 0.36],
      [0.50, 0.14, 0.30, 0.36],
    ],
  },
  {
    id: 'vintage-car-shades-bouquet',
    label: '빈티지 컨버터블 + 선글라스',
    hint: '클래식 컨버터블 + 신랑 검정 슈트 + 신부 선글라스 + 미니 튤',
    category: 'urban',
    personality: 'together',
    intensity: 'medium',
    framing: 'closeup',
    isSeated: true, // seated inside vintage car
    image: '/wedding-snap/catalog/vintage-car-shades-bouquet.jpg',
    promptHint:
      'Outdoor refined European old-town cobblestone street scene softly visible in the background (warm cream-colored old buildings, soft pedestrian crowd at the far edge of the frame), warm late-morning natural daylight, the couple seated inside a vintage cream / off-white classic convertible automobile (top down) with rich burgundy / wine-red leather interior, polished wood-grain dashboard and chrome trim, parked at the curb. Shot on 50–85mm portrait lens, chest-up close framing from camera-back-right of the car (slight 3/4 angle), eye-level camera, shallow depth of field on the couple with creamy warm old-town European bokeh behind. Groom: sharp black peak-lapel two-piece formal tuxedo with crisp white dress shirt and neat solid-black silk bow tie tied at the collar, large black square wayfarer sunglasses, short neat dark side-swept hair, calm cool serene composed neutral expression with mouth softly closed, seated calmly to camera-left in the driver\'s seat with one arm relaxed on the door-edge and one arm warmly wrapped around the bride\'s back. Bride: clean ivory champagne strapless sweetheart-neckline knee-length tulle layered mini wedding dress with subtle full skirt, long dark hair pulled back into a clean smooth low chignon, large white cat-eye sunglasses, dainty single-strand pearl necklace and dainty drop earrings, soft natural rosy makeup with deep rich burgundy lip, holding a beautiful small loose rustic bouquet of dried blush-pink garden roses, ivory ranunculus, dried beige pampas and dried-greenery in both hands lifted gently up at chest level, seated calmly to camera-right in the passenger seat with body slightly turned toward camera. Pose: couple seated close together inside the vintage car with both warmly facing camera with calm cool serene neutral expressions (no smiles), refined modern editorial European travel K-prewedding moment. Color grade: warm cream old-town European daylight with rich saturated burgundy car-interior accent and warm cream skin midtones, refined modern editorial Korean K-prewedding international travel atmosphere — must clearly read as warm late-morning European old-town daylight, NOT golden hour, NOT studio.',
    manualKelvin: 5200,
    manualMoodHint:
      'warm late-morning European old-town daylight inside a vintage cream convertible with burgundy interior, refined modern editorial Korean K-prewedding travel mood with cool neutral expressions and sunglasses styling',
    faceMaskRegions: [
      [0.16, 0.18, 0.30, 0.40],
      [0.48, 0.20, 0.30, 0.40],
    ],
  },
  {
    id: 'meadow-shades-bouquet-seated',
    label: '잔디밭 앉음 선글라스 들꽃',
    hint: '잔디밭 앉은 자세 + 선글라스 + 풍성 들꽃 부케',
    category: 'outdoor',
    personality: 'together',
    intensity: 'low',
    framing: 'full',
    isSeated: true, // seated together on lawn
    image: '/wedding-snap/catalog/meadow-shades-bouquet-seated.jpg',
    promptHint:
      'Outdoor scene seated on a lush short green lawn filling the entire frame (uniform short grass, no trees or sky visible — just grass), warm late-afternoon natural sunlight from camera-front creating soft warm rim on hair and shoulders. Shot on 50–85mm portrait lens, full-body framing in tall vertical aspect, eye-level camera at ground level, shallow depth of field on the couple with creamy soft grass bokeh. Bride: clean ivory champagne spaghetti-strap knee-length layered tulle mini wedding dress with full ruffle skirt cascading lushly across her crossed legs on the grass, long fine-mesh white tulle veil softly draped behind her hair, hair pulled back into a clean smooth low chignon with side wisps, sleek black cat-eye sunglasses, dainty drop earrings, soft natural rosy makeup with deep rich saturated red lip, warm brown suede western-style ankle boots, seated to camera-left on the grass with one elbow resting on bent knee and right hand softly raised under her chin in a relaxed editorial pose, calm cool serene composed neutral expression with mouth softly closed. Groom: clean warm beige / oatmeal-tan two-piece notch-lapel relaxed-fit formal linen suit with crisp white dress shirt (no tie, top button casually undone) and rolled-up cuffs, dark blue canvas low-top sneakers with white socks, large black square wayfarer sunglasses, short neat dark side-swept hair, calm cool serene composed neutral expression with mouth softly closed, seated close beside bride to camera-right with knees softly up, both hands cradling a beautiful lush large round wildflower bouquet of vibrant pink peonies, orange daisies, yellow craspedia, purple statice and trailing red amaranthus florals lifted casually between his knees. Pose: bride and groom seated close together on the lawn facing camera straight on with calm cool serene neutral expressions (no smiles), refined retro 90s gen-Z editorial K-prewedding lawn casual moment. Color grade: warm late-afternoon natural sunlight with uniform fresh saturated greens and rich saturated wildflower bouquet accent, warm cream skin midtones, refined retro 90s editorial K-prewedding lawn-casual mood — must clearly read as warm late-afternoon outdoor daylight, NOT golden hour, NOT studio.',
    manualKelvin: 5200,
    manualMoodHint:
      'warm late-afternoon outdoor daylight on uniform green lawn with rich saturated wildflower bouquet and vintage retro casual styling with sunglasses, refined retro 90s gen-Z editorial K-prewedding mood',
    faceMaskRegions: [
      [0.18, 0.10, 0.22, 0.20],
      [0.56, 0.06, 0.22, 0.22],
    ],
  },
  {
    id: 'london-bigben-couple',
    label: '런던 빅벤',
    hint: '빅벤 + 다리 + 네이비 슈트 + 풀턱',
    category: 'urban',
    personality: 'together',
    intensity: 'medium',
    framing: 'full',
    image: '/wedding-snap/catalog/london-bigben-couple.jpg',
    promptHint:
      'Outdoor London Westminster Bridge scene with the iconic Big Ben clock tower clearly visible rising tall and centered in the soft-focus background against a clean saturated bright-blue clear sky, the historic gothic Westminster Palace softly visible to camera-left and a vintage ornate London green street lamp to camera-right, calm gray Thames river softly visible to camera-right, pale stone bridge balustrade in the foreground, warm bright late-morning natural daylight from camera-front. Shot on 50–85mm portrait lens, full-body framing in tall vertical aspect, slight low-angle camera, shallow depth of field with creamy London cityscape bokeh behind. Groom: sharp dark navy peak-lapel two-piece formal suit with crisp white dress shirt, neat solid-black silk bow tie tied at the collar, and a small fresh white floral boutonniere on the left lapel, polished black derby shoes, short neat dark side-swept hair, calm warm composed soft closed-mouth smile, standing tall to camera-left with one hand casually tucked into trouser pocket. Bride: clean ivory champagne short-puff-sleeve sweetheart-neckline classic full wedding ball-gown with delicate ruched bodice and dramatic voluminous full tulle skirt cascading lushly down to the bridge stone, hair pulled back into a clean smooth low chignon with a small fresh white floral hair accessory tucked above her ear, dainty drop earrings, soft natural rosy makeup with warm gentle closed-mouth smile, holding a beautiful round bouquet of fresh white spray roses, white anemones and trailing fresh green eucalyptus in her right hand at her hip, standing close beside groom to camera-right facing camera straight on. Pose: bride and groom standing close together facing camera with calm composed gentle warm smiles, refined romantic European travel K-prewedding magazine London moment. Color grade: warm bright midday daylight with clean saturated London bright-blue sky and warm cream stone-bridge tones and warm cream skin midtones, refined romantic K-prewedding international travel editorial atmosphere — must clearly read as warm bright London midday daylight, NOT golden hour, NOT studio.',
    manualKelvin: 5500,
    manualMoodHint:
      'warm bright midday London daylight at Westminster Bridge with iconic Big Ben clock tower backdrop, refined romantic European travel K-prewedding mood',
    faceMaskRegions: [
      [0.26, 0.30, 0.14, 0.16],
      [0.54, 0.34, 0.14, 0.16],
    ],
  },
  {
    id: 'porto-pink-sunset',
    label: '포르토 핑크 노을 강변',
    hint: '포르토 강변 + 핑크 노을 + 돌난간 앉음',
    category: 'urban',
    personality: 'together',
    intensity: 'high',
    framing: 'full',
    isSeated: true, // bride seated on stone balustrade
    image: '/wedding-snap/catalog/porto-pink-sunset.jpg',
    promptHint:
      'Outdoor refined scene on a stone-balustrade riverside viewpoint overlooking the Porto Douro river and the historic Ribeira waterfront at warm late-afternoon golden hour (rich saturated pastel-pink and warm peach sunset clouds filling the upper-half of the frame, distant historic Ribeira terracotta-roof buildings cascading down the hillside softly visible across the river with warm tungsten window lights starting to glow, calm Douro river softly visible reflecting the warm pink sky and warm city lights). Soft warm honey rim light from camera-back catching hair and shoulders. Shot on 50–85mm portrait lens, full-body framing in tall vertical aspect, slight low-angle camera, shallow depth of field with creamy warm Porto cityscape bokeh behind. Groom: sharp black peak-lapel two-piece formal tuxedo with crisp white dress shirt, neat solid-black silk necktie, and a small fresh white floral boutonniere on the left lapel, polished black oxford shoes, short neat dark side-swept hair, calm warm composed soft closed-mouth smile, standing tall to camera-left on the stone-balustrade viewpoint with body slightly turned toward bride and right hand softly placed on her shoulder. Bride: clean ivory champagne strapless sweetheart-neckline floor-length flowing satin slip-style wedding dress with subtle ruched bodice and soft natural drape, long dark-brown softly waved hair flowing freely past her shoulders, dainty single-strand pearl necklace and dainty drop earrings, soft natural rosy makeup with warm bright genuine closed-mouth smile, holding a small loose bouquet of fresh white-and-blush garden roses and trailing greenery in both hands at her waist, seated softly on the wide stone balustrade to camera-right with body warmly turned toward groom looking up softly at him. Pose: bride seated softly on the stone balustrade looking up warmly at the groom standing close beside her, groom looking softly down at the bride with calm content smile, both in refined romantic intimate European travel K-prewedding sunset moment. Color grade: cinematic warm pastel-pink and peach golden-hour highlights with warm tungsten Porto-waterfront accent and clean warm cream skin midtones, refined romantic European travel K-prewedding sunset atmosphere — must clearly read as warm romantic Porto golden hour with pastel-pink sky, NOT noon, NOT blue hour, NOT studio.',
    manualKelvin: 3000,
    manualMoodHint:
      'cinematic warm pastel-pink + peach Porto golden hour with warm tungsten waterfront accent, refined romantic European travel K-prewedding intimate sunset mood',
    faceMaskRegions: [
      [0.28, 0.30, 0.14, 0.14],
      [0.56, 0.34, 0.14, 0.14],
    ],
  },
  {
    id: 'mountain-pink-sunset-hug',
    label: '산 핑크 노을 + 들어올림 포옹',
    hint: '산 + 핑크 노을 + 빈티지 비틀 + 들어올림 포옹',
    category: 'outdoor',
    personality: 'together',
    intensity: 'high',
    framing: 'full',
    hasSideAngle: true, // groom has back to viewer
    image: '/wedding-snap/catalog/mountain-pink-sunset-hug.jpg',
    promptHint:
      'Outdoor scene at a high-altitude mountain plateau viewpoint overlooking distant snow-capped rocky mountains softly silhouetted against a dramatic warm pastel-pink and peach golden-hour sunset sky with soft warm cloud streaks filling the upper-half of the frame, gravel underfoot. A vintage cream / off-white classic Volkswagen Beetle convertible automobile (top down with two black duffle bags strapped on the back rack) parked diagonally to camera-back-right behind the couple. Soft warm honey rim light from camera-back-left catching hair and the bride\'s veil. Shot on 50–85mm portrait lens, full-body framing in tall vertical aspect, slight low-angle camera, shallow depth of field on the couple with creamy warm pink mountain sunset bokeh behind. Groom: clean warm cream / off-white two-piece notch-lapel relaxed-fit formal linen suit with crisp white dress shirt (no tie, top button casually undone), polished cream loafers, short neat dark side-swept hair, calm warm genuine soft closed-mouth smile, standing tall to camera-front facing away from camera with back turned to camera-front (the groom has back to viewer), both arms warmly wrapped around the bride lifting her gently up off the ground in a tender intimate joyful hug. Bride: clean ivory champagne short-sleeve sweetheart-neckline knee-length flowing tulle layered mini wedding dress with subtle full skirt, soft fine-mesh white tulle short veil softly draped behind her hair, hair pulled back into a clean smooth low chignon with side wisps, dainty drop earrings, soft natural rosy makeup with bright big genuine open-mouth laughing smile, both hands cradling a beautiful lush large round bouquet of saturated bright-pink garden roses, hot-pink ranunculus and trailing greenery between her and groom at chest level, lifted up off the ground in groom\'s arms with body warmly facing toward groom and one foot kicked playfully back. Pose: groom lifting bride up in a tender intimate joyful hug with groom\'s back to camera and bride facing softly back over groom\'s shoulder toward camera with bright joyful open-mouth laughing smile, refined romantic candid joyful K-prewedding mountain sunset travel moment. Color grade: cinematic warm pastel-pink and peach golden-hour highlights with warm cream skin midtones and saturated hot-pink bouquet accent, gentle film softness — must clearly read as warm dramatic mountain golden hour with pastel-pink sky, NOT noon, NOT blue hour, NOT studio.',
    manualKelvin: 3000,
    manualMoodHint:
      'cinematic warm pastel-pink + peach mountain golden hour with vintage Beetle convertible and saturated hot-pink bouquet, romantic candid joyful intimate-hug K-prewedding travel mood',
    // 신부 얼굴은 신랑 어깨 너머 우상단, 신랑 얼굴은 보이지 않음 (등 돌림).
    faceMaskRegions: [[0.46, 0.32, 0.20, 0.20]],
  },
  {
    id: 'studio-greenwall-glasses',
    label: '다크 그린 스튜디오 + 안경',
    hint: '다크 그린 벽 + 안경 신랑 + 베일 풀턱',
    category: 'studio',
    personality: 'together',
    intensity: 'low',
    framing: 'full',
    isSeated: true, // groom seated on wooden stool, bride standing
    image: '/wedding-snap/catalog/studio-greenwall-glasses.jpg',
    promptHint:
      'Indoor studio with seamless soft dark-emerald-green textured painted wall backdrop, soft warm diffused front beauty light creating clean luminous warm highlights with subtle painterly fall-off shadow, no harsh shadows. Shot on 50–85mm portrait lens, full-body / three-quarter framing in tall vertical aspect capturing the couple seated together on a vintage rustic wooden stool, eye-level camera, shallow depth of field. Groom: sharp black peak-lapel two-piece formal tuxedo with crisp white dress shirt, neat solid-black silk bow tie tied at the collar, and a crisp white pocket-square neatly folded in the breast pocket, polished black derby shoes, short neat dark side-swept hair, classic round black-rim eyeglasses, calm warm genuine bright open-mouth smile, seated tall to camera-left on the wooden stool with both hands relaxed on his knees. Bride: clean ivory long-sleeve sheer-illusion fine-lace V-neck wedding dress with delicate intricate floral lace embroidery throughout the bodice and sleeves and soft natural A-line skirt with subtle sweep train, long fine-mesh white tulle cathedral veil softly draped behind her head and softly trailing past her shoulders, hair pulled back into a clean smooth low chignon with a small dainty pearl hair accessory tucked above her ear, dainty pearl drop earrings, soft natural rosy makeup with warm bright genuine open-mouth smile, holding a beautiful lush large cascade bouquet of fresh white spray roses, white anemones, ivory ranunculus and abundant trailing fresh green eucalyptus and fern greenery dropping dramatically down past her waist, standing close beside groom to camera-right with right hand gently resting on groom\'s right shoulder. Pose: bride standing close warmly beside seated groom with right hand softly resting on his shoulder, both warmly facing camera straight on with bright genuine smiles, refined classic Korean K-prewedding magazine intimate moment. Color grade: rich saturated dark-emerald-green wall tones with rich warm cream-and-ivory dress accent, clean warm cream skin midtones, refined classic Korean K-prewedding magazine moody-green studio atmosphere — must clearly read as soft warm indoor studio light with rich dark-green wall, NOT outdoor, NOT golden hour.',
    manualKelvin: 4800,
    manualMoodHint:
      'soft warm indoor studio light with rich saturated dark-emerald-green wall backdrop, refined classic moody Korean K-prewedding studio mood',
    faceMaskRegions: [
      [0.28, 0.20, 0.18, 0.18],
      [0.50, 0.16, 0.18, 0.18],
    ],
  },
  {
    id: 'porto-balcony-sunset',
    label: '포르토 발코니 골든아워',
    hint: '포르토 발코니 + 골든아워 + 브라운 슈트 + 새틴 미디',
    category: 'urban',
    personality: 'together',
    intensity: 'high',
    framing: 'full',
    isSeated: true, // bride seated softly on wide stone balustrade
    image: '/wedding-snap/catalog/porto-balcony-sunset.jpg',
    promptHint:
      'Outdoor refined scene on a carved-stone balcony with low ornate stone balustrade overlooking the historic Porto Douro river and the Ribeira waterfront at warm late-afternoon golden hour (warm honey-amber sky filling the upper-half of the frame, distant historic Ribeira terracotta-roof buildings cascading along the hillside softly visible across the river with the iconic Dom Luís I bridge softly silhouetted in the distance, calm Douro river softly reflecting the warm sky and a few small fishing boats), warm honey rim light from camera-back catching hair and the bride\'s veil dramatically. Shot on 50–85mm portrait lens, three-quarter / knee-up framing in wide horizontal aspect, slight low-angle camera, shallow depth of field with creamy warm Porto cityscape bokeh behind. Groom: clean warm caramel-brown notch-lapel two-piece formal suit with crisp soft-pink dress shirt and slim soft-pink silk necktie, polished brown leather oxford shoes, short neat dark side-swept hair, calm warm composed soft closed-mouth smile looking softly down at the bride, standing tall to camera-left with right hand softly holding the bride\'s right hand. Bride: clean ivory champagne off-shoulder cap-sleeve sweetheart-neckline knee-length flowing satin slip-style wedding dress with subtle ruched bodice and soft natural drape, long fine-mesh white tulle cathedral veil softly draped behind her head and floating dramatically out into the breeze to camera-right, long dark-brown softly waved hair flowing freely past her shoulders with side parting and a small dainty white floral hair accessory, dainty drop earrings, soft natural rosy makeup with warm bright genuine open-mouth laughing smile, holding a small loose bouquet of fresh blush-pink garden roses and trailing greenery in her left hand, seated softly on the wide stone balustrade to camera-right with body warmly turned toward the groom looking up softly at him with joyful laughing smile. Pose: bride seated softly on the stone balustrade looking up warmly at the groom standing close beside her with bright joyful laughing smile, groom standing tall looking softly down at the bride with calm content smile, refined romantic intimate European travel K-prewedding sunset balcony moment. Color grade: cinematic warm honey-amber golden-hour highlights with warm Porto-waterfront cityscape accent and clean warm cream skin midtones, refined romantic European travel K-prewedding sunset atmosphere — must clearly read as warm romantic Porto golden hour, NOT noon, NOT blue hour, NOT studio.',
    manualKelvin: 3100,
    manualMoodHint:
      'cinematic warm honey-amber Porto golden hour at carved-stone balcony overlooking Douro river, refined romantic European travel K-prewedding intimate sunset mood',
    faceMaskRegions: [
      [0.30, 0.22, 0.14, 0.16],
      [0.52, 0.20, 0.14, 0.16],
    ],
  },
  {
    id: 'prague-sunflower-cheer',
    label: '프라하 + 해바라기 환호',
    hint: '프라하 + 해바라기 부케 + 풀턱 + 베이지 슈트',
    category: 'urban',
    personality: 'together',
    intensity: 'medium',
    framing: 'full',
    image: '/wedding-snap/catalog/prague-sunflower-cheer.jpg',
    promptHint:
      'Outdoor refined scene on a cobblestone hilltop viewpoint overlooking historic Prague Old Town with the iconic Prague Castle and St. Vitus Cathedral gothic spires clearly visible rising tall in the soft-focus mid-background, abundant historic red terracotta-roof Czech buildings cascading down the hillside softly visible in the foreground, clean bright pale-blue sky with soft white cumulus clouds filling the upper half of the frame, warm bright late-morning natural daylight from camera-front. Shot on 50–85mm portrait lens, full-body framing in tall vertical aspect, slight low-angle camera, shallow depth of field with creamy warm Prague cityscape bokeh behind. Groom: clean warm beige / oatmeal-tan notch-lapel two-piece formal suit with crisp soft-blue dress shirt and slim solid-yellow silk necktie, polished brown leather derby shoes, short neat dark side-swept hair, calm warm genuine bright soft closed-mouth smile, standing tall to camera-left holding the bride\'s right hand at his side. Bride: clean ivory champagne strapless sweetheart-neckline classic full wedding ball-gown with subtle ruched bodice and dramatic voluminous full satin / tulle skirt cascading lushly down to the cobblestone, soft fine-mesh white tulle short veil softly draped behind her hair, hair pulled back into a clean smooth low chignon with a small dainty white floral hair accessory tucked above her ear, dainty drop earrings, soft natural rosy makeup with bright big genuine open-mouth laughing smile, right hand raised enthusiastically high above her head holding a small loose bouquet of fresh bright-yellow sunflowers in a joyful celebratory cheer gesture. Pose: bride to camera-right standing tall close beside groom holding his hand with right arm raised high in joyful sunflower-cheer celebration, groom to camera-left standing tall close beside her facing camera with bright warm closed-mouth smile, refined romantic candid joyful European travel K-prewedding Prague moment. Color grade: warm bright midday daylight with clean saturated pale-blue sky and rich saturated terracotta red-roof Prague cityscape and rich saturated yellow sunflower accent, refined romantic K-prewedding international travel editorial atmosphere — must clearly read as warm bright Prague midday daylight, NOT golden hour, NOT studio.',
    manualKelvin: 5400,
    manualMoodHint:
      'warm bright midday Prague daylight at hilltop viewpoint over Prague Castle and red-roof Old Town, refined romantic candid joyful sunflower-cheer K-prewedding international travel mood',
    faceMaskRegions: [
      [0.28, 0.22, 0.16, 0.16],
      [0.54, 0.28, 0.16, 0.16],
    ],
  },
  {
    id: 'yacht-cabin-lean',
    label: '요트 캐빈 어깨 기댐',
    hint: '요트 캐빈 + 베이지 슈트 + 흰 슬립 + 어깨 기댐',
    category: 'beach',
    personality: 'together',
    intensity: 'high',
    framing: 'closeup',
    isSeated: true, // seated on cream-cushioned cabin bench
    image: '/wedding-snap/catalog/yacht-cabin-lean.jpg',
    promptHint:
      'Outdoor refined scene on the cream-cushioned bench seat inside the canopy cabin of a private sailing yacht moored on calm pastel-blue Mediterranean ocean (white canvas bimini canopy softly visible at top with soft cream cushion bench seat below, stainless steel railing softly visible at the cabin edges, distant warm hilltop coastal town with terracotta-roof buildings softly visible across the bay), warm late-afternoon golden-hour sun from camera-back creating warm honey rim light on hair and shoulders. Shot on 50–85mm portrait lens, chest-up close framing, eye-level camera, shallow depth of field on the couple with creamy warm Mediterranean coastal-town bokeh behind. Bride: clean ivory champagne spaghetti-strap fitted floor-length flowing satin slip-style wedding dress with subtle cowl V-neckline softly visible at the lower edge, long dark-brown softly waved hair flowing freely past her shoulders, dainty single-strand pearl necklace and dainty drop earrings, soft natural rosy makeup with calm warm content soft closed-mouth smile, seated calmly close to camera-left leaning her head and temple softly onto groom\'s right shoulder with eyes softly closed in a serene tender moment. Groom: clean warm beige / oatmeal-tan unstructured notch-lapel two-piece relaxed-fit formal linen suit with crisp white dress shirt (no tie, top button casually undone), short tousled dark brown hair with soft natural texture, calm cool serene composed neutral expression with mouth softly closed looking softly off into the distance toward camera-right, seated calmly close beside bride to camera-right with one arm warmly wrapped around her shoulders from behind. Pose: bride leaning her head softly onto groom\'s shoulder with eyes closed in serene tender moment, groom looking softly off into the distance, both in refined romantic intimate sailing-yacht European travel K-prewedding moment. Color grade: cinematic warm honey-amber Mediterranean golden-hour highlights with cool pastel-blue ocean accent and warm cream skin midtones, refined romantic European yachting K-prewedding sunset atmosphere — must clearly read as warm romantic Mediterranean late-afternoon golden hour on yacht, NOT noon, NOT studio.',
    manualKelvin: 3200,
    manualMoodHint:
      'cinematic warm honey-amber Mediterranean golden hour on private yacht cabin with cool pastel-blue ocean and warm coastal-town backdrop, refined romantic intimate European yachting K-prewedding sunset mood',
    faceMaskRegions: [
      [0.18, 0.20, 0.30, 0.42],
      [0.50, 0.10, 0.30, 0.42],
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
    framing: 'closeup',
    image: '/wedding-snap/catalog/groom-portrait-studio.jpg',
    promptHint:
      'Solo groom portrait — only the groom is in the frame, no bride, no other people. Indoor studio with seamless neutral gray backdrop, two-source softbox lighting from front-left and front-right at 45° down. Shot on 85mm portrait lens, chest-up to waist-up framing, eye-level camera, shallow depth of field. Groom: black peak-lapel tuxedo with white shirt and black bow tie, perfectly tailored, lapels crisp. Confident natural posture, slight head tilt, soft genuine smile or composed neutral expression. Editorial portrait atmosphere, neutral color grade with subtle warm midtones.',
    // solo 클로즈업 / 반신: 얼굴 정중앙 상단 — drift 가장 뚜렷한 케이스, blur 효과 큼.
    faceMaskRegions: [[0.30, 0.10, 0.40, 0.45]],
  },
  {
    id: 'bride-vintage-car',
    label: '신부 빈티지 카',
    hint: '클래식 컨버터블 + 풍성한 튤',
    category: 'outdoor',
    personality: 'bride-solo',
    framing: 'closeup',
    isSeated: true, // seated inside vintage convertible
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
    framing: 'full',
    hasSideAngle: true, // turning upper body back toward camera (3/4)
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
    framing: 'closeup',
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
    framing: 'full',
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
    framing: 'closeup',
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
    framing: 'full',
    hasSideAngle: true, // over right shoulder back toward camera
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
    framing: 'full',
    hasSideAngle: true, // seated sideways, face turned back over shoulder
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
    framing: 'full',
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
    framing: 'full',
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
    framing: 'full',
    hasSideAngle: true, // body turned to camera-right
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
    framing: 'closeup',
    hasSideAngle: true, // 80° profile, looking out window
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
    framing: 'closeup',
    isSeated: true, // seated centered on cream sofa
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
    framing: 'full',
    image: '/wedding-snap/catalog/bride-garden-ballgown.jpg',
    promptHint:
      'Solo bride shot — only the bride in frame, no groom, no other people. Outdoor refined private garden scene with a textured stone garden wall partially visible in the background covered with climbing dark-green ivy and tall lush dense leafy trees overhead filtering soft warm dappled afternoon natural sunlight onto the bride creating gentle warm rim on hair and shoulders, lush short green lawn underfoot at the bottom of the frame. Shot on 50–85mm portrait lens, full-body framing in tall vertical aspect, slight low-angle camera, shallow depth of field on the bride with creamy green foliage bokeh behind. Bride: clean ivory off-shoulder fitted-bodice voluminous full ball-gown wedding dress with delicate scattered floral lace appliqué embroidery throughout the bodice and skirt and dramatic full tulle layered skirt cascading lushly down to the lawn, long dark-brown hair styled into a single thick side-braided ponytail draped softly over her right shoulder, small dainty earrings, soft natural rosy makeup with warm gentle closed-mouth smile, holding a lush small loose cascade bouquet of white garden roses and fresh green eucalyptus and trailing greenery in her right hand at her hip. Pose: standing centered in the garden facing camera straight on with body slightly turned, both hands gently holding the bouquet at her right hip, looking softly toward camera with warm gentle closed-mouth smile and quiet eyes, refined classic Korean bridal magazine garden moment. Color grade: warm dappled greens with bright ivory dress and clean warm cream skin midtones, refined classic Korean K-prewedding magazine garden atmosphere — must clearly read as soft warm late-afternoon dappled garden daylight, NOT golden hour, NOT studio.',
    manualKelvin: 5400,
    manualMoodHint:
      'soft warm late-afternoon dappled garden daylight with stone-wall and ivy backdrop, refined classic Korean bridal editorial mood with side-braided hair and full ball-gown',
    // solo 풀신 — 얼굴은 프레임 상단 중앙, 비교적 작게.
    faceMaskRegions: [[0.40, 0.16, 0.22, 0.20]],
  },
  {
    id: 'bride-mirror-lipstick',
    label: '신부 거울 앞 립스틱',
    hint: '거울 앞 + 티아라·베일 + 립 메이크업 자세',
    category: 'studio',
    personality: 'bride-solo',
    intensity: 'low',
    framing: 'closeup',
    image: '/wedding-snap/catalog/bride-mirror-lipstick.jpg',
    promptHint:
      'Solo bride shot — only the bride in frame, no groom, no other people. Indoor bright wedding-day getting-ready studio scene with a tall vertical mirror with thin warm-tungsten LED light strip framing the visible left edge of the mirror in the background, soft warm diffused natural daylight from a hidden window creating clean luminous highlights on the bride with no harsh shadows. Shot on 85mm portrait lens, chest-up close framing, slight three-quarter (~10°) angle, eye-level camera, shallow depth of field. Bride: clean ivory strapless sweetheart-neckline classic ball-gown wedding dress with delicate intricate floral lace embroidery throughout the bodice softly visible at the lower edge of the frame, a delicate silver-tone bridal tiara / crown with crystals nestled prominently on her head, long fine-mesh white tulle cathedral veil softly draped behind her head, hair pulled back into a clean smooth low bun with side wisps, dainty pearl drop earring on the visible ear, delicate single-strand pearl necklace, soft natural pink-rosy makeup, holding a slim silver-tone lipstick tube up to her lips in her right hand in an elegant getting-ready beauty gesture. Pose: standing in front of the mirror looking softly toward camera while applying the lipstick with calm gentle natural expression, refined romantic bridal getting-ready editorial moment. Color grade: bright airy warm cream highlights with subtle warm tungsten mirror-light accent and clean warm cream skin midtones, refined dreamy bridal magazine getting-ready atmosphere — must clearly read as soft warm indoor natural-window-light getting-ready studio, NOT outdoor, NOT golden hour.',
    manualKelvin: 5000,
    manualMoodHint:
      'soft warm indoor getting-ready studio light with warm tungsten mirror-light accent, refined romantic bridal getting-ready editorial mood',
    faceMaskRegions: [[0.30, 0.14, 0.36, 0.40]],
  },
  {
    id: 'groom-fullbody-classic',
    label: '신랑 풀신 클래식 슈트',
    hint: '베이지 벽 + 보타이 + 부토니에 풀신',
    category: 'studio',
    personality: 'groom-solo',
    intensity: 'low',
    framing: 'full',
    image: '/wedding-snap/catalog/groom-fullbody-classic.jpg',
    promptHint:
      'Solo groom portrait — only the groom is in the frame, no bride, no other people. Indoor studio with seamless soft warm cream / beige painted plaster wall backdrop and warm honey wood plank floor, soft warm diffused natural daylight from a large hidden window creating clean luminous highlights, no harsh shadows. Shot on 50–85mm portrait lens, full-body framing in tall vertical aspect capturing the groom head-to-toe, slight low-angle camera, shallow depth of field. Groom: sharp black peak-lapel two-piece formal tuxedo with crisp white dress shirt, neat solid-black silk bow tie tied at the collar, and a beautiful prominent rustic dried beige / cream / dried pampas grass + dried-leaf boutonniere on the left lapel, polished black oxford shoes, short neat dark side-swept hair with soft natural texture, calm warm genuine soft closed-mouth smile. Pose: standing centered facing camera straight on with both hands casually tucked into trouser pockets, shoulders relaxed and slightly squared, calm confident editorial menswear stance. Color grade: bright airy warm cream / beige highlights with rich deep blacks of the tuxedo and warm cream skin midtones, refined classic Korean K-prewedding magazine menswear studio atmosphere — must clearly read as soft warm indoor natural-window-light studio, NOT outdoor, NOT golden hour.',
    manualKelvin: 5000,
    manualMoodHint:
      'soft warm indoor studio light with warm cream / beige wall backdrop, refined classic K-prewedding menswear full-body editorial mood',
    faceMaskRegions: [[0.40, 0.18, 0.20, 0.18]],
  },
  {
    id: 'bride-floral-bed-seated',
    label: '신부 꽃밭 앉음',
    hint: '파스텔 꽃밭 + 풀튤 가운 + 턱 받침 앉은 자세',
    category: 'studio',
    personality: 'bride-solo',
    intensity: 'low',
    framing: 'closeup',
    isSeated: true, // seated calmly in floral bed
    image: '/wedding-snap/catalog/bride-floral-bed-seated.jpg',
    promptHint:
      'Solo bride shot — only the bride in frame, no groom, no other people. Indoor bright dreamy studio scene with abundant pastel floral arrangements completely surrounding the bride and filling the entire background — tall stems of pastel pink garden roses, blush spray roses, lilac delphinium, pale-peach lisianthus, cream hydrangea and trailing greenery framing the bride on all sides, soft warm diffused beauty light from front creating clean luminous skin tones, no harsh shadows. Shot on 85mm portrait lens, chest-up close framing with bride centered surrounded by the floral bed, eye-level camera, shallow depth of field with creamy pastel floral bokeh. Bride: clean ivory strapless sweetheart-neckline classic wedding ball-gown with delicate beaded bodice and dramatic voluminous full tulle skirt cascading lushly around her into the floral bed, long honey-brown softly waved hair flowing freely past her shoulders with side parting, dainty large drop earring catching the light on visible ear, soft natural rosy makeup with warm bright genuine soft closed-mouth smile. Pose: seated calmly centered in the floral bed with body slightly turned, right hand softly raised under her chin in a relaxed elegant pose, looking softly toward camera with warm gentle smile and soft eyes, refined romantic dreamy bridal beauty editorial moment. Color grade: bright airy whites with abundant pastel pink / lilac / peach floral accents and clean warm cream skin midtones, refined dreamy minimalist bridal magazine beauty atmosphere — must clearly read as soft warm indoor studio beauty light, NOT outdoor, NOT golden hour.',
    faceMaskRegions: [[0.30, 0.10, 0.36, 0.40]],
  },
  {
    id: 'bride-offshoulder-bouquet',
    label: '신부 오프숄더 풀신',
    hint: '오프숄더 슬립 + 큰 화이트/핑크 부케 풀신',
    category: 'studio',
    personality: 'bride-solo',
    intensity: 'low',
    framing: 'full',
    image: '/wedding-snap/catalog/bride-offshoulder-bouquet.jpg',
    promptHint:
      'Solo bride shot — only the bride in frame, no groom, no other people. Indoor studio with seamless soft cool light-gray gradient backdrop, soft large diffused front beauty light creating clean luminous skin tones and very soft fall-off shadow, no harsh shadows. Shot on 50–85mm portrait lens, full-body / three-quarter framing in tall vertical aspect capturing the bride from head to just below the waist with floor space below, eye-level camera, shallow depth of field. Bride: clean ivory off-shoulder wide-cap-sleeve floor-length flowing satin slip-style wedding dress with elegant deep fold-over off-shoulder neckline (cape sleeves draping over upper arms) and soft natural A-line skirt cascading to floor with subtle sweep train, hair pulled back into a clean smooth low chignon with side wisps, dainty small earrings, soft natural rosy makeup with warm gentle closed-mouth smile, holding a lush large round bouquet of fresh white peonies, white garden roses, soft pink ranunculus and abundant trailing fresh green eucalyptus and ivy greenery cradled in both hands at chest level (bouquet dramatically large and the centerpiece of the frame). Pose: standing centered facing camera straight on with body slightly turned, both hands cradling the lush dramatic floral bouquet at chest level, calm soft gentle natural expression looking softly toward camera, refined classic Korean K-prewedding magazine bridal editorial moment. Color grade: bright airy whites with rich saturated fresh greens and soft pink/cream floral accents and clean warm cream skin midtones, refined classic Korean K-prewedding magazine bridal studio atmosphere — must clearly read as soft indoor studio beauty light, NOT outdoor, NOT golden hour.',
    faceMaskRegions: [[0.36, 0.10, 0.28, 0.30]],
  },
  {
    id: 'groom-beach-greensuit',
    label: '신랑 해변 그린 슈트',
    hint: '바다 + 짙은 그린 슈트 + 드라이 부케 옆모습',
    category: 'beach',
    personality: 'groom-solo',
    intensity: 'medium',
    framing: 'full',
    hasSideAngle: true, // body in profile, face turned over shoulder
    image: '/wedding-snap/catalog/groom-beach-greensuit.jpg',
    promptHint:
      'Solo groom portrait — only the groom is in the frame, no bride, no other people. Outdoor wide quiet beach scene with calm gray-blue ocean and softly breaking waves stretching to a flat horizon directly behind the groom, soft pale-gray overcast sky filling the upper half of the frame, warm beige wet sand underfoot, soft diffused even natural daylight (overcast — no harsh shadows). Shot on 50–85mm portrait lens, full-body framing in tall vertical aspect, slight three-quarter (~20°) angle with body in profile and face turned softly back toward camera, eye-level camera, shallow depth of field with creamy ocean bokeh behind. Groom: sharp tailored deep forest-green / hunter-green peak-lapel two-piece formal suit with crisp white dress shirt (no tie, top button casually undone), a beautiful prominent dried pampas grass + dusty pink dried-rose + dried-greenery boutonniere on the left lapel, polished black oxford shoes, short neat dark side-swept hair, calm cool serene neutral expression with mouth softly closed, refined moody editorial menswear feel. Pose: standing tall in profile facing camera-left with body in three-quarter angle, both hands behind the back warmly holding a large rustic asymmetric bouquet of dried pampas grass, dried pale-pink garden roses, dried eucalyptus and dried beige-toned florals trailing down behind him, head turned softly back over his right shoulder toward camera with quiet introspective gaze, refined cinematic moody coastal menswear editorial moment. Color grade: cool muted gray-blue ocean and pale overcast sky with rich deep saturated forest-green suit accent and warm cream skin midtones, refined moody cinematic Korean K-prewedding coastal editorial atmosphere — must clearly read as soft cool overcast daylight at a quiet beach, NOT golden hour, NOT studio.',
    manualKelvin: 6000,
    manualMoodHint:
      'soft cool overcast daylight at a quiet beach with saturated deep forest-green suit accent and dried-floral menswear bouquet, refined moody cinematic Korean K-prewedding coastal mood',
    faceMaskRegions: [[0.36, 0.16, 0.22, 0.20]],
  },
  {
    id: 'groom-hotel-stairs',
    label: '신랑 호텔 계단 단독',
    hint: '호텔 인테리어 계단 + 검정 턱시도 + 옆모습 풀신',
    category: 'studio',
    personality: 'groom-solo',
    intensity: 'medium',
    framing: 'full',
    image: '/wedding-snap/catalog/groom-hotel-stairs.jpg',
    promptHint:
      'Solo groom portrait — only the groom is in the frame, no bride, no other people. Indoor refined luxury hotel interior scene with warm cream / beige marble walls and polished cream marble staircase steps descending diagonally to camera-front-right, soft warm tungsten pendant lamp glowing softly to camera-right at upper-third height casting warm key light, dramatic soft sharp shadow of the groom\'s silhouette projected onto the cream marble wall to camera-left, polished bronze stainless-steel staircase handrail to camera-right, warm cinematic mood. Shot on 50–85mm portrait lens, full-body framing in tall vertical aspect capturing the groom head-to-toe descending the staircase, slight three-quarter (~30°) angle with body turned to camera-right and face softly turned back over right shoulder, slight low-angle camera, shallow depth of field. Groom: sharp black peak-lapel two-piece formal tuxedo with crisp white wing-collar dress shirt, neat solid-black silk bow tie tied at the collar, and a crisp white pocket-square neatly folded in the breast pocket, polished black derby shoes, short neat dark side-swept hair with soft natural texture, calm warm composed genuine soft closed-mouth smile with eyes softly looking off into the distance to camera-right. Pose: standing tall descending one of the marble staircase steps with body turned in three-quarter angle and right hand softly resting on the bronze staircase handrail, left arm relaxed at side, refined cinematic editorial menswear hotel-arrival moment. Color grade: cinematic warm cream marble highlights with warm tungsten pendant lamp glow and rich deep blacks of the tuxedo, refined cinematic Korean K-prewedding luxury-hotel menswear editorial atmosphere — must clearly read as warm cinematic indoor luxury-hotel tungsten light, NOT outdoor, NOT golden hour, NOT studio gray backdrop.',
    manualKelvin: 3600,
    manualMoodHint:
      'warm cinematic luxury-hotel marble staircase interior with warm tungsten pendant glow and dramatic silhouette shadow, refined cinematic Korean K-prewedding menswear hotel-arrival editorial mood',
    faceMaskRegions: [[0.32, 0.16, 0.20, 0.20]],
  },
  {
    id: 'bride-nyc-chrysler',
    label: '신부 NYC 크라이슬러 빌딩',
    hint: '뉴욕 6번가 + 크라이슬러 빌딩 + 오프숄더 풀신',
    category: 'urban',
    personality: 'bride-solo',
    intensity: 'medium',
    framing: 'full',
    image: '/wedding-snap/catalog/bride-nyc-chrysler.jpg',
    promptHint:
      'Solo bride shot — only the bride in frame, no groom, no other people. Outdoor downtown Manhattan New York scene on a stone-balustrade pedestrian overpass overlooking 6th Avenue / Park Avenue with the iconic Art Deco Chrysler Building clearly visible rising tall and centered in the soft-focus background, abundant yellow NYC taxi cabs softly visible driving along the avenue below, tall historic Manhattan glass-and-stone skyscrapers framing both sides, clean bright pale-blue sky with soft warm white cumulus clouds filling the upper background, warm late-afternoon natural daylight from camera-back creating warm rim on hair and the bride\'s veil. Shot on 50–85mm portrait lens, full-body framing in tall vertical aspect, slight low-angle camera, shallow depth of field with creamy NYC cityscape bokeh behind. Bride: clean ivory champagne off-shoulder portrait-collar / shawl-collar sweetheart-neckline floor-length fitted satin mermaid wedding dress with subtle ruched bodice and dramatic long sweep train cascading lushly behind her, hair pulled back into a clean smooth low chignon with side wisps, dainty single-strand pearl necklace and large dainty pearl drop earrings, soft natural rosy makeup with deep rich burgundy lip, holding a small loose cascade bouquet of fresh white anemones and trailing greenery in her right hand at her hip. Pose: standing tall facing camera straight on with body slightly turned to camera-right and left hand softly resting on the stone-balustrade railing, looking softly toward camera with calm cool serene composed neutral expression with mouth softly closed, refined modern editorial Korean K-prewedding international travel NYC moment. Color grade: warm bright late-afternoon urban daylight with rich saturated NYC yellow-cab and stone-skyscraper accents and clean warm cream skin midtones, refined modern editorial Korean K-prewedding international travel atmosphere — must clearly read as warm bright late-afternoon NYC daylight, NOT golden hour, NOT studio.',
    manualKelvin: 5200,
    manualMoodHint:
      'warm bright late-afternoon NYC urban daylight overlooking 6th Avenue with iconic Chrysler Building backdrop and yellow-cab accents, refined modern editorial Korean K-prewedding international travel mood',
    faceMaskRegions: [[0.42, 0.20, 0.18, 0.18]],
  },

  // ─────────────────────────────────────────────────────────
  // 2026-05 신규 13장 (Gemini 10 + nano-banana 3) — 커플 10 / 신부 3
  // ─────────────────────────────────────────────────────────
  {
    id: 'beach-sunset-sparkler-couple',
    label: '비치 일몰 스파클러',
    hint: '핑크 sky + 스파클러 + 베일 슬립드레스',
    category: 'beach',
    personality: 'together',
    intensity: 'high',
    framing: 'full',
    image: '/wedding-snap/catalog/beach-sunset-sparkler-couple.jpg',
    promptHint:
      'Outdoor beach scene at golden / pink hour right after sunset — soft pastel pink-to-lavender sky gradient filling the upper half, calm dark sea horizon mid-frame with gentle small waves, wide soft beige sand stretching to the foreground with the couple barefoot on the sand. Two lit sparkler / firework sticks held one in each of their outer hands sending bright warm-white sparks outward and slightly downward (no overexposed core blow-out, sparks read as defined particles). Shot on 50–85mm portrait lens, full-body framing in tall vertical aspect, eye-level camera, shallow depth of field with creamy sea bokeh behind. Bride: simple sleeveless ivory satin slip A-line wedding dress with subtle square neckline, short flowing tulle veil with small pearl-pin hair accent, hair softly tucked behind one ear, soft natural rosy makeup with neutral lip, holding a small loose bouquet of cream garden roses at her waist with her free hand, leaning warmly into the groom. Groom: pale soft pink button-up shirt sleeves rolled, slim navy formal trousers, dark thin tie, short neat dark hair, soft natural relaxed smile, his free arm gently around the bride’s shoulder. Pose: couple standing close side by side facing camera, both holding sparklers outward, both softly smiling at camera with calm joyful relaxed expressions, refined modern Korean K-prewedding beach sunset moment. Color grade: warm pink-lavender pastel sky highlights with deep navy sea shadows, warm cream skin midtones, gentle film grain — must clearly read as warm soft just-after-sunset beach light, NOT noon, NOT studio.',
    manualKelvin: 3200,
    manualMoodHint:
      'pastel pink-lavender post-sunset beach sky with warm sparkler glow, calm dark sea horizon, gentle film grain, refined modern Korean K-prewedding mood',
    faceMaskRegions: [
      [0.30, 0.30, 0.16, 0.16],
      [0.52, 0.24, 0.16, 0.16],
    ],
  },
  {
    id: 'brick-alley-blackwhite-couple',
    label: '브릭 골목 흑백 미니드레스',
    hint: '벽돌벽 + 흑백 + 신랑 앉음 + 미니 튤 드레스',
    category: 'urban',
    personality: 'together',
    intensity: 'high',
    framing: 'full',
    hasSideAngle: false,
    isSeated: true, // 신랑은 stone step 에 앉음
    image: '/wedding-snap/catalog/brick-alley-blackwhite-couple.jpg',
    promptHint:
      'Outdoor narrow downtown brick alley scene, tall textured red-brick walls filling both sides with subtle weathering and seam lines, single small stone step / curb where the groom is seated. Shot on 50–85mm portrait lens, full-body framing in tall vertical aspect, slight low-angle eye-level camera, shallow depth of field with crisp brick wall behind. **Render the final image in deep monochrome black-and-white** with rich blacks and clean midtone grays, magazine editorial mood. Groom: slim black two-piece suit with thin black tie and crisp white shirt, polished black oxford shoes, short dark hair loosely parted, calm composed neutral expression looking softly toward camera, seated on the stone step with knees apart and elbows resting on knees, both hands relaxed. Bride: short above-the-knee ivory tulle mini wedding dress with structured corset bodice and bustier sweetheart neckline, dramatic ruffled long puff sleeve falling off the shoulder on one side, white pointed-toe pumps, hair pulled back in a soft low chignon with side wisps, soft neutral makeup, holding a small loose dried-flower bouquet with trailing ribbon in her right hand at her hip. Pose: groom seated on the step on the left, bride standing tall next to him on the right with body slightly turned 3/4 toward camera, her left hand gently resting on his shoulder / head, both with calm cool neutral introspective magazine-editorial expressions (no smiles). Color grade: pure deep monochrome black-and-white with rich blacks and clean midtone grays, subtle film grain — must clearly read as editorial monochrome alley shoot, NOT studio, NOT color.',
    manualKelvin: 5500,
    manualMoodHint:
      'editorial monochrome black-and-white narrow brick alley shoot, calm cool neutral magazine mood, subtle film grain',
    faceMaskRegions: [
      [0.22, 0.42, 0.16, 0.16],
      [0.50, 0.20, 0.16, 0.16],
    ],
  },
  {
    id: 'hanok-corridor-bride-peek',
    label: '한옥 회랑 신부 한복',
    hint: '한옥 단청 회랑 + 베이지 저고리 + 민트 치마',
    category: 'tradition',
    personality: 'bride-solo',
    intensity: 'medium',
    framing: 'closeup',
    image: '/wedding-snap/catalog/hanok-corridor-bride-peek.jpg',
    promptHint:
      'Solo bride shot — only the bride in frame, no groom, no other people. Outdoor traditional Korean palace hanok wooden corridor with rich vermilion-red lacquered columns receding into the soft-focus background, ornate green-and-red dancheong painted ceiling beams above, smooth grey stone floor below, warm soft daylight filtering through the corridor. Shot on 50–85mm portrait lens, chest-up / waist-up framing, eye-level camera, shallow depth of field with creamy red-column bokeh behind. Bride: traditional Korean hanbok — cream / ivory pale jeogori (top jacket) with delicate pale floral white embroidery, deep mint-green floor-length chima (skirt) softly draped, hair pulled back in a clean smooth low chignon with traditional red-and-gold binyeo / daenggi hairpin accents on each side, soft natural rosy makeup with neutral pink lip. Pose: bride standing tall in the center of the corridor facing camera straight on with body slightly turned 3/4 toward camera, both hands gently resting at front, looking softly toward camera with calm refined elegant composed expression with mouth softly closed. Color grade: warm bright daylight in red-vermillion palace corridor with rich red-column accents and mint-green hanbok focal color, refined K-traditional editorial atmosphere — must clearly read as warm bright daylight, NOT golden hour, NOT studio.',
    manualKelvin: 5200,
    manualMoodHint:
      'warm bright daylight in vermilion-and-dancheong hanok corridor, refined K-traditional editorial mood, soft floral hanbok focal color',
    faceMaskRegions: [[0.38, 0.30, 0.22, 0.22]],
  },
  {
    id: 'night-rain-umbrella-couple',
    label: '비오는 밤 우산 산책',
    hint: '도심 다리 + 비 + 투명 우산 + 손잡고 웃기',
    category: 'urban',
    personality: 'together',
    intensity: 'high',
    framing: 'closeup',
    image: '/wedding-snap/catalog/night-rain-umbrella-couple.jpg',
    promptHint:
      'Outdoor pedestrian bridge / promenade in a downtown city at rainy night, soft warm tungsten paper-lantern / shop window lights bokeh in the deep background, wet glistening bridge floor reflecting orange light streaks, gentle rain visible as soft streaks across the frame. A single transparent dome umbrella held by the groom above both heads catching the warm light. Shot on 50–85mm portrait lens, three-quarter chest-up framing, eye-level camera, shallow depth of field with creamy warm rainy-city bokeh behind. Bride: pale champagne / ivory short-sleeve A-line silky satin midi wedding dress with sweetheart neckline, sleek center-parted long hair, soft natural rosy makeup with neutral lip. Groom: light beige / cream two-piece formal suit with light blue shirt unbuttoned at collar (no tie), short neat dark hair. Pose: couple walking close together holding hands, both leaning warmly into each other under the transparent umbrella, both laughing freely and looking at each other with big genuine candid smiles — joyful candid prewedding rainy walk movement, not a static pose. Color grade: warm tungsten night palette with golden orange highlights, deep cool teal-blue shadows in wet pavement reflections, gentle film grain — must clearly read as warm rainy city night, NOT golden hour, NOT studio.',
    manualKelvin: 3000,
    manualMoodHint:
      'warm tungsten rainy city night under transparent umbrella, joyful candid laughing prewedding mood, golden-orange highlights with teal wet-pavement reflections, gentle film grain',
    faceMaskRegions: [
      [0.22, 0.32, 0.18, 0.20],
      [0.56, 0.18, 0.18, 0.22],
    ],
  },
  {
    id: 'hanok-royal-purple-couple',
    label: '한옥 보라 한복 커플',
    hint: '한옥 누각 + 갓 + 보라 두루마기 + 보라 저고리',
    category: 'tradition',
    personality: 'together',
    intensity: 'medium',
    framing: 'full',
    image: '/wedding-snap/catalog/hanok-royal-purple-couple.jpg',
    promptHint:
      'Outdoor traditional Korean palace courtyard with classic green-and-red dancheong painted hanok pavilion roof rising in the soft-focus background, neat manicured low pine trees on each side, smooth stone-paved courtyard floor underfoot, clean bright pale-blue sky with soft warm white cumulus clouds, warm bright midday daylight. Shot on 50–85mm portrait lens, full-body framing in tall vertical aspect, slight low-angle eye-level camera, shallow depth of field with creamy hanok bokeh behind. Groom: traditional Korean royal hanbok — pale lavender-purple floor-length durumagi (long coat) over a white inner robe, deep navy-blue waist sash, white baji trousers, brown leather hwa boots, classic black gat traditional hat with sheer brim, short neat dark hair, calm composed soft neutral expression. Bride: traditional Korean royal hanbok — lavender-purple short jeogori jacket with crisp white collar trim over a long floor-length white chima skirt with subtle volume, pale embroidered norigae traditional pendant draping at the waist, hair pulled into a clean smooth low chignon with traditional pink-and-gold floral binyeo / daenggi hairpin and small flower accents framing the temples, soft natural rosy makeup with neutral pink lip. Pose: couple standing close side by side facing camera, both bodies slightly turned 3/4 toward camera, hands gently clasped softly in front, both with calm refined elegant serene expressions with mouth softly closed, refined royal K-traditional editorial mood. Color grade: warm bright midday daylight in hanok palace courtyard with rich lavender-purple hanbok and dancheong color accents, refined royal K-traditional editorial atmosphere — must clearly read as warm bright midday daylight, NOT golden hour, NOT studio.',
    manualKelvin: 5400,
    manualMoodHint:
      'warm bright midday daylight in palace hanok courtyard, lavender-purple royal hanbok focal color with dancheong accents, refined K-traditional editorial mood',
    faceMaskRegions: [
      [0.26, 0.20, 0.18, 0.18],
      [0.56, 0.24, 0.16, 0.16],
    ],
  },
  {
    id: 'yosemite-trail-walk',
    label: '요세미티 트레일 워킹',
    hint: '하프돔 + 화이트 턱시도 + 골든아워 트레일',
    category: 'outdoor',
    personality: 'together',
    intensity: 'high',
    framing: 'full',
    image: '/wedding-snap/catalog/yosemite-trail-walk.jpg',
    promptHint:
      'Outdoor mountain national park scene on a soft asphalt trail with a dramatic granite half-dome / monolithic mountain cliff rising prominently in the soft-focus background, scattered tall pine trees framing both sides, warm late-afternoon golden-hour natural sunlight from camera-back-right creating strong warm rim on hair and shoulders with a soft sun-flare in the upper-right corner. Shot on 35–50mm portrait lens for environmental walking feel, full-body framing in tall vertical aspect, slight low-angle eye-level camera, shallow depth of field with creamy mountain bokeh behind. Groom: clean ivory / white peak-lapel tuxedo jacket with black satin lapel accent, black bow tie, white shirt, slim black formal trousers, polished black oxford shoes, short neat dark hair, soft natural laughing smile looking at the bride. Bride: lush ivory tulle A-line / ballgown floor-length wedding dress with delicate lace bodice and deep V-neckline thin straps, long loose dark wavy hair flowing past her shoulders, soft natural rosy makeup with neutral lip, holding a loose cascading bouquet of white roses with trailing green eucalyptus in her free hand. Pose: couple walking side by side along the trail holding hands, both turned slightly toward each other looking at one another with big genuine candid laughing smiles mid-step — candid joyful prewedding walking moment, not a static pose. Color grade: warm golden-hour highlights with soft sun-flare and rich saturated mountain greens, warm cream skin midtones, gentle film grain — must clearly read as warm late-afternoon golden hour, NOT noon, NOT studio.',
    manualKelvin: 3200,
    manualMoodHint:
      'warm golden-hour mountain trail with dramatic half-dome backdrop, sun-flare and joyful candid laughing walk, gentle film grain',
    faceMaskRegions: [
      [0.28, 0.32, 0.16, 0.18],
      [0.56, 0.30, 0.16, 0.18],
    ],
  },
  {
    id: 'bride-pink-hanbok-studio',
    label: '신부 핑크 한복 스튜디오',
    hint: '아이보리 저고리 + 핑크 치마 + 베이지 드레이프 배경',
    category: 'studio',
    personality: 'bride-solo',
    intensity: 'low',
    framing: 'full',
    image: '/wedding-snap/catalog/bride-pink-hanbok-studio.jpg',
    promptHint:
      'Solo bride shot — only the bride in frame, no groom, no other people. Indoor studio with soft beige / cream warm-toned draped fabric backdrop filling the upper background and pale wooden floor underfoot, soft diffused natural-feel studio light from camera-left creating gentle soft shadows. Shot on 50–85mm portrait lens, full-body framing in tall vertical aspect, eye-level camera, shallow depth of field. Bride: traditional Korean hanbok — pale ivory-cream short jeogori (top jacket) with crisp white collar trim and a small pale pink bow knot, voluminous floor-length pastel pink chima (skirt) with subtle soft embroidered white floral motifs along the lower hem, pale pink ribbon tied at the waist, hair pulled back into a clean smooth low chignon with delicate floral pink-and-white binyeo hairpin accent above one ear, soft natural rosy makeup with neutral pink lip, hands gently resting softly at her side. Pose: bride standing tall facing camera straight on with body slightly turned 3/4 toward camera-right, soft serene composed elegant calm expression with mouth softly closed, refined K-traditional studio bridal magazine mood. Color grade: warm soft cream and pastel pink palette with clean warm skin midtones, refined K-traditional editorial bridal magazine atmosphere — must clearly read as soft warm studio light, NOT golden hour, NOT bright outdoor.',
    faceMaskRegions: [[0.42, 0.18, 0.16, 0.16]],
  },
  {
    id: 'vintage-parlor-veil-lap',
    label: '빈티지 응접실 무릎 베개',
    hint: '동양화 액자 + 빈티지 소파 + 베일 + 무릎 베개',
    category: 'studio',
    personality: 'together',
    intensity: 'medium',
    framing: 'closeup',
    isSeated: true, // 신부 앉은 자세 + 신랑 무릎 베개
    image: '/wedding-snap/catalog/vintage-parlor-veil-lap.jpg',
    promptHint:
      'Indoor warm vintage parlor / antique sitting room scene, dark mahogany wooden wall paneling in the background with a traditional East-Asian landscape ink painting framed and hung at center, vintage marble-top antique side table with a small white potted plant and small antique kettle and worn old hardback books, vintage upholstered floral pattern sofa with cream and soft beige tones where the couple is posed. Shot on 50–85mm portrait lens, chest-up / waist-up framing, eye-level camera, shallow depth of field with crisp antique parlor backdrop behind. Bride: ivory off-shoulder lace fit-and-flare wedding dress with delicate lace bodice and short ruffled sleeves, long sheer cathedral veil softly draping behind her hair and over her shoulders, long center-parted dark wavy hair flowing past her shoulders, soft natural rosy makeup with rich rosy red lip, both hands gently cradling the groom’s head resting on her lap. Groom: clean white classic dress shirt sleeves rolled (no jacket), short neat dark hair, calm composed soft neutral expression with mouth softly closed, lying with his head softly resting in the bride’s lap. Pose: bride seated upright on the vintage sofa looking softly toward camera with calm refined elegant magazine-editorial expression (subtle gentle smile only), groom lying with his head softly cradled in her lap looking softly toward camera with calm composed expression, refined modern Korean K-prewedding vintage-parlor editorial mood. Color grade: warm vintage interior palette with rich mahogany browns and warm cream skin midtones, soft warm indoor light, subtle film grain — must clearly read as warm vintage indoor parlor light, NOT golden hour, NOT bright outdoor.',
    manualKelvin: 3400,
    manualMoodHint:
      'warm vintage parlor interior with antique floral sofa and East-Asian landscape painting, refined modern Korean K-prewedding editorial mood, subtle film grain',
    faceMaskRegions: [
      [0.46, 0.20, 0.18, 0.20],
      [0.32, 0.58, 0.18, 0.20],
    ],
  },
  {
    id: 'jeju-rocky-veil-couple',
    label: '제주 바위 일몰 베일',
    hint: '제주 화산암 + 긴 베일 + 머메이드 드레스 + 핑크 부케',
    category: 'outdoor',
    personality: 'together',
    intensity: 'medium',
    framing: 'full',
    image: '/wedding-snap/catalog/jeju-rocky-veil-couple.jpg',
    promptHint:
      'Outdoor Jeju-island volcanic-rocky coastline scene at warm late-afternoon hour, dark grey volcanic basalt rocks scattered across the foreground where the couple stands, calm pale-blue sea horizon mid-frame with distant blue mountain silhouettes in the soft-focus background, clean pale-blue sky filling the upper half, warm soft natural sunlight from camera-left creating soft rim on hair and the bride’s veil. Shot on 50–85mm portrait lens, full-body framing in tall vertical aspect, eye-level camera, shallow depth of field with creamy sea bokeh behind. Bride: clean ivory satin strapless sweetheart-neckline floor-length fitted mermaid wedding dress with subtle ruched bodice and dramatic long sweep train cascading lushly behind her over the rocks, long dramatic cathedral-length sheer tulle veil softly flowing in the sea breeze to camera-left, hair pulled back into a clean smooth low chignon, soft natural rosy makeup with neutral pink lip, holding a loose round bouquet of soft pink garden roses with trailing pink silk ribbon at her front in both hands. Groom: classic black peak-lapel two-piece tuxedo with crisp white shirt and slim black silk bow tie, polished black oxford shoes, short neat dark hair, soft natural calm composed expression with subtle gentle smile. Pose: couple standing close side by side facing camera, bride softly leaning into the groom with her left arm linked through his right arm, both bodies slightly turned 3/4 toward camera, both with calm refined elegant serene composed expressions, refined modern Korean K-prewedding island coastal editorial mood. Color grade: warm soft late-afternoon coastal daylight with rich saturated pink-bouquet accent and clean warm cream skin midtones, refined modern Korean K-prewedding atmosphere — must clearly read as warm bright late-afternoon coastal light, NOT golden hour, NOT studio.',
    manualKelvin: 5000,
    manualMoodHint:
      'warm soft late-afternoon Jeju volcanic-rocky coastline with flowing cathedral veil, refined modern Korean K-prewedding island coastal editorial mood',
    faceMaskRegions: [
      [0.32, 0.28, 0.14, 0.16],
      [0.54, 0.24, 0.14, 0.16],
    ],
  },
  {
    id: 'bride-rose-garden-pink-seated',
    label: '신부 장미정원 핑크 드레스',
    hint: '흰 장미 + 핑크 튤 + 잔디 앉은 자세',
    category: 'outdoor',
    personality: 'bride-solo',
    intensity: 'medium',
    framing: 'full',
    isSeated: true,
    image: '/wedding-snap/catalog/bride-rose-garden-pink-seated.jpg',
    promptHint:
      'Solo bride shot — only the bride in frame, no groom, no other people. Outdoor lush english-garden scene framed by abundant white garden rose climbing arches on each side filling both edges of the frame, soft green ornamental grass and small white baby’s-breath flowers scattered across the foreground, soft diffused overcast natural daylight creating gentle soft light on the subject. Shot on 50–85mm portrait lens, full-body framing in tall vertical aspect, eye-level camera, shallow depth of field with creamy white-rose floral bokeh behind. Bride: lush pastel dusty-pink tulle floor-length ball-gown wedding dress with off-shoulder sweetheart neckline and delicate beaded bodice with subtle floral applique, full layered tulle skirt softly spread around her on the grass, long center-parted dark wavy hair flowing past her shoulders with small dainty pearl drop earrings, soft natural rosy makeup with neutral pink lip. Pose: bride seated softly on the green grass facing camera, knees gently folded to one side under the tulle skirt, one arm resting gently on the raised knee with hand gently cradling chin / cheek, looking softly toward camera with calm refined elegant serene composed expression with mouth softly closed, refined modern Korean K-prewedding garden editorial bridal magazine mood. Color grade: soft pastel pink and crisp white-rose floral palette with rich green-foliage accents and clean warm cream skin midtones, soft diffused overcast daylight, refined modern Korean K-prewedding bridal magazine atmosphere — must clearly read as soft overcast garden daylight, NOT golden hour, NOT studio.',
    faceMaskRegions: [[0.42, 0.28, 0.16, 0.16]],
  },
  {
    id: 'desert-vintage-convertible-couple',
    label: '사막 빈티지 컨버터블',
    hint: '흰 컨버터블 + 검은 턱시도 + 선글라스 + 사막 산',
    category: 'outdoor',
    personality: 'together',
    intensity: 'medium',
    framing: 'full',
    isSeated: true, // 신부는 차 트렁크에 앉음, 신랑 기댐
    image: '/wedding-snap/catalog/desert-vintage-convertible-couple.jpg',
    promptHint:
      'Outdoor cinematic wide-frame desert scene with a dramatic rugged grey-and-tan mountain range rising in the soft-focus background, sparse pale dune grass and small desert shrubs scattered across the mid-ground, soft beige sand foreground where the couple is posed beside a classic 1960s vintage white convertible cabriolet car parked across the lower half of the frame with one rear door open. Shot on 50mm cinematic lens, wide-frame full-body framing in square / 1:1 aspect, eye-level camera, shallow depth of field with crisp mountain backdrop behind. Groom: classic black peak-lapel two-piece tuxedo with crisp white shirt and slim black silk bow tie, polished black oxford shoes, slim black wayfarer sunglasses, short neat dark hair, calm cool neutral composed expression with mouth softly closed, leaning casually back against the open car door with arms relaxed at sides. Bride: clean ivory tulle strapless sweetheart-neckline midi-length wedding dress with subtle beaded bodice and full layered tulle skirt, hair softly center-parted and pulled into a clean smooth low chignon, large slim white cat-eye sunglasses, delicate white strappy heel sandals, holding a loose round bouquet of dried pale pampas grass and cream protea in her right hand at her hip. Pose: groom standing left side casually leaning back against the open car door with arms relaxed at sides, bride seated on the right rear car seat with legs gently crossed and dress flowing out of the car, both bodies turned 3/4 toward camera, both with calm cool neutral magazine-editorial expressions (no smiles, refined editorial mood). Color grade: warm desert-beige and tan mountain palette with crisp white-car accent and clean warm cream skin midtones, refined editorial Korean K-prewedding cinematic-desert atmosphere — must clearly read as warm bright daylight, NOT golden hour, NOT studio.',
    manualKelvin: 5400,
    manualMoodHint:
      'warm cinematic desert daylight with classic white vintage convertible and rugged mountain backdrop, refined editorial Korean K-prewedding cool neutral mood',
    faceMaskRegions: [
      [0.28, 0.24, 0.14, 0.16],
      [0.56, 0.34, 0.14, 0.16],
    ],
  },
  {
    id: 'wooden-stairs-bouquet-couple',
    label: '우드 계단 안개꽃 부케',
    hint: '빈티지 우드 계단 + 안개꽃 부케 + 활짝 웃음',
    category: 'studio',
    personality: 'together',
    intensity: 'low',
    framing: 'full',
    isSeated: true,
    image: '/wedding-snap/catalog/wooden-stairs-bouquet-couple.jpg',
    promptHint:
      'Indoor warm vintage Korean K-traditional house interior scene with rich golden-brown polished wooden staircase rising steeply behind the couple filling most of the frame, ornate carved wooden banister on the right side, soft diffused warm natural daylight from camera-left filtering through an off-frame window creating gentle soft light on the subjects. Shot on 50–85mm portrait lens, full-body framing in square / 1:1 aspect, eye-level camera, shallow depth of field with crisp wooden staircase backdrop behind. Groom: classic black notch-lapel two-piece suit jacket with crisp white shirt and slim deep navy silk tie, soft cream / off-white slim chino trousers, polished black ankle boots, short neat dark hair, big genuine candid laughing smile looking softly toward camera with eyes softly crinkled. Bride: clean ivory satin strapless sweetheart-neckline classic A-line floor-length wedding dress with subtle ruched bodice and gracefully draped soft skirt, short flowing tulle veil softly draped behind her hair, hair pulled back into a clean smooth low chignon with small dainty pearl drop earrings, soft natural rosy makeup with neutral pink lip, holding a generous lush round bouquet of pure soft white baby’s-breath flowers in both hands at her front. Pose: couple seated close together on the wooden staircase steps facing camera, both turned slightly toward each other shoulder-to-shoulder, both with big genuine candid laughing smiles looking softly toward camera with eyes softly crinkled in joy — joyful candid prewedding moment, refined modern Korean K-prewedding editorial mood. Color grade: warm golden-brown wooden interior palette with soft cream-bouquet floral accent and clean warm cream skin midtones, soft diffused warm indoor daylight, refined modern Korean K-prewedding bridal magazine atmosphere — must clearly read as soft warm indoor daylight, NOT golden hour, NOT bright outdoor.',
    manualKelvin: 4200,
    manualMoodHint:
      'soft diffused warm indoor daylight on golden-brown vintage Korean wooden staircase, joyful candid laughing prewedding mood, refined bridal-magazine editorial atmosphere',
    faceMaskRegions: [
      [0.28, 0.24, 0.16, 0.18],
      [0.52, 0.24, 0.16, 0.18],
    ],
  },
  {
    id: 'countryside-sunflower-leather',
    label: '시골길 해바라기 가죽자켓',
    hint: '시골 마을 골목 + 가죽자켓 + 해바라기 부케 + 미니 드레스',
    category: 'outdoor',
    personality: 'together',
    intensity: 'medium',
    framing: 'full',
    image: '/wedding-snap/catalog/countryside-sunflower-leather.jpg',
    promptHint:
      'Outdoor nostalgic Korean countryside village street scene at warm late-afternoon golden-hour, small low Korean countryside village houses with pale-blue and cream painted facades and grey tile roofs lining both sides of the small paved street receding into the soft-focus distance, tall slim wooden utility power pole with low overhead lines visible mid-ground, small bushes of red roses and shrubs along both sides of the road, distant low rolling green hills visible at the horizon, clean pale-blue sky with subtle warm pastel pink-and-orange golden-hour gradient at the top, warm soft late-afternoon natural sunlight from camera-back. Shot on 35–50mm portrait lens for environmental feel, full-body framing in square / 1:1 aspect, eye-level camera, shallow depth of field with creamy countryside-village bokeh behind. Groom: classic black biker / motorcycle leather jacket over a crisp light-blue chambray button-up shirt with slim retro-pattern beige-and-rust necktie, slim cream / off-white slim chino trousers, brown leather oxford shoes, short neat dark hair softly side-parted, calm composed soft neutral expression with subtle gentle smile. Bride: short above-the-knee ivory tiered ruffle puff-sleeve A-line wedding mini-dress with sweetheart neckline, short flowing tulle veil softly draped behind her hair, hair pulled back into a soft low half-up style, soft natural rosy makeup with neutral pink lip, white socks with white round-toe Mary-Jane flats, holding a generous round bouquet of vibrant fresh yellow sunflowers in both hands at her front. Pose: couple standing close side by side in the middle of the small countryside street facing camera straight on, both bodies slightly turned 3/4 toward camera, both with calm composed soft neutral expressions with subtle gentle smiles, refined nostalgic retro Korean K-prewedding countryside editorial mood. Color grade: warm soft late-afternoon countryside golden-hour palette with rich saturated sunflower-yellow bouquet focal accent, pastel-orange-and-pink sky gradient, warm cream skin midtones, gentle film grain — must clearly read as warm late-afternoon countryside golden-hour daylight, NOT noon, NOT studio.',
    manualKelvin: 3600,
    manualMoodHint:
      'warm late-afternoon golden-hour Korean countryside village street with sunflower-bouquet focal accent and pastel sky gradient, refined nostalgic retro Korean K-prewedding editorial mood, gentle film grain',
    faceMaskRegions: [
      [0.30, 0.18, 0.14, 0.18],
      [0.56, 0.20, 0.14, 0.18],
    ],
  },
  // ── 신규 추가 (2026-05) ──
  {
    id: 'hotel-corridor-couple-walk',
    label: '호텔 복도 워킹샷',
    hint: '클래식 호텔 카펫 복도 + 정장 + 머메이드 드레스',
    category: 'urban',
    personality: 'together',
    intensity: 'medium',
    framing: 'full',
    image: '/wedding-snap/catalog/hotel-corridor-couple-walk.jpg',
    promptHint:
      'Indoor classic European-style luxury hotel corridor scene with rich warm wood-paneled walls and tall paneled doors on both sides, ornate gold-framed paintings hung along the walls at eye-level, brass-and-glass dome ceiling sconces softly glowing warm tungsten light from above, plush deep-red-and-gold patterned carpet runner stretching down the center of the corridor receding into the softly bokeh-blurred distance, warm mixed tungsten ambient lighting from camera-back-top. Shot on 35–50mm portrait lens for environmental feel, full-body framing in vertical aspect, eye-level camera, shallow depth of field with the corridor softly bokeh-blurred behind the couple. Groom: sharp black two-piece formal tuxedo with crisp white dress shirt and neat solid-black silk bow tie tied at the collar, polished black derby shoes, short neat dark side-swept hair, calm composed warm closed-mouth smile, walking close beside bride to camera-left with bride lightly holding his right arm. Bride: clean ivory champagne fitted off-shoulder mermaid wedding dress with delicate beaded sweetheart bodice and softly trailing tulle skirt, sheer cathedral veil softly draped behind her hair, long dark-brown softly waved hair flowing past her shoulders, dainty drop earrings, soft natural rosy makeup with warm gentle bright closed-mouth smile, holding a small fresh round bouquet of white spray roses and trailing fresh green eucalyptus in her right hand at her hip, walking close beside groom to camera-right. Pose: bride and groom walking slowly arm-in-arm down the corridor toward camera with calm warm composed soft bright smiles, intimate refined European hotel wedding moment. Color grade: warm tungsten interior glow on rich wood-and-carpet hotel corridor with warm cream skin midtones and saturated red-gold carpet focal accent, refined classic K-prewedding luxury hotel atmosphere — must clearly read as warm indoor luxury hotel corridor, NOT outdoor, NOT studio.',
    manualKelvin: 3200,
    manualMoodHint:
      'warm tungsten luxury European hotel corridor walking shot with rich wood-paneled walls and red-gold patterned carpet runner, refined classic K-prewedding luxury hotel mood',
    faceMaskRegions: [
      [0.32, 0.20, 0.16, 0.18],
      [0.52, 0.22, 0.16, 0.18],
    ],
  },
  {
    id: 'london-night-doubledecker',
    label: '런던 야경 이층버스',
    hint: '런던 야경 + 빨간 이층버스 + 정장 + 풀신',
    category: 'urban',
    personality: 'together',
    intensity: 'high',
    framing: 'full',
    image: '/wedding-snap/catalog/london-night-doubledecker.jpg',
    promptHint:
      'Outdoor London nighttime urban street scene with iconic vibrant red London double-decker bus visibly streaking with subtle motion blur behind the couple, historic golden-lit classical European hotel facade glowing warm tungsten in the soft-focus background, vintage tall slim black London street lamp post visible to camera-right, polished wet pavement reflecting warm city lights at the couple\'s feet, calm clear deep-navy night sky above. Shot on 50–85mm portrait lens, full-body framing in tall vertical aspect, slight low-angle camera, shallow depth of field with creamy London nightscape bokeh and subtle motion-blurred bus behind. Groom: relaxed dark navy single-breasted two-piece formal suit (no tie) over a soft cream / off-white plain crew-neck t-shirt, polished black derby shoes, short neat dark side-swept hair, calm composed warm soft closed-mouth smile, standing tall to camera-left with one hand casually in trouser pocket and one hand gently holding bride\'s hand. Bride: clean ivory champagne short-puff-sleeve square-neckline classic A-line wedding gown with refined understated bodice and softly flowing skirt brushing the pavement, long sheer cathedral veil softly draped behind her hair and trailing on the wet pavement, long dark-brown softly waved hair flowing past her shoulders, dainty drop earrings, soft natural rosy makeup with warm gentle closed-mouth smile, holding a small fresh round bouquet of warm-orange roses, dahlias and trailing fresh green eucalyptus in her left hand at her hip, standing close beside groom to camera-right facing camera. Pose: bride and groom standing close together hand-in-hand facing camera with calm warm composed gentle bright smiles, refined romantic European travel London nighttime K-prewedding moment with iconic red double-decker bus passing behind. Color grade: rich warm-tungsten city night lighting with vibrant saturated red double-decker bus focal accent and warm cream skin midtones, refined romantic K-prewedding international travel nighttime editorial atmosphere — must clearly read as warm London city nighttime, NOT golden hour, NOT studio.',
    manualKelvin: 2800,
    manualMoodHint:
      'warm tungsten London city nighttime street with iconic red double-decker bus motion-blur backdrop, refined romantic European travel K-prewedding mood',
    faceMaskRegions: [
      [0.32, 0.30, 0.14, 0.16],
      [0.54, 0.30, 0.14, 0.16],
    ],
  },
  {
    id: 'groom-ivory-tux-warmwall',
    label: '신랑 아이보리 턱시도 단독',
    hint: '아이보리 턱시도 + 따뜻한 벽 + 단독 풀신',
    category: 'studio',
    personality: 'groom-solo',
    framing: 'full',
    image: '/wedding-snap/catalog/groom-ivory-tux-warmwall.jpg',
    promptHint:
      'Solo groom portrait — only the groom is in the frame, no bride, no other people. Indoor warm sandstone-textured wall scene with subtle vintage brass wall sconce softly glowing camera-left, classic warm rich wooden paneled door visible to camera-right edge, warm soft natural sunlight from camera-front-left casting subtle rim on hair and shoulders. Shot on 50–85mm portrait lens, three-quarter (knee-up to waist-up) framing, eye-level camera, shallow depth of field. Groom: sharp clean ivory champagne shawl-lapel single-breasted formal tuxedo jacket with crisp white tuxedo dress shirt with subtle pleated front and small black studs, neat solid-black silk bow tie tied at the collar, wide black silk cummerbund at waist, dark navy formal trousers, short neat dark side-swept hair, calm composed warm soft confident closed-mouth expression, standing tall facing camera straight on with one hand casually in trouser pocket. Pose: standing relaxed and composed facing camera, refined classic K-prewedding magazine groom portrait atmosphere. Color grade: warm sandstone wall and rich wood door tones with soft warm natural sunlight and warm cream skin midtones, refined romantic classic K-prewedding portrait editorial atmosphere — must clearly read as warm indoor portrait scene with sandstone wall, NOT studio gray backdrop, NOT outdoor.',
    manualKelvin: 3400,
    manualMoodHint:
      'warm soft natural sunlight on warm sandstone wall with classic ivory tuxedo groom portrait, refined romantic classic K-prewedding magazine portrait mood',
    // solo 풀신 / 반신: 얼굴이 프레임 상단 1/4 부근.
    faceMaskRegions: [[0.42, 0.08, 0.20, 0.20]],
  },
  // ── 신규 추가 (2026-05, 2차) ──
  {
    id: 'london-bigben-bridge-walk',
    label: '런던 빅벤 다리 워킹',
    hint: '빅벤 + 웨스트민스터 다리 + 정장 + 레이스 드레스',
    category: 'urban',
    personality: 'together',
    intensity: 'medium',
    framing: 'full',
    image: '/wedding-snap/catalog/london-bigben-bridge-walk.jpg',
    promptHint:
      'Outdoor London Westminster Bridge scene at warm dusk with the iconic Big Ben clock tower glowing amber and clearly visible rising tall to camera-center-left in the soft-focus background, the historic gothic Westminster Palace softly lit behind, ornate green-and-gold Victorian street lamp glowing warm to camera-left, a vibrant red London double-decker bus and black cabs softly visible with subtle motion on the road to camera-right, pale stone bridge balustrade lining the walkway, calm lavender-and-pink dusk sky above, wet pavement reflecting warm lamp light. Shot on 35–50mm lens for environmental travel feel, full-body framing in landscape aspect, eye-level camera, shallow depth of field with creamy London cityscape bokeh behind. Groom: sharp black three-piece formal suit (jacket + waistcoat) with crisp light-blue dress shirt and pale-blue silk necktie, polished black derby shoes, short neat dark side-swept hair, calm warm soft smile looking toward bride, walking hand-in-hand to camera-left. Bride: elegant ivory long-sleeve lace midi wedding dress with delicate floral lace texture and modest high neckline, long dark-brown softly waved hair flowing past her shoulders, soft natural rosy makeup with warm bright closed-mouth smile looking toward groom, ivory pointed-toe heels, walking hand-in-hand to camera-right. Pose: bride and groom walking slowly hand-in-hand toward camera across the bridge, both turned slightly toward each other with warm gentle smiles, refined romantic European travel London dusk K-prewedding moment. Color grade: warm amber dusk city lighting with iconic glowing Big Ben backdrop, lavender-pink sky and warm cream skin midtones, refined romantic K-prewedding international travel editorial atmosphere — must clearly read as warm London dusk, NOT noon, NOT studio.',
    manualKelvin: 3400,
    manualMoodHint:
      'warm amber London dusk at Westminster Bridge with glowing Big Ben backdrop and lavender-pink sky, refined romantic European travel K-prewedding mood',
    faceMaskRegions: [
      [0.40, 0.34, 0.13, 0.15],
      [0.56, 0.32, 0.13, 0.15],
    ],
  },
  {
    id: 'jeju-forest-road-walk',
    label: '제주 숲길 도로 워킹',
    hint: '제주 삼나무 숲길 + 볼가운 드레스 + 브라운 슈트',
    category: 'outdoor',
    personality: 'together',
    intensity: 'medium',
    framing: 'full',
    image: '/wedding-snap/catalog/jeju-forest-road-walk.jpg',
    promptHint:
      'Outdoor Jeju-island forest road scene — a long empty paved two-lane country road with a single yellow center line receding straight into the soft-focus distance, dense lush green cedar and pine forest walls lining both sides of the road, soft overcast diffused natural daylight giving even soft shadows, calm misty atmosphere. Shot on 50–85mm portrait lens, full-body framing in landscape aspect, eye-level camera slightly low, shallow depth of field with the forest road creamy-bokeh behind. Bride: clean ivory champagne strapless A-line satin ball-gown wedding dress with structured straight neckline and full pleated skirt gathered slightly in one hand as she walks, a single large white flower hair accessory above one ear, dark hair pulled back in a neat low updo, soft natural rosy makeup with warm gentle smile toward groom, ivory heels. Groom: warm dark-brown two-piece formal suit with light-blue dress shirt, slim navy necktie and a small white floral boutonniere, polished dark shoes, short neat dark hair, calm warm soft smile toward bride, holding a small round bouquet of white chrysanthemums with trailing ivory ribbon in his outer hand. Pose: bride and groom walking slowly hand-in-hand down the middle of the empty forest road toward camera, both turned slightly toward each other with calm warm gentle smiles, refined natural Jeju K-prewedding editorial mood. Color grade: soft muted natural greens with warm cream skin midtones and gentle overcast softness, refined natural outdoor K-prewedding atmosphere — must clearly read as soft overcast daytime forest road, NOT golden hour, NOT studio.',
    manualKelvin: 5600,
    manualMoodHint:
      'soft overcast natural daylight on a lush Jeju cedar-forest road, refined natural K-prewedding editorial mood with muted greens',
    faceMaskRegions: [
      [0.40, 0.26, 0.13, 0.15],
      [0.57, 0.22, 0.13, 0.15],
    ],
  },
  {
    id: 'flowershop-vespa-couple',
    label: '플라워샵 베스파',
    hint: '유럽 플라워샵 + 빈티지 스쿠터 + 아이보리 슈트',
    category: 'urban',
    personality: 'together',
    intensity: 'medium',
    framing: 'full',
    isSeated: true, // seated on a vintage scooter
    image: '/wedding-snap/catalog/flowershop-vespa-couple.jpg',
    promptHint:
      'Outdoor charming old European (Italian) cobblestone alley scene in front of a rustic flower shop with weathered blue-painted wooden double doors and arched window, lush green climbing ivy draping over the doorway, a small hand-painted "Flower shop" sign hanging to camera-right, abundant potted hydrangeas and colorful flowers in terracotta pots lining the stone wall on both sides, warm soft daylight. Couple seated together on a silver vintage Vespa scooter parked at center on the cobblestones. Shot on 35–50mm lens for environmental feel, full-body framing in landscape aspect, eye-level camera, shallow depth of field with the flower-shop facade softly behind. Groom: refined ivory / cream three-piece formal suit (jacket + waistcoat) with brown patterned necktie, brown leather shoes, short neat dark hair, calm composed warm soft expression, seated forward on the scooter with both hands on the handlebars, facing camera. Bride: clean ivory sleeveless satin knee-length wedding dress with simple elegant neckline, dark hair in a soft low style, soft natural rosy makeup with warm gentle smile, holding a small round bouquet of soft pastel garden flowers, seated side-saddle behind groom leaning her head gently against his shoulder, facing camera. Pose: couple seated close together on the vintage scooter both facing camera with calm warm gentle smiles, refined romantic European travel K-prewedding editorial moment. Color grade: warm soft European daylight with lush green ivy and pastel-flower accents and warm cream skin midtones, refined romantic K-prewedding travel atmosphere — must clearly read as warm soft daytime European alley, NOT golden hour, NOT studio.',
    manualKelvin: 5200,
    manualMoodHint:
      'warm soft European daylight at a rustic flower-shop alley with vintage scooter and lush ivy, refined romantic travel K-prewedding mood',
    faceMaskRegions: [
      [0.42, 0.34, 0.12, 0.14],
      [0.58, 0.34, 0.12, 0.14],
    ],
  },
  {
    id: 'rome-colosseum-sunset',
    label: '로마 콜로세움 노을',
    hint: '콜로세움 + 골든아워 + 레이스 드레스 + 캐주얼 셔츠',
    category: 'urban',
    personality: 'together',
    intensity: 'high',
    framing: 'full',
    isSeated: true, // seated on a low stone wall
    image: '/wedding-snap/catalog/rome-colosseum-sunset.jpg',
    promptHint:
      'Outdoor Rome scene at warm golden-hour sunset with the iconic ancient Colosseum clearly visible glowing amber in the soft-focus background, scattered Mediterranean pine and olive trees framing both sides, warm orange-and-pink sunset sky with soft sun-flare behind, ancient stone ruins and a low pale-stone wall in the foreground. Couple seated together on the low stone wall. Shot on 35–50mm lens for environmental travel feel, three-quarter (waist-up to knee-up) framing in landscape aspect, eye-level camera, shallow depth of field with the Colosseum creamy-bokeh behind. Bride: ivory lace V-neck wedding dress with delicate floral lace texture, a fitted black blazer draped over her shoulders, long dark hair flowing softly, soft natural rosy makeup with warm bright genuine smile, holding a small round bouquet of soft garden roses in her lap, seated to camera-left. Groom: relaxed white linen dress shirt with sleeves casually rolled to the forearm, dark navy trousers, a watch on the wrist, short neat dark hair, calm warm genuine bright smile, seated close to camera-right with one hand resting near bride. Pose: bride and groom seated close shoulder-to-shoulder on the stone wall both facing camera with warm bright genuine smiles, relaxed refined European travel sunset K-prewedding moment. Color grade: warm golden-hour amber-and-pink sunset glow with the glowing Colosseum backdrop and warm cream skin midtones, refined romantic K-prewedding international travel editorial atmosphere — must clearly read as warm Rome golden-hour sunset, NOT noon, NOT studio.',
    manualKelvin: 3000,
    manualMoodHint:
      'warm golden-hour sunset at the Rome Colosseum with amber-pink sky and soft sun-flare, refined romantic European travel K-prewedding mood',
    faceMaskRegions: [
      [0.38, 0.34, 0.13, 0.16],
      [0.56, 0.34, 0.13, 0.16],
    ],
  },
  {
    id: 'tuscany-villa-arch-couple',
    label: '토스카나 빌라 아치문',
    hint: '토스카나 빌라 + 아치 나무문 + 풀튤 볼가운 + 턱시도',
    category: 'urban',
    personality: 'together',
    intensity: 'medium',
    framing: 'full',
    isSeated: true, // bride seated on the stone steps
    image: '/wedding-snap/catalog/tuscany-villa-arch-couple.jpg',
    promptHint:
      'Outdoor Tuscan-villa entrance scene at warm dusk — a rustic warm sand-toned plaster wall with an arched wooden double door, a vintage wrought-iron lantern glowing warm amber above the doorway, two potted lemon trees with yellow lemons flanking the doorway, weathered pale-stone steps and flagstone ground, calm warm twilight atmosphere. Shot on 35–50mm portrait lens, full-body framing in landscape aspect, eye-level camera, shallow depth of field. Groom: sharp black peak-lapel formal tuxedo with crisp white dress shirt and neat solid-black silk bow tie, polished black shoes, short neat dark hair, calm composed confident soft expression, standing tall and leaning one shoulder casually against the open wooden door with one hand in trouser pocket. Bride: dramatic clean ivory strapless full-volume satin ball-gown wedding dress with structured sweetheart bodice and a voluminous skirt cascading lushly down the stone steps, long dark hair softly styled, soft natural rosy makeup with calm composed gentle expression, seated gracefully on the stone steps in the doorway with the gown spread elegantly around her, both hands resting softly in her lap, facing camera. Pose: groom standing in the doorway, bride seated on the steps before him, both facing camera with calm composed refined expressions, elegant luxury European villa K-prewedding editorial moment. Color grade: warm amber lantern glow on warm sand-plaster wall with rich wood door tones and warm cream skin midtones, refined elegant K-prewedding luxury travel atmosphere — must clearly read as warm villa twilight, NOT noon, NOT studio.',
    manualKelvin: 3200,
    manualMoodHint:
      'warm amber lantern dusk at a rustic Tuscan villa arched doorway with lemon trees, refined elegant luxury K-prewedding travel mood',
    faceMaskRegions: [
      [0.34, 0.28, 0.12, 0.15],
      [0.52, 0.52, 0.12, 0.14],
    ],
  },
  {
    id: 'snowforest-blackwhite-couple',
    label: '설경 숲 흑백',
    hint: '눈 내리는 숲 + 흑백 + 머메이드 드레스 + 턱시도',
    category: 'outdoor',
    personality: 'together',
    intensity: 'high',
    framing: 'full',
    image: '/wedding-snap/catalog/snowforest-blackwhite-couple.jpg',
    promptHint:
      'Outdoor wintry snow-covered forest scene at night rendered in elegant black-and-white monochrome, tall bare and snow-laden trees lining a snowy forest path receding into the dark background, soft falling snowflakes drifting through the air, a faint warm light glowing deep in the forest behind, soft moody low-key lighting. Shot on 50–85mm portrait lens, full-body framing in tall vertical aspect, eye-level camera slightly low, shallow depth of field with snowy forest softly behind. Couple shown from behind turning back over their shoulders toward camera. Bride: elegant white strapless fitted mermaid wedding gown with subtle floral applique and a slight train trailing on the snow, long dark hair flowing down her back, soft natural makeup with warm gentle smile glancing back over her shoulder toward camera, holding a round white bouquet in her outer hand. Groom: sharp black formal tuxedo with crisp white shirt and black bow tie, short neat dark hair, calm warm soft smile glancing back over his shoulder toward camera, holding bride\'s hand. Pose: bride and groom standing close, walking away down the snowy path hand-in-hand but both turning their heads and upper bodies back over their shoulders to face camera with warm gentle smiles, cinematic intimate winter K-prewedding moment. Monochrome black-and-white grade: rich deep blacks in the formalwear, soft luminous whites in the gown and snow, gentle silver midtones with soft film grain, refined cinematic winter K-prewedding editorial atmosphere — must clearly read as elegant black-and-white snowy night forest, NOT color, NOT studio.',
    manualKelvin: 5500,
    manualMoodHint:
      'elegant black-and-white snowy night forest with falling snow, cinematic intimate winter K-prewedding mood, soft film grain',
    faceMaskRegions: [
      [0.30, 0.30, 0.12, 0.14],
      [0.54, 0.28, 0.12, 0.14],
    ],
  },
  {
    id: 'rooftop-bluesky-couple',
    label: '루프탑 파란하늘',
    hint: '맑은 파란하늘 + 루프탑 난간 + 튤 볼가운 + 캐주얼 셔츠',
    category: 'urban',
    personality: 'together',
    intensity: 'low',
    framing: 'full',
    isSeated: true, // seated on a wooden rooftop railing
    image: '/wedding-snap/catalog/rooftop-bluesky-couple.jpg',
    promptHint:
      'Outdoor rooftop scene under a clean clear vivid blue sky filling most of the frame, a weathered wooden rooftop railing/fence at the bottom that the couple sits on, a low-rise cityscape softly visible far below in the soft-focus distance, bright warm natural midday sunlight. Shot on 35–50mm lens, full-body framing in tall vertical aspect, low-angle camera looking slightly up at the couple against the open sky, shallow depth of field. Groom: relaxed crisp white long-sleeve linen shirt with sleeves slightly rolled, dark charcoal trousers, short neat dark hair gently tousled by the breeze, calm warm content soft smile looking up toward the sky, seated on the wooden railing to camera-left with one hand resting near bride. Bride: romantic ivory off-shoulder tulle ball-gown wedding dress with delicate beaded floral bodice and voluminous airy tulle skirt, dark hair in a soft low updo, soft natural rosy makeup with bright genuine joyful smile looking up toward the sky, both hands resting softly in her lap, seated on the railing to camera-right. Pose: bride and groom seated close together on the rooftop railing against the open blue sky, both gazing warmly upward and outward with bright content smiles, airy hopeful refined K-prewedding editorial moment. Color grade: clean bright midday daylight with vivid clear-blue sky and warm cream skin midtones, fresh airy refined K-prewedding atmosphere — must clearly read as bright clear-blue-sky daytime rooftop, NOT golden hour, NOT studio.',
    manualKelvin: 5800,
    manualMoodHint:
      'bright clear-blue-sky midday daylight on an open rooftop railing, fresh airy hopeful refined K-prewedding mood',
    faceMaskRegions: [
      [0.30, 0.40, 0.13, 0.15],
      [0.56, 0.42, 0.13, 0.15],
    ],
  },
  {
    id: 'groom-library-navy-tux',
    label: '신랑 서재 네이비 턱시도 단독',
    hint: '클래식 서재 + 가죽 의자 + 네이비 턱시도 + 보타이',
    category: 'studio',
    personality: 'groom-solo',
    framing: 'closeup',
    isSeated: true, // seated in a leather lounge chair
    image: '/wedding-snap/catalog/groom-library-navy-tux.jpg',
    promptHint:
      'Solo groom portrait — only the groom is in the frame, no bride, no other people. Indoor classic warm wood-paneled private library / study scene with floor-to-ceiling dark wooden bookshelves filled with leather-bound books filling the background, a warm brass floor lamp glowing soft amber to camera-right, a rich brown mid-century leather lounge chair and ottoman, warm tungsten ambient lighting. Shot on 50–85mm portrait lens, three-quarter (waist-up to knee-up) framing, eye-level camera, shallow depth of field with the bookshelves softly bokeh-blurred behind. Groom: sharp deep-navy peak-lapel tuxedo with satin-faced black lapels, crisp white pleated tuxedo dress shirt with small black studs, neat solid-black silk bow tie, white pocket square, short neatly combed dark side-parted hair, calm composed confident soft expression, seated relaxed in the leather lounge chair with one elbow resting and one hand raised near his temple in a thoughtful refined pose. Pose: seated composed and confident facing camera, refined sophisticated classic K-prewedding magazine groom portrait atmosphere. Color grade: warm tungsten library glow with rich wood and leather brown tones and warm cream skin midtones, refined sophisticated classic K-prewedding editorial atmosphere — must clearly read as warm indoor classic library, NOT studio gray backdrop, NOT outdoor.',
    manualKelvin: 3000,
    manualMoodHint:
      'warm tungsten classic wood-paneled library with leather lounge chair, refined sophisticated classic K-prewedding magazine groom portrait mood',
    // solo 클로즈업 / 반신: 얼굴이 프레임 상단 중앙.
    faceMaskRegions: [[0.40, 0.14, 0.24, 0.26]],
  },

  // ── 신규 추가 (2026-06) ──
  {
    id: 'amalfi-vespa-couple',
    label: '아말피 베스파',
    hint: '지중해 해안 + 흰 베스파 + 올화이트',
    category: 'outdoor',
    personality: 'together',
    framing: 'full',
    isSeated: true, // both seated on a parked scooter
    image: '/wedding-snap/catalog/amalfi-vespa-couple.jpg',
    promptHint:
      'Outdoor Mediterranean Amalfi-coast cliffside road overlooking a deep-blue sea with terraced hillside villas and a tunnel in the background, bright warm midday daylight. A white vintage Vespa scooter parked on the stone roadside. Shot on 35–50mm lens, full-body framing, eye-level camera. Groom: relaxed white linen shirt and cream trousers, brown tousled hair, brown sunglasses, leather sandals, hands on the handlebars. Bride: flowing ivory off-shoulder chiffon dress, a white silk headscarf tied under the chin, cat-eye sunglasses, tan leather crossbody bag, long dark hair, nude pumps. Pose: both seated on the parked white Vespa — groom in front holding the handlebars, bride sitting behind close to him with one hand raised playfully near her face, both facing camera. Color grade: bright airy Mediterranean daylight, clean whites with blue-sea and warm-stone tones, sunny European honeymoon editorial — must clearly read as bright warm daylight, NOT night, NOT studio.',
  },
  {
    id: 'palace-garden-bouquet-couple',
    label: '팰리스 가든',
    hint: '유럽 궁전 정원 + 작약 부케 + 클로즈업',
    category: 'outdoor',
    personality: 'together',
    framing: 'closeup',
    image: '/wedding-snap/catalog/palace-garden-bouquet-couple.jpg',
    promptHint:
      'Outdoor grand European baroque palace garden — an ornate honey-stone palace facade with tall arched windows, manicured cone-shaped hedges and stone garden urns softly blurred in the background, bright soft overcast daylight. Shot on 50–85mm portrait lens, chest-up to waist-up close framing, eye-level camera, shallow depth of field. Groom: charcoal-gray suit with white shirt and dark tie, softly tousled dark hair, standing close behind the bride with his cheek near her head. Bride: strapless ivory tulle wedding dress, a sheer long veil, a delicate diamond drop necklace and drop earrings, chin-length dark wavy hair, holding a lush cream peony bouquet at her chest. Pose: groom behind, both leaning together and facing the camera with calm serene soft expressions. Color grade: bright airy luxury-editorial whites with warm cream skin midtones and soft honey-stone background — elegant European garden bridal magazine atmosphere.',
  },
  {
    id: 'studio-strawberry-cake-couple',
    label: '스트로베리 케이크 스튜디오',
    hint: '베이지 스튜디오 + 딸기 케이크 + 안경 신랑',
    category: 'studio',
    personality: 'together',
    framing: 'closeup',
    isSeated: true,
    image: '/wedding-snap/catalog/studio-strawberry-cake-couple.jpg',
    promptHint:
      'Indoor photo studio with a smooth seamless warm beige / tan backdrop, soft diffused even studio lighting. Couple seated close together, cheeks gently touching, holding a small round white strawberry-cream cake topped with fresh strawberries on a white plate between them. Shot on 50–85mm portrait lens, waist-up close framing, eye-level camera. Groom: black notch-lapel suit with white shirt and slim black tie, black-framed glasses, a white rose boutonniere, short neat dark hair, warm soft smile. Bride: strapless sweetheart ivory tulle gown with a long sheer veil, soft long dark wavy hair, small drop earrings, gentle smile. Pose: seated side by side leaning warmly together, both hands holding the cake plate, facing camera. Color grade: warm beige studio tones with clean creamy skin midtones — cozy intimate warm Korean studio bridal atmosphere, never oversaturated.',
  },
  {
    id: 'house-petal-toss-couple',
    label: '하우스 플라워 토스',
    hint: '주택 현관 꽃아치 + 꽃잎 + 환한 웃음',
    category: 'outdoor',
    personality: 'together',
    framing: 'full',
    image: '/wedding-snap/catalog/house-petal-toss-couple.jpg',
    promptHint:
      'Outdoor in front of a charming residential house entrance — a wooden front door framed by a lush white-and-green floral arch with a small brass "427 Pine Street" wall plaque and a vintage wall lantern, potted greenery on the steps, bright soft daylight, with white flower petals gently floating and falling through the air all around. Shot on 35–50mm lens, full-body framing, eye-level camera. Groom: black tuxedo with a black bow tie, white shirt and a white boutonniere, dark hair, one arm thrown out wide in a joyful celebratory gesture. Bride: simple elegant ivory satin spaghetti-strap slip dress with a long sheer veil, holding a small white rose bouquet. Pose: standing close together on the steps, both laughing brightly with genuine candid joy mid-celebration as petals shower down around them. Color grade: bright cheerful natural daylight, airy whites with warm brick and greenery tones — candid joyful wedding-day mood.',
  },
  {
    id: 'groom-convertible-field',
    label: '컨버터블 신랑',
    hint: '빈티지 오픈카 + 황금 들판 + 골든아워',
    category: 'outdoor',
    personality: 'groom-solo',
    framing: 'full',
    isSeated: true, // seated in a vintage convertible
    image: '/wedding-snap/catalog/groom-convertible-field.jpg',
    promptHint:
      'Solo groom portrait — only the groom is in the frame, no bride, no other people. Outdoor golden countryside scene: a vintage open-top convertible car with a rich cognac-brown leather bench seat, a dry golden-wheat field and a distant green tree line under a clear pale-blue sky at warm late-afternoon golden hour. Shot on 50–85mm portrait lens, three-quarter (knee-up) framing, eye-level camera, shallow depth of field. Groom: sharp black tuxedo with a satin shawl lapel, crisp white pleated tuxedo shirt, black bow tie, white pocket square, dark sunglasses, short neat dark hair, calm confident expression, lounging back relaxed in the leather seat with one arm draped along the seat back. Pose: seated reclined and effortlessly confident. Color grade: warm golden-hour glow with cognac-leather and golden-field tones and warm honey skin midtones — cinematic editorial groom portrait, must clearly read as warm golden-hour outdoors, NOT studio.',
  },
  {
    id: 'studio-organic-window-couple',
    label: '오가닉 윈도우 스튜디오',
    hint: '모던 미니멀 크림 + 자연 채광 창 + 앉은 컷',
    category: 'studio',
    personality: 'together',
    framing: 'full',
    isSeated: true,
    image: '/wedding-snap/catalog/studio-organic-window-couple.jpg',
    promptHint:
      'Indoor modern minimalist studio with a smooth seamless cream / ivory wall and floor, featuring a large organic free-form (soft blob-shaped) cut-out window opening that reveals lush green garden foliage outside, clean soft natural daylight spilling in. Couple seated together on the low window ledge. Shot on 35–50mm lens, full-body framing, eye-level camera. Groom: black velvet shawl-lapel tuxedo with a black bow tie and white shirt, short neat dark hair, laughing warmly. Bride: minimalist ivory halter-neck cowl satin mermaid gown with a long train pooling on the floor, sleek low updo with a small hair pin, holding a small white bouquet. Pose: both seated on the ledge turned toward each other sharing a genuine relaxed laugh. Color grade: clean airy cream tones with fresh soft-green window accents — modern minimalist Korean studio editorial mood.',
  },
  {
    id: 'bride-luxury-suite-seated',
    label: '럭셔리 스위트 신부',
    hint: '유럽풍 호텔 스위트 + 샴페인 새틴 드레스',
    category: 'studio',
    personality: 'bride-solo',
    framing: 'full',
    isSeated: true, // seated on the floor against the bed
    image: '/wedding-snap/catalog/bride-luxury-suite-seated.jpg',
    promptHint:
      'Solo bride portrait — only the bride is in the frame, no groom, no other people. Indoor classic luxury European hotel suite: an ornate gilded rococo upholstered bed headboard, a warm-glow pleated bedside lamp, a gold-framed antique oil painting on a paneled wall, an antique wood side table and a persian rug, warm tungsten ambient lighting. Shot on 50–85mm portrait lens, full-body framing, eye-level camera, shallow depth of field. Bride: a lustrous champagne / ivory strapless satin ball gown with a full voluminous pleated skirt, an elegant sleek low updo, small earrings, pale pointed satin heels, a soft radiant smile with both hands clasped gracefully near her chin. Pose: seated gracefully on the floor leaning back against the side of the bed with the satin skirt fanned out around her. Color grade: warm tungsten luxury-interior glow, soft champagne-satin sheen with gold accents and warm cream skin — elegant classic Korean prewedding boudoir editorial, must clearly read as warm indoor luxury suite, NOT studio gray backdrop, NOT outdoor.',
  },
  {
    id: 'villa-balcony-shutters-couple',
    label: '빌라 발코니',
    hint: '지중해 빌라 발코니 + 검은 셔터 + 작약',
    category: 'outdoor',
    personality: 'together',
    framing: 'full',
    image: '/wedding-snap/catalog/villa-balcony-shutters-couple.jpg',
    promptHint:
      'Outdoor Mediterranean villa exterior — the couple standing on a small stone balcony framed by an arched doorway with black wooden louvered shutters and an ornate black wrought-iron railing, warm cream stucco walls, terracotta roof tiles and climbing white roses, bright clear warm daylight. Shot on 35–50mm lens, full-body framing, camera at a slight low angle looking up at the balcony. Groom: black tuxedo with a black bow tie and white shirt, dark wavy hair, hand resting on the railing. Bride: strapless ivory column dress with a subtle thigh slit and a long sheer veil, holding a white peony bouquet. Pose: standing close side by side at the railing, both facing camera with soft calm composed expressions. Color grade: bright warm Mediterranean daylight with cream-stucco and terracotta tones — elegant European villa wedding editorial.',
  },
  {
    id: 'paris-cafe-night-couple',
    label: '파리 카페 야경',
    hint: '파리 노천카페 + 스트링 조명 + 야간 무드',
    category: 'urban',
    personality: 'together',
    framing: 'full',
    isSeated: true,
    hasSideAngle: true, // seated facing each other in profile
    image: '/wedding-snap/catalog/paris-cafe-night-couple.jpg',
    promptHint:
      'Outdoor Parisian street café at night — the couple seated at a small round marble-top bistro table under a deep-red awning lettered "CAFÉ de PARIS · BAR & COCKTAILS", warm Edison string lights and a glowing golden café interior behind, classic rattan bistro chairs, a rain-glossed cobblestone street with distant Haussmann buildings and warm street lamps. Shot on 35–50mm lens, full-body framing, eye-level camera. Groom: dark charcoal / brown suit with white shirt and tie, short neat dark hair, holding a small teacup. Bride: off-shoulder ivory satin gown, sleek low updo, drop earrings, holding a small teacup. Pose: seated across the small table turned toward each other in profile, gently sipping / toasting with the teacups in an intimate moment. Color grade: warm cinematic Parisian night palette — glowing tungsten string-lights and red-awning warmth against deep evening-blue street shadows, gentle film grain — must clearly read as warm night, NOT daytime.',
    manualKelvin: 3200,
    manualMoodHint:
      'warm Parisian night café with Edison string lights and red awning glow, deep evening-blue street, cinematic film grain',
  },
  {
    id: 'rome-colosseum-goldenhour',
    label: '로마 콜로세움 골든아워',
    hint: '콜로세움 + 황금빛 역광 + 백 새틴 드레스',
    category: 'urban',
    personality: 'together',
    framing: 'closeup',
    hasSideAngle: true, // bride turned, back partly to camera
    image: '/wedding-snap/catalog/rome-colosseum-goldenhour.jpg',
    promptHint:
      'Outdoor in Rome with the ancient Colosseum’s arched stone arcades filling the background, a warm low golden-hour sun flaring from camera-right creating a soft backlit rim glow on hair, a low stone wall in the foreground. Shot on 50–85mm portrait lens, waist-up / three-quarter framing, eye-level camera, shallow depth of field. Groom: black notch-lapel suit with white shirt and black tie, short neat dark hair, one hand in his pocket, calm confident gaze to camera. Bride: elegant ivory satin V-back ball gown, long flowing wind-blown wavy hair catching the golden backlight, diamond earrings, looking back over her shoulder toward the camera. Pose: bride turned with her back partly to camera glancing back, groom standing close behind facing camera — romantic intimate. Color grade: warm romantic golden-hour backlight with sun-flare glow, honey skin tones and warm stone — must clearly read as golden-hour sunset, NOT noon, NOT night.',
    manualMoodHint:
      'warm golden-hour sun-flare backlight at the Roman Colosseum, honey skin tones, romantic glow',
  },
];

export const isSnapCatalogId = (v: string): boolean =>
  SNAP_CATALOG.some((c) => c.id === v);

export const findSnapCatalog = (id: string): SnapCatalogItem | undefined =>
  SNAP_CATALOG.find((c) => c.id === id);

/**
 * 카탈로그의 5종 category 를 필터 UI 가 보여줄 2그룹 (스튜디오 / 야외) 으로 압축.
 * outdoor/tradition/urban/beach 는 모두 '야외' 로 통합.
 */
export function backdropOf(item: SnapCatalogItem): CatalogBackdrop {
  return item.category === 'studio' ? 'studio' : 'outdoor';
}

/**
 * framing 미지정 항목은 'full' 로 간주. 필터 적용 시 default 값.
 */
export function framingOf(item: SnapCatalogItem): CatalogFraming {
  return item.framing ?? 'full';
}

/**
 * 합성 방식(strict / prompt-only) 별 결과 예시 썸네일 경로.
 *
 * 사용자가 카탈로그를 고르고 합성 방식을 선택할 때 "이 모드로 만들면 어떤 식
 * 으로 나오는지" 를 미리 보여주기 위한 admin-uploaded 예시 이미지.
 * 파일 경로 규칙:
 *   public/wedding-snap/catalog/examples/{id}-{mode}.jpg
 *
 * 파일이 없으면 UI 가 onError → 카탈로그 마스터 이미지로 자동 fallback.
 * 새 예시 추가는 같은 규칙으로 jpg 만 올리면 즉시 노출.
 */
export type CatalogExampleMode = 'strict' | 'prompt-only';

export function catalogExampleImage(
  item: SnapCatalogItem,
  mode: CatalogExampleMode,
): string {
  return `/wedding-snap/catalog/examples/${item.id}-${mode}.jpg`;
}
