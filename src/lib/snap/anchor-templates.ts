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
 * 자연스러운 미소, 단일 카메라 통합. solo anchor 라 의상은 ANCHOR_ATTIRE
 * 에서 slot 별로 별도 주입.
 */
export const ANCHOR_BASELINE =
  'Clean indoor studio with seamless neutral gray backdrop, two-source softbox lighting from front-left and front-right with a subtle floor pickup creating a soft natural shadow under the subject, polished floor that gently reflects the lighting, editorial wedding portrait atmosphere. Expression: a genuine, relaxed smile — eyes slightly crinkled (Duchenne smile), corners of the mouth gently lifted, soft natural happiness, never staged or forced. The whole image is captured by a single physical camera at the location — same exposure, white balance, contrast curve, micro-grain across subject and background. Lighting wraps softly around shoulders and hair so the subject feels integrated with the backdrop, no cut-out or paste-in look. Anatomically realistic proportions — head height is roughly 1/7 to 1/8 of total body height (natural adult ratio), shoulders about 2x head width, neck-to-shoulder transition smooth and realistic. Do NOT enlarge or zoom into the face for half-body framing — the face is rendered at the natural size for the chosen camera distance.';

/** slot 별 의상 + 단독 보장 cue — 단독 컷이라 명시적으로 "alone in the frame". */
export const ANCHOR_ATTIRE: Record<AnchorSlot, string> = {
  groom:
    'Groom alone in the frame (no second person, no bride, no other people visible). Dressed in a black peak-lapel tuxedo with a crisp white dress shirt and a black bow tie.',
  bride:
    'Bride alone in the frame (no second person, no groom, no other people visible). Dressed in an ivory A-line wedding dress with an off-shoulder neckline and a lace bodice, holding a small bouquet of white flowers.',
};

export const ANCHOR_TEMPLATES: AnchorTemplate[] = [
  {
    slot: 'groom',
    framing: 'closeup',
    label: '신랑 클로즈업',
    framingHint:
      'Tight chest-up close-up portrait, face clearly featured, frontal camera angle at eye level, shallow depth of field with creamy bokeh on the backdrop. Face fills ~55% of the frame. Soft warm catchlights in the eyes.',
  },
  {
    slot: 'groom',
    framing: 'halfbody',
    label: '신랑 반신',
    framingHint:
      "Waist-up half-body portrait, slightly three-quarter (~15°) camera angle, hands resting naturally at the side or lightly in jacket pocket. Camera distance is realistic for a waist-up portrait shot on a 50–85mm lens — face occupies its natural head-to-torso proportion, NOT enlarged, NOT zoomed, NOT scaled up to emphasize identity. Soft rim light wraps around the shoulder closest to camera so the silhouette blends into the backdrop — explicitly NO sharp outline, NO cutout halo, NO color fringing along shoulders or hair.",
  },
  {
    slot: 'bride',
    framing: 'closeup',
    label: '신부 클로즈업',
    framingHint:
      'Tight chest-up close-up portrait, face clearly featured, frontal camera angle at eye level, shallow depth of field with creamy bokeh on the backdrop. Face fills ~55% of the frame. Soft warm catchlights in the eyes, subtle natural makeup.',
  },
  {
    slot: 'bride',
    framing: 'halfbody',
    label: '신부 반신',
    framingHint:
      'Waist-up half-body portrait, slightly three-quarter (~15°) camera angle, holding a small bouquet with both hands at waist level. Camera distance is realistic for a waist-up portrait shot on a 50–85mm lens — face occupies its natural head-to-torso proportion, NOT enlarged, NOT zoomed, NOT scaled up. Soft rim light wraps around the shoulder closest to camera so the silhouette blends into the backdrop — explicitly NO sharp outline, NO cutout halo, NO color fringing along shoulders, hair, dress edge, or bouquet edge.',
  },
];

export const isAnchorSlot = (v: string): v is AnchorSlot =>
  v === 'groom' || v === 'bride';
export const isAnchorFraming = (v: string): v is AnchorFraming =>
  v === 'closeup' || v === 'halfbody';
