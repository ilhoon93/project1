/**
 * 앵커 후보 4장 — solo anchor 아키텍처.
 *
 * 2 slots (groom, bride) × 2 framings (close-up, half-body) = 4 outputs.
 * 동일 batch 한 번에 신랑 단독 2장 + 신부 단독 2장이 만들어진다.
 *
 * 솔로 anchor 의 핵심 가치:
 *   - 한 anchor 에 한 명만 등장 → 두 얼굴 블렌딩 위험 0
 *   - 카탈로그 생성 시 [groomAnchor, brideAnchor, catalogMaster] 로 묶어
 *     같이 컷 / [groomAnchor, catalogMaster] 또는 [brideAnchor, ...] 로
 *     단독 컷까지 자연스럽게 지원
 *
 * 2 framings 선택 근거 (4 → 2 압축):
 *   - close-up : face identity 최대 추출 (눈/코/턱 디테일, 피부, 헤어)
 *   - half-body: 가장 자주 쓰이는 framing — 어깨/상반신 비율 + 의상 fit
 *   - full-body 와 3-quarter 는 키/몸무게 가이드 + buildBodySection 으로 보완
 *
 * 비용: 4 outputs × $0.13 (high quality) ≈ $0.52. 기존 함께-anchor 와 동일.
 */

export type AnchorSlot = 'groom' | 'bride';
export type AnchorFraming = 'closeup' | 'halfbody';

export interface AnchorTemplate {
  /** 누구 단독 컷인지 — 한 anchor 에 한 명만 등장 */
  slot: AnchorSlot;
  /** 프레이밍 */
  framing: AnchorFraming;
  /** 사용자에게 보일 한글 라벨 */
  label: string;
  /** prompt 의 framing 라인에 들어가는 영문 cue */
  framingHint: string;
}

/**
 * 모든 앵커 템플릿이 공유하는 베이스라인 — 깨끗한 스튜디오, 균등 조명,
 * 단일 카메라 통합. solo anchor 라 의상은 ANCHOR_ATTIRE 에서 slot 별로 별도 주입.
 *
 * 표정은 ANCHOR_EXPRESSION 으로 분리 — 사용자가 앵커 생성 시 "약간 미소"
 * 체크박스로 선택. 기본은 차분한 자연 표정 (composed), 체크 시 옅은 미소.
 *
 * 비율 정책: 머리:전체 신장 = 1/7.5~1/8 (성인 비율의 보수적 끝). 모델이
 * face fidelity 강조 때문에 얼굴을 zoom 해서 그리는 실패 모드를 끊기 위해
 * 명시적으로 "smaller side" 방향 cue 를 박는다.
 */
export const ANCHOR_BASELINE =
  'Clean indoor studio with seamless neutral gray backdrop, two-source softbox lighting from front-left and front-right with a subtle floor pickup creating a soft natural shadow under the subject, polished floor that gently reflects the lighting, editorial wedding portrait atmosphere. The whole image is captured by a single physical camera at the location — same exposure, white balance, contrast curve, micro-grain across subject and background. Lighting wraps softly around shoulders and hair so the subject feels integrated with the backdrop, no cut-out or paste-in look. Anatomically realistic proportions are CRITICAL — head height MUST be approximately 1/7.5 to 1/8 of total body height (lean toward the smaller 1/8 ratio if uncertain), shoulders about 2x head width, neck-to-shoulder transition smooth and realistic. DO NOT enlarge or zoom into the face for half-body framing — the face is the natural size at the chosen camera distance. If the rendered face appears even slightly larger than 1/8 of body height in a half-body shot, it is wrong. Face is identity reference, NOT scale.';

/**
 * 표정 cue — 사용자 옵션에 따라 3 종.
 * - 'neutral' (default): 차분하고 자연스러운 표정. 미소 강제 안 함 — 셀카의 실제 표정 보존.
 * - 'slight': 옅은 미소. 살짝 입꼬리만 올라간 정도.
 * - 'bright': 환하게 웃는 미소. 자연스러운 만족스러운 웃음, 치아 약간 보임. 과장된 grin 은 금지.
 */
export type AnchorExpression = 'neutral' | 'slight' | 'bright';

export const ANCHOR_EXPRESSION_NEUTRAL =
  'Expression: a calm, composed, natural expression — eyes warm and relaxed, mouth in a relaxed neutral position (no forced smile). Preserve the natural facial expression from the face reference image(s). Never staged.';

export const ANCHOR_EXPRESSION_SLIGHT_SMILE =
  'Expression: a soft, very slight smile — corners of the mouth lifted by a small amount, eyes warm and relaxed; lips may be lightly closed or barely parted (a small natural hint of teeth is OK if it looks like a real spontaneous smile). AVOID exaggerated wide-open grin AND blank serious expression. Target: a gentle "natural happy moment".';

export const ANCHOR_EXPRESSION_BRIGHT_SMILE =
  'Expression: a bright, warm, genuinely happy smile — corners of the mouth clearly lifted, eyes naturally crinkling at the outer corners ("Duchenne" eye smile), upper teeth gently visible (a natural relaxed grin, NOT a posed dental show). The smile reads as a real spontaneous joyful moment from a wedding day — confident, warm, alive. AVOID: forced theatrical grin, mouth wide-open laughing, asymmetric smirk, or blank serious face. Skin around eyes shows soft natural crease lines from the smile (no plastic flat smile).';

/** 옵션 enum → 프롬프트 cue 매핑. */
export function expressionCueFor(expression: AnchorExpression): string {
  if (expression === 'bright') return ANCHOR_EXPRESSION_BRIGHT_SMILE;
  if (expression === 'slight') return ANCHOR_EXPRESSION_SLIGHT_SMILE;
  return ANCHOR_EXPRESSION_NEUTRAL;
}

/**
 * slot 별 의상 + 단독 보장 cue — 단독 컷이라 명시적으로 "alone in the frame".
 *
 * 신부 skin note: PHOTOREALISM 블록의 "realistic pores + micro-imperfections" 가
 * 신부 컨텍스트에서 too rough 해지지 않도록 makeup-aware 로 살짝 약화. K-beauty
 * 의 자연스러운 base + light enhancement 미감 유지. pores 는 보이되 flat 하게
 * 뭉개지 않음.
 */
export const ANCHOR_ATTIRE: Record<AnchorSlot, string> = {
  groom:
    'Groom alone in the frame (no second person, no bride, no other people visible). Dressed in a black peak-lapel tuxedo with a crisp white dress shirt and a black bow tie.',
  bride:
    "Bride alone in the frame (no second person, no groom, no other people visible). Dressed in an ivory A-line wedding dress with an off-shoulder neckline and a lace bodice, holding a small bouquet of white flowers. Bride's skin shows natural micro-texture under tasteful light bridal makeup — pores remain visible but softened, NEVER smoothed flat or airbrushed.",
};

export const ANCHOR_TEMPLATES: AnchorTemplate[] = [
  {
    slot: 'groom',
    framing: 'closeup',
    label: '신랑 클로즈업',
    framingHint:
      'Tight chest-up close-up portrait, frontal camera angle at eye level (no head tilt, no looking aside), shallow depth of field with creamy bokeh on the backdrop. EXACT POSE: head straight, looking directly at camera, shoulders square to the camera, soft natural expression. Face fills ~55% of the frame. Soft warm catchlights in the eyes. This pose must be IDENTICAL every render — no variations in head tilt or gaze.',
  },
  {
    slot: 'groom',
    framing: 'halfbody',
    label: '신랑 반신',
    framingHint:
      "Waist-up half-body portrait, slightly three-quarter (~15°) camera angle. EXACT POSE: standing upright, RIGHT HAND in front-right jacket pocket with thumb visible outside, LEFT HAND relaxed at left side. NO crossed arms, NO hands in front of chest, NO holding any object. Shoulders square, head level. This exact hand position must be IDENTICAL every render — no variations. Camera distance: realistic for a waist-up portrait on a 50–85mm lens (about 2.5–3 meters from subject). EXPLICIT SIZE RULE: the face MUST occupy NO MORE than 28-32% of the vertical frame height (target ~30%). The torso (shoulders → chest → waist) fills the remaining ~60% of the frame, head at its natural anatomical size in the top portion. If the rendered face is 40%+ of the frame, the render is WRONG — re-render with a smaller face. The head must look small relative to broad shoulders. Soft rim light wraps around the shoulder closest to camera so the silhouette blends into the backdrop — NO sharp outline, NO cutout halo, NO color fringing.",
  },
  {
    slot: 'bride',
    framing: 'closeup',
    label: '신부 클로즈업',
    framingHint:
      'Tight chest-up close-up portrait, frontal camera angle at eye level (no head tilt, no looking aside), shallow depth of field with creamy bokeh on the backdrop. EXACT POSE: head straight, looking directly at camera, shoulders square to the camera, soft natural expression. Face fills ~55% of the frame. Soft warm catchlights in the eyes, subtle natural makeup. This pose must be IDENTICAL every render — no variations in head tilt or gaze.',
  },
  {
    slot: 'bride',
    framing: 'halfbody',
    label: '신부 반신',
    framingHint:
      'Waist-up half-body portrait, slightly three-quarter (~15°) camera angle. EXACT POSE: standing upright, holding a small white-and-green bridal bouquet WITH BOTH HANDS at WAIST LEVEL (bouquet centered in front of the waist, not chest, not hip — exactly at the navel line). Both forearms relaxed and visible, neither arm crossing the body. Shoulders square, head level. This exact bouquet position must be IDENTICAL every render — no variations in bouquet height or hand placement. Camera distance: realistic for a waist-up portrait on a 50–85mm lens (about 2.5–3 meters from subject). EXPLICIT SIZE RULE: the face MUST occupy NO MORE than 28-32% of the vertical frame height (target ~30%). The torso (shoulders → dress bodice → bouquet → waist) fills the remaining ~60% of the frame, head at natural anatomical size in the top portion. If face is 40%+ of frame, the render is WRONG — re-render with a smaller face so bouquet and dress bodice are clearly visible. Soft rim light wraps around the shoulder closest to camera — NO sharp outline, NO cutout halo, NO color fringing along shoulders, hair, dress edge, or bouquet edge.',
  },
];

export const isAnchorSlot = (v: string): v is AnchorSlot =>
  v === 'groom' || v === 'bride';
export const isAnchorFraming = (v: string): v is AnchorFraming =>
  v === 'closeup' || v === 'halfbody';
