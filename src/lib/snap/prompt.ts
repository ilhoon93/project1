/**
 * 웨딩스냅 프롬프트 빌더 — solo anchor 아키텍처.
 *
 * 카탈로그 입력 형태 (personality 기반 분기):
 *   * together   → [groom-anchor, bride-anchor, catalog]  (3장)  buildTogetherCatalogPrompt
 *   * groom-solo → [groom-anchor, catalog]                (2장)  buildSoloCatalogPrompt('groom', ...)
 *   * bride-solo → [bride-anchor, catalog]                (2장)  buildSoloCatalogPrompt('bride', ...)
 *   * couple     → [couple-photo, catalog]                (2장)  buildCouplePhotoSnapPrompt (anchor 우회)
 *
 * 앵커 생성 (solo anchor batch):
 *   * slot='groom' + framing=closeup/halfbody  → [groom selfies...]  buildAnchorPromptSolo('groom', ...)
 *   * slot='bride' + framing=closeup/halfbody  → [bride selfies...]  buildAnchorPromptSolo('bride', ...)
 *
 * 모든 prompt 의 마지막에 공통 NEGATIVES + ANCHOR_INTEGRATION (앵커 한정) 가
 * 들어가 gpt-image-2 의 흔한 인공물과 paste-in 룩을 적극 차단한다.
 */

import type { AnchorSlot } from '@/lib/snap/anchor-templates';
import type {
  CatalogCameraDistance,
  CatalogFraming,
  SnapCatalogItem,
} from '@/lib/snap/catalog';

export interface BodyMetrics {
  /** 키 cm — 140~210 권장 */
  heightCm: number;
  /** 몸무게 kg — 35~150 권장 */
  weightKg: number;
}

export interface SnapPromptInput {
  catalogPromptHint: string;
  /** 신규 — catalog 메타데이터 (framing/pose/cameraDistance) cue 로 변환. */
  catalogMeta?: Pick<SnapCatalogItem, 'framing' | 'pose' | 'cameraDistance'>;
  groom?: BodyMetrics;
  bride?: BodyMetrics;
}

// ──────────────────────────────────────────────────────────────
// Catalog 메타데이터 → prompt cue 변환
// ──────────────────────────────────────────────────────────────

const FRAMING_DESCRIPTION: Record<CatalogFraming, string> = {
  closeup:
    'Close-up (chest-up). The face fills ~40–55% of the frame. This is the ONLY framing where the face appears large.',
  halfbody:
    'Half-body (waist-up). The head occupies the top ~25–30% of the frame. The torso fills the remaining ~70–75%. NOT a close-up.',
  fullbody:
    'Full-body (head to feet, with negative space). The head occupies only the top ~12–13% of the frame. The body fills the rest. DO NOT crop above the feet.',
};

const CAMERA_DISTANCE_DESCRIPTION: Record<CatalogCameraDistance, string> = {
  tight: 'Tight framing — subject(s) dominate the frame, minimal negative space.',
  medium: 'Medium framing — subject(s) take ~60–70% of frame width with comfortable margin.',
  wide: 'Wide environmental framing — subject(s) take ~40–55% of frame width, environment is prominent.',
};

/**
 * Catalog 메타데이터 → cue 라인 배열. 메타데이터가 하나라도 있으면 명시적
 * "CATALOG META LOCK" 섹션을 추가해 promptHint 의 텍스트보다 더 강하게 박는다.
 */
function buildCatalogMetaCue(
  meta?: Pick<SnapCatalogItem, 'framing' | 'pose' | 'cameraDistance'>,
): string[] {
  if (!meta || (!meta.framing && !meta.pose && !meta.cameraDistance)) {
    return [];
  }
  const lines: string[] = ['', 'CATALOG META LOCK — replicate exactly (overrides anchor defaults):'];
  if (meta.framing) {
    lines.push(`- Framing: ${meta.framing}. ${FRAMING_DESCRIPTION[meta.framing]}`);
  }
  if (meta.cameraDistance) {
    lines.push(`- Camera distance: ${CAMERA_DISTANCE_DESCRIPTION[meta.cameraDistance]}`);
  }
  if (meta.pose) {
    lines.push(`- Pose: ${meta.pose}`);
  }
  lines.push(
    "- These META values are stronger than the anchor's default standing pose. If conflict, META wins.",
  );
  return lines;
}

// ──────────────────────────────────────────────────────────────
// 체형 가이드 — BMI / 키 차이를 정성적으로 변환해 prompt 에 주입
// ──────────────────────────────────────────────────────────────

function bodyShape(m: BodyMetrics): string {
  const heightM = m.heightCm / 100;
  const bmi = m.weightKg / (heightM * heightM);
  if (bmi < 18.5) return 'slender, slim build';
  if (bmi < 23) return 'lean and well-proportioned build';
  if (bmi < 25) return 'average, healthy build';
  if (bmi < 28) return 'slightly fuller, soft build';
  return 'fuller-figured, plus-size build';
}

function heightLabel(cm: number): string {
  if (cm < 155) return 'petite stature';
  if (cm < 165) return 'shorter than average stature';
  if (cm < 175) return 'average stature';
  if (cm < 185) return 'tall stature';
  return 'very tall stature';
}

function buildPersonGuide(role: 'groom' | 'bride', m?: BodyMetrics): string | null {
  if (!m) return null;
  return `- ${role === 'groom' ? 'Groom' : 'Bride'}: ${m.heightCm} cm tall, ${m.weightKg} kg — ${heightLabel(m.heightCm)}, ${bodyShape(m)}. Render full-body proportions (limb length, shoulder width, torso, waist, hip) consistent with this build.`;
}

function buildHeightComparison(groom?: BodyMetrics, bride?: BodyMetrics): string | null {
  if (!groom || !bride) return null;
  const diff = groom.heightCm - bride.heightCm;
  const abs = Math.abs(diff);
  if (abs < 3) return '- The groom and bride are nearly the same height; align their eye lines closely.';
  const taller = diff > 0 ? 'groom' : 'bride';
  const shorter = diff > 0 ? 'bride' : 'groom';
  return `- Height difference: the ${taller} is roughly ${abs} cm taller than the ${shorter}. Reflect this gap when they stand side by side (head/shoulder offsets, eye-line difference). Do NOT make them identical heights.`;
}

function buildBodySection(groom?: BodyMetrics, bride?: BodyMetrics): string[] {
  const lines: string[] = [];
  const g = buildPersonGuide('groom', groom);
  const b = buildPersonGuide('bride', bride);
  const cmp = buildHeightComparison(groom, bride);
  if (g) lines.push(g);
  if (b) lines.push(b);
  if (cmp) lines.push(cmp);
  if (lines.length === 0) return [];
  return [
    '',
    'BODY PROPORTIONS (apply when the framing includes the full or half body):',
    ...lines,
    '- Keep faces strictly from the face reference image(s); only the body silhouette and proportions follow the guide above.',
    '- Tailor wedding attire to drape naturally on the described build (no shrink-wrap, no padding mismatch).',
  ];
}

// ──────────────────────────────────────────────────────────────
// ZONE LOCKS — anchor / body / catalog 사이의 우선순위 명확화
//
// 카탈로그 합성 단계의 가장 빈번한 실패 모드는 "anchor 의 visual signal 이
// 텍스트 명령보다 강해 catalog 의 포즈/의상/framing 을 덮는다" 와
// "catalog 의 안경/메이크업 같은 얼굴 영역 디테일이 anchor identity 를
// 침범한다". 이를 막기 위해 3개의 zone 으로 권한을 분리한다:
//
//   IDENTITY ZONE  → anchor 절대  (얼굴/피부/안경/수염/머리)
//   BODY ZONE      → body metrics 절대  (키/몸무게 기반 체형)
//   COMPOSITION    → catalog 절대  (의상/포즈/framing/배경/조명)
//
// 모든 카탈로그 합성 빌더에 일괄 주입. 앵커 단계 (buildAnchorPromptSolo) 는
// IDENTITY 만 적용 (catalog 없음).
// ──────────────────────────────────────────────────────────────

const IDENTITY_LOCK = [
  '',
  'IDENTITY ZONE — anchor wins over catalog (NEVER override):',
  "- Face shape and features (eyes, nose, mouth, jaw line, eyebrows) come STRICTLY from the anchor reference. The catalog's face must be ignored.",
  '- Skin tone and skin texture from the anchor.',
  '- Hair color, hair length, hair style, and hair texture from the anchor — NOT from the catalog. If the catalog shows a different hair length or style, IGNORE it.',
  '- Facial accessories belong to identity: glasses, eyeglasses, sunglasses, beard, mustache, stubble, facial moles, scars, freckles are ENTIRELY determined by the anchor.',
  "- If the catalog image shows glasses but the anchor does NOT, render the result WITHOUT glasses. If the anchor wears glasses but the catalog does NOT, render WITH glasses. The anchor is the absolute truth for facial accessories.",
  '- Makeup style and intensity follow the anchor (light natural look as shown in anchor). Do not add heavy makeup just because the catalog model has it.',
];

const BODY_LOCK = [
  '',
  'BODY ZONE — user-provided body metrics win over catalog model:',
  '- The body proportions (shoulder width, torso length, waist, hip, limb length, overall build) are determined by the user-provided height (cm) and weight (kg), NOT by the catalog model\'s physique.',
  '- DO NOT copy the catalog model\'s body type. The catalog provides POSE and FRAMING, but never the actual physique.',
  '- Match the BMI-derived build precisely: slender / lean / average / fuller. A 90 kg subject must look 90 kg, not slimmed to match a slim catalog model.',
  '- For couples: respect the height difference from user input. Do NOT make both subjects the same height just because the catalog couple looks similar in height.',
];

const COMPOSITION_LOCK = [
  '',
  'COMPOSITION ZONE — catalog wins over anchor (must replicate exactly):',
  '- Pose, body position, gesture, hand position, head tilt, weight distribution — EXACTLY as shown in the catalog reference image.',
  '- Camera angle, framing scale (close-up / half-body / full-body), camera distance, depth of field, lens character — EXACTLY from the catalog.',
  '- Background, environment, props (bouquet, etc.) — EXACTLY from the catalog.',
  "- Wedding attire (suit color, suit cut, lapel type, shirt color, tie type and color, dress color, dress silhouette, neckline, lace, shoes) — EXACTLY from the catalog. OVERRIDE the anchor's anchor-baseline attire — e.g., if the anchor wears a black tuxedo with bow tie but the catalog shows a charcoal suit with white tie, render the CATALOG attire.",
  '- Lighting direction, color temperature, softness, color grade — from the catalog.',
  '- Composition rule: when in doubt about a non-identity, non-body element, follow the catalog.',
];

const ANCHOR_ONLY_IDENTITY_GUARD = [
  '',
  'IDENTITY GUARD (anchor stage — no catalog yet):',
  '- Face shape and features, skin tone, skin texture, hair color/length/style, glasses, beard, moles — ALL come from the face reference image(s). Do not invent.',
  '- Single reference may be frontal — extrapolate plausible 3D shape without drifting from the identity.',
];

// ──────────────────────────────────────────────────────────────
// 공통 negatives + 앵커 전용 integration (paste-in / 머리 비대증 차단)
// ──────────────────────────────────────────────────────────────

const NEGATIVES = [
  '',
  'QUALITY REQUIREMENTS — strictly AVOID:',
  '- Plastic, waxy, or overly smooth skin texture (preserve realistic pores and natural micro-detail)',
  '- Beauty filter look, airbrushed, or over-retouched skin (must have natural skin micro-detail)',
  '- Plastic doll-like or wax-figure face appearance (must look like a real photographed human)',
  '- Soft feathered chin or jawline, glow halo around the face or hairline (must be a sharp natural edge)',
  '- Digital-clean look with zero grain or texture (must have very subtle photographic film grain / sensor noise)',
  '- Asymmetric or misaligned eyes, lopsided pupils, drifting gaze',
  '- Extra, missing, or malformed fingers; deformed hands or wrists',
  '- Distorted, crooked, or missing teeth when smiling',
  '- Visible cutout halos, hard edges, or color fringing around hair and clothing',
  '- Blurry faces while the background is sharp (faces must be the sharpest area)',
  '- Oversharpened artifacts, unnatural HDR look, or overcooked color saturation',
  '- Identity drift — the synthesized faces must clearly match the face reference image(s)',
  "- Adding glasses, beard, or mustache from the catalog when the anchor doesn't show them (or removing them if the anchor has them)",
  "- Copying the catalog model's body type or build (use user height/weight instead)",
  '- Oversized head / enlarged face / bobblehead effect (head must be ≤ 1/7.5 of total body height)',
  "- Using the anchor's tight face crop as a scale reference (the anchor is identity only — the catalog defines scale)",
];

/**
 * 포토리얼리즘 양성 cue — 모든 prompt 빌더에 주입.
 *
 * gpt-image-2 의 default 출력은 "디지털 클린" — pores 없고, 그레인 없고,
 * 머리카락이 뭉뚱그려지고, 턱선이 부드럽게 페더링된다. NEGATIVES (음성) 만으로는
 * 모델이 안전한 smooth 로 회귀하므로 명시적 양성 cue 로 균형을 잡는다.
 *
 * 사용자 우선순위 매핑:
 *   1. 머리카락 디테일 ─ fine hair strands + flyaways
 *   2. 피부 텍스처     ─ realistic pores + micro-imperfections + RAW DSLR
 *   3. 미세 그레인     ─ subtle 35mm film grain / sensor noise
 *   4. 턱선 feathering ─ sharp natural jawline edge, NO halo at chin/neck
 *   5. 눈 주변         ─ clear iris detail, defined shadowing, soft catchlights
 *
 * 빌더별 주입: buildAnchorPromptSolo / buildTogetherCatalogPrompt /
 * buildSoloCatalogPrompt / buildCouplePhotoSnapPrompt 4개 모두에 적용.
 */
const PHOTOREALISM = [
  '',
  'PHOTOREALISM — render as a RAW DSLR photograph (50–85mm portrait lens):',
  '- Realistic skin texture with visible natural pores and subtle micro-imperfections (small moles, faint texture variation) — NOT smoothed flat.',
  '- Fine individual hair strands visible at the hairline edges; gentle natural flyaways that catch the light.',
  '- Natural fabric wrinkles, weave, and folds on suit / dress / shirt — fabric must read as real cloth, not plastic or vinyl.',
  '- Cinematic skin tones with a subtle warm/cool gradient across the face (not flat color).',
  '- Sharp natural jawline and hairline edges. NO soft halo, NO feathering, NO glow at chin / neck / hair contour.',
  '- Defined eye area: clear iris detail with visible color variation, subtle natural shadowing under the brow, soft warm catchlights in the eyes.',
  '- Very subtle 35mm film grain / faint sensor noise across the entire image — barely perceptible but enough to break the AI-clean digital look.',
];

/**
 * 앵커 전용 — half-body 같은 framing 에서 머리 비대증 / paste-in 룩 차단.
 * NEGATIVES 와 별도의 양성 instruction.
 *
 * 비율 cue 는 baseline 과 framingHint 에 이어 세 번째 layer — 모델이 face
 * fidelity 강조 때문에 얼굴을 키우는 실패 모드가 끈질겨 중복 강조 필요.
 */
const ANCHOR_INTEGRATION = [
  '',
  'ANATOMICAL PROPORTIONS — CRITICAL when the framing shows the body (half-body):',
  '- Head height MUST be 1/7.5 to 1/8 of total body height (lean toward 1/8 — the smaller side — if uncertain). Shoulders about 2x head width.',
  '- For a half-body (waist-up) frame: the face occupies roughly 1/3 of the vertical frame height, NOT 1/2, NOT bigger. The torso below the face fills the remaining 2/3.',
  '- DO NOT enlarge, zoom into, or up-scale the face when the target framing is not a tight chest-up close-up. The face is the IDENTITY reference, NOT the focal scale.',
  '- If you find yourself rendering the face larger than the natural anatomical size, STOP and re-render with a smaller face. An oversized head is a failure.',
  '- Neck-to-shoulder transition must be smooth and realistic — no oversized head perched on a smaller body, no shrunken torso, no "bobblehead" effect.',
  '- Maintain the natural face size for a 50–85mm portrait lens at the chosen camera distance.',
  '',
  'NATURAL INTEGRATION — top priority for half-body framing:',
  '- Subject MUST look photographed inside the scene by a single physical camera — not pasted on top of it.',
  '- Apply uniform studio lighting, a single consistent color grade, identical micro-grain, identical contrast curve, and identical white balance across subject and background. There is one camera, one exposure.',
  '- Re-light hair, skin, and clothing so the light direction and softness match the backdrop softboxes.',
  '- Add a soft light wrap (rim light) on shoulders, hair edges, and the bouquet so the silhouette blends with the backdrop.',
  '- Allow soft natural imperfection at the edges of hair and clothing — flyaway strands, fabric falloff, light scatter — instead of perfectly clean cutout edges.',
  '- A subtle environmental color cast from the backdrop bounces softly onto skin and clothing edges so the subject belongs in the light.',
  '- Add a subtle directional shadow on the backdrop behind the subject, matching the softbox direction.',
  '- Edges where hair, clothing, bouquet, or veil meet the background must be soft and natural — no sharp masks, no halos, no color fringing.',
  '- Match the depth of field of the subject with the background falloff; no mismatched sharpness.',
];

/**
 * 카탈로그 전용 — 카탈로그 마스터 reference 로 합성할 때 paste-in 차단 +
 * 머리 비대증 차단. 앵커 단계의 ANCHOR_INTEGRATION 보다 짧지만 비율 cue 는
 * 더 강력 — anchor crop 무시 + catalog scale match + 절대 cap.
 *
 * 사용자 테스트 결과 "항상 얼굴이 크게 나옴" — 모델이 anchor 의 face crop 을
 * scale reference 로 잘못 쓰는 패턴. anchor 의 close-up 은 identity 용이지
 * 스케일이 아님을 반복 명시.
 */
const CATALOG_INTEGRATION = [
  '',
  'NATURAL INTEGRATION (subject ↔ scene):',
  "- Re-light the subject(s) to match the catalog scene's primary light direction, color temperature, and softness.",
  "- Apply a single consistent color grade, identical white balance and contrast curve, across subject(s) and background — one camera, one exposure.",
  "- Soft natural edges around hair, clothing, bouquet — no sharp cutout halos, no color fringing.",
  '- Subtle environmental color cast from the scene bounces softly onto skin and clothing.',
  '',
  'HEAD-TO-BODY RATIO — most common failure mode (read carefully):',
  '- The anchor image may be a tight face crop. DO NOT use the anchor\'s apparent head size as a scale reference. The anchor is for identity ONLY.',
  '- The CATALOG image defines the actual head-to-body ratio. Match the catalog\'s ratio exactly.',
  '- Absolute cap: head height MUST be ≤ 1/7.5 of total body height in any framing that shows the body. Lean toward 1/8 if uncertain.',
  '- For full-body shots: the head occupies the top ~12–13% of the vertical frame, NOT more.',
  '- For half-body (waist-up) shots: the head occupies the top ~25–30% of the frame, NOT more (NOT 1/2, NOT bigger).',
  '- For close-up (chest-up) shots: the face fills ~40–55% of the frame — this is the ONLY framing where the face is large.',
  '- If unsure, render the head SMALLER. An oversized head is the failure mode we are correcting.',
  '- Shoulders about 2x head width. Neck-to-shoulder transition smooth, no "bobblehead" effect.',
  '',
  'EXPRESSION:',
  '- Soft natural smile — eyes warm and relaxed, corners of the mouth gently lifted. Lips may be lightly closed OR slightly parted (a small natural hint of teeth is OK if it looks like a real spontaneous smile).',
  '- AVOID both: (a) an exaggerated wide-open laughing grin, (b) a stiff serious / blank expression. The target is "natural happy moment" — not staged, not somber.',
];

// ──────────────────────────────────────────────────────────────
// 얼굴 reference 이미지 N장 → 슬롯 번호 매핑 (1 or 3 angles per person)
// ──────────────────────────────────────────────────────────────

function faceReferenceLine(
  role: 'groom' | 'bride',
  faceCount: number,
  startIdx: number,
): { line: string; nextIdx: number; ref: string } {
  if (faceCount <= 1) {
    return {
      line: `- Image ${startIdx} = ${role === 'groom' ? 'Groom' : 'Bride'} face reference (frontal close-up).`,
      nextIdx: startIdx + 1,
      ref: `Image ${startIdx}`,
    };
  }
  const end = startIdx + faceCount - 1;
  return {
    line: `- Images ${startIdx}–${end} = ${role === 'groom' ? 'Groom' : 'Bride'} face references at ${faceCount} angles (in order: frontal, left ~45°, right ~45°). Synthesize a consistent 3D understanding of the face.`,
    nextIdx: end + 1,
    ref: `Images ${startIdx}–${end}`,
  };
}

// ──────────────────────────────────────────────────────────────
// (A) Solo 앵커 생성 — 한 명만 reference 로 받음
// ──────────────────────────────────────────────────────────────

export interface AnchorSoloPromptOpts {
  /** 어느 사람의 앵커인지 */
  slot: AnchorSlot;
  /** baselineSceneHint = ANCHOR_BASELINE + ANCHOR_ATTIRE[slot] + framingHint 결합 */
  baselineSceneHint: string;
  /** 셀카 reference 이미지 수 (1 or 3) */
  faceCount?: number;
  /** 해당 사람의 체형 가이드 (있으면) */
  body?: BodyMetrics;
}

export function buildAnchorPromptSolo(opts: AnchorSoloPromptOpts): string {
  const faceCount = opts.faceCount ?? 1;
  const role = opts.slot;
  const { line: faceLine, ref } = faceReferenceLine(role, faceCount, 1);
  const personGuide = opts.body ? buildPersonGuide(role, opts.body) : null;
  const bodySection = personGuide
    ? [
        '',
        'BODY PROPORTIONS (user-provided, strict):',
        personGuide,
        '- Keep the face strictly from the face reference image(s); only the body silhouette and proportions follow the guide above.',
        '- Tailor wedding attire to drape naturally on the described build (no shrink-wrap, no padding mismatch).',
      ]
    : [];

  return [
    `Compose a clean solo wedding anchor portrait using ${faceCount} input image${faceCount > 1 ? 's' : ''}:`,
    faceLine,
    '',
    `Scene & framing: ${opts.baselineSceneHint}`,
    '',
    'IDENTITY FIDELITY (match identity, not scale):',
    `- Match the ${role === 'groom' ? "groom's" : "bride's"} identity from ${ref} (eye shape, nose bridge, jawline, skin tone/texture, hair style/color, glasses if any, beard if any) precisely — but render the face at the anatomically correct size for the chosen framing. Identity, NOT scale.`,
    faceCount > 1
      ? '- Multi-angle references describe a single 3D face. Reconcile them into one consistent face; do NOT produce different-looking siblings.'
      : '- The single reference face is frontal — extrapolate plausible 3D shape without identity drift.',
    `- The frame contains ONLY the ${role === 'groom' ? 'groom' : 'bride'} (one person). Do NOT add a second person.`,
    '- Do NOT enlarge or up-scale the face in order to make the identity more obvious — preserve natural head-to-body proportions.',
    ...ANCHOR_ONLY_IDENTITY_GUARD,
    ...bodySection,
    ...ANCHOR_INTEGRATION,
    ...PHOTOREALISM,
    ...NEGATIVES,
    '',
    'Style: Professional wedding photography, photorealistic, cinematic. Face is sharp but rendered at natural anatomical size.',
  ].join('\n');
}

// ──────────────────────────────────────────────────────────────
// (B) Together 카탈로그 — groom-anchor + bride-anchor + catalog
// ──────────────────────────────────────────────────────────────

export function buildTogetherCatalogPrompt(input: SnapPromptInput | string): string {
  const opts: SnapPromptInput =
    typeof input === 'string' ? { catalogPromptHint: input } : input;
  const bodySection = buildBodySection(opts.groom, opts.bride);
  const metaCue = buildCatalogMetaCue(opts.catalogMeta);

  return [
    'Compose a couple wedding portrait using THREE input images:',
    '- Image 1 = Groom anchor (solo portrait). Use ONLY for groom identity (face / skin / hair / glasses / facial hair) and groom build.',
    '- Image 2 = Bride anchor (solo portrait). Use ONLY for bride identity (face / skin / hair / makeup) and bride build.',
    '- Image 3 = Composition reference (catalog master). Use for POSE / FRAMING / camera / background / outfits / lighting. NOT for any face or body type.',
    '',
    `Scene context: ${opts.catalogPromptHint}`,
    ...metaCue,
    ...IDENTITY_LOCK,
    '',
    'IDENTITY ROLE ASSIGNMENT (couple):',
    "- Image 1's identity → goes to the groom position in Image 3. Image 2's identity → goes to the bride position. Do NOT swap, do NOT blend the two faces.",
    '- Do NOT add additional people not present in the anchors.',
    ...BODY_LOCK,
    ...COMPOSITION_LOCK,
    ...bodySection,
    ...CATALOG_INTEGRATION,
    ...PHOTOREALISM,
    ...NEGATIVES,
    '',
    'Style: Professional wedding photography, photorealistic, cinematic.',
  ].join('\n');
}

// ──────────────────────────────────────────────────────────────
// (C) Solo 카탈로그 — one-anchor + catalog (신랑만 또는 신부만)
// ──────────────────────────────────────────────────────────────

export interface SoloCatalogPromptOpts extends SnapPromptInput {
  slot: AnchorSlot;
}

export function buildSoloCatalogPrompt(opts: SoloCatalogPromptOpts): string {
  const role = opts.slot;
  const bodyMetrics = role === 'groom' ? opts.groom : opts.bride;
  const personGuide = bodyMetrics ? buildPersonGuide(role, bodyMetrics) : null;
  const bodySection = personGuide
    ? [
        '',
        'BODY PROPORTIONS (user-provided, strict):',
        personGuide,
        '- Keep the face strictly from Image 1; only the body silhouette and proportions follow the guide above.',
      ]
    : [];
  const metaCue = buildCatalogMetaCue(opts.catalogMeta);

  return [
    `Compose a SOLO ${role === 'groom' ? 'groom' : 'bride'} wedding portrait using TWO input images:`,
    `- Image 1 = ${role === 'groom' ? 'Groom' : 'Bride'} anchor. Use ONLY for identity (face / skin / hair / glasses / facial hair${role === 'bride' ? ' / makeup' : ''}) and build.`,
    '- Image 2 = Composition reference (catalog master). Use for POSE / FRAMING / camera / background / outfit / lighting. NOT for any face detail or body type.',
    '',
    `Scene context: ${opts.catalogPromptHint}`,
    ...metaCue,
    ...IDENTITY_LOCK,
    '',
    `EXCLUSIVITY: The output contains ONLY the ${role === 'groom' ? 'groom' : 'bride'} (one person). Do NOT add a ${role === 'groom' ? 'bride' : 'groom'} or any second person, even if the catalog master suggests space for one.`,
    ...BODY_LOCK,
    ...COMPOSITION_LOCK,
    ...bodySection,
    ...CATALOG_INTEGRATION,
    ...PHOTOREALISM,
    ...NEGATIVES,
    '',
    'Style: Professional wedding photography, photorealistic, cinematic.',
  ].join('\n');
}

// ──────────────────────────────────────────────────────────────
// (D) 커플 사진 직결 — anchor 우회
// ──────────────────────────────────────────────────────────────

export function buildCouplePhotoSnapPrompt(input: SnapPromptInput | string): string {
  const opts: SnapPromptInput =
    typeof input === 'string' ? { catalogPromptHint: input } : input;
  const bodySection = buildBodySection(opts.groom, opts.bride);

  // 커플 사진 모드 — pose/framing 도 Image 1 (커플 사진) 에서 옴.
  // 따라서 COMPOSITION_LOCK 대신 Image 1 우위 안내가 더 맞음.
  // catalogMeta 도 적용 안 함 (Image 1 의 framing 이 우선).
  return [
    'Compose a wedding portrait using TWO input images:',
    '- Image 1 = Couple photo. Use for IDENTITY + POSE + framing + relative scale + interaction. This is the anchor.',
    '- Image 2 = Style reference (catalog master). Use ONLY for outfits / background / environment / lighting tone. NOT for face or pose.',
    '',
    `Scene context: ${opts.catalogPromptHint}`,
    '',
    'IDENTITY & POSE FIDELITY (from Image 1 — must be preserved):',
    '- Faces (eye shape, nose, jaw, skin tone/texture, hair, glasses, facial hair, makeup) match Image 1 with high fidelity.',
    '- Keep the exact poses, gestures, hand positions, head tilts, and the way the couple holds / leans toward each other.',
    '- Keep camera angle and framing close to Image 1; do not arbitrarily reframe.',
    '- Glasses / facial hair / hair style: take ENTIRELY from Image 1, not from Image 2.',
    '',
    'STYLE TRANSFER (from Image 2 — apply over Image 1):',
    "- Replace casual / everyday outfits with the wedding attire shown in Image 2 (groom: suit/tux as in Image 2; bride: wedding dress as in Image 2). Match cut, color, tie type, neckline, lace, etc.",
    '- Replace the background/environment with the one in Image 2.',
    "- Match Image 2's lighting direction, color temperature, and softness across the whole frame.",
    '- Add small wedding props (bouquet, boutonniere) only if naturally consistent with Image 2.',
    ...BODY_LOCK,
    ...bodySection,
    ...CATALOG_INTEGRATION,
    ...PHOTOREALISM,
    ...NEGATIVES,
    '',
    'Style: Professional wedding photography, photorealistic, cinematic.',
  ].join('\n');
}
