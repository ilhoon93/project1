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

export interface BodyMetrics {
  /** 키 cm — 140~210 권장 */
  heightCm: number;
  /** 몸무게 kg — 35~150 권장 */
  weightKg: number;
}

export interface SnapPromptInput {
  catalogPromptHint: string;
  groom?: BodyMetrics;
  bride?: BodyMetrics;
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
 * 동일 강도로 유지.
 */
const CATALOG_INTEGRATION = [
  '',
  'NATURAL INTEGRATION (subject ↔ scene):',
  "- Re-light the subject(s) to match the catalog scene's primary light direction, color temperature, and softness.",
  "- Apply a single consistent color grade, identical white balance and contrast curve, across subject(s) and background — one camera, one exposure.",
  "- Soft natural edges around hair, clothing, bouquet — no sharp cutout halos, no color fringing.",
  '- Subtle environmental color cast from the scene bounces softly onto skin and clothing.',
  '',
  'ANATOMICAL PROPORTIONS — CRITICAL (most common failure mode):',
  '- Head height MUST be 1/7.5 to 1/8 of total body height (lean toward 1/8 if uncertain). Shoulders about 2x head width.',
  '- For half-body framing: the face occupies roughly 1/3 of the vertical frame, NOT 1/2.',
  '- DO NOT enlarge the face to emphasize identity. If the face appears even slightly oversized, re-render smaller.',
  '- Match the face size to the catalog reference framing, not to the anchor crop. The anchor provides identity, the catalog provides scale.',
  '- Expression: keep a soft closed-lip subtle smile (no teeth, no open-mouth grin) consistent with the anchor, unless the catalog scene explicitly demands otherwise.',
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
        'BODY PROPORTIONS:',
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
    `- Match the ${role === 'groom' ? "groom's" : "bride's"} identity from ${ref} (eye shape, nose bridge, jawline, skin tone/texture, hair style/color) precisely — but render the face at the anatomically correct size for the chosen framing. Identity, NOT scale.`,
    faceCount > 1
      ? '- Multi-angle references describe a single 3D face. Reconcile them into one consistent face; do NOT produce different-looking siblings.'
      : '- The single reference face is frontal — extrapolate plausible 3D shape without identity drift.',
    `- The frame contains ONLY the ${role === 'groom' ? 'groom' : 'bride'} (one person). Do NOT add a second person.`,
    '- Do NOT enlarge or up-scale the face in order to make the identity more obvious — preserve natural head-to-body proportions.',
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

  return [
    'Compose a couple wedding portrait using THREE input images:',
    '- Image 1 = Groom anchor (solo portrait of the groom). PRESERVE his face, hair, skin tone, and body proportions exactly.',
    '- Image 2 = Bride anchor (solo portrait of the bride). PRESERVE her face, hair, skin tone, and body proportions exactly.',
    "- Image 3 = Composition reference (catalog master). Replicate this image's pose, framing, camera angle, depth of field, background, outfits, lighting, and overall composition.",
    '',
    `Scene context: ${opts.catalogPromptHint}`,
    '',
    'IDENTITY FIDELITY — strict role assignment:',
    "- Image 1's groom → the groom position in Image 3. Image 2's bride → the bride position. Do NOT swap, do NOT blend the two faces.",
    "- Face details (eye shape, nose bridge, jawline, skin tone/texture, hair style/color) must clearly match each respective anchor.",
    '- Do NOT add additional people not present in the anchors.',
    '',
    'FRAMING MISMATCH HANDLING (anchors may be close-up while catalog is full-body, etc.):',
    '- Use anchors as canonical identity / body references and RE-RENDER each person at the scale demanded by Image 3.',
    "- If an anchor is close-up and Image 3 is full-body, extrapolate the body below the anchor crop using the body guide and the anchor's visible shoulders/neck.",
    '- If an anchor is half-body and Image 3 is close-up, scale up the face without softness or identity loss.',
    '',
    'COMPOSITION (from Image 3 — replicate):',
    '- Pose, body positions, gestures, hand positions, interaction between the two',
    '- Camera angle, framing, depth of field, lens character',
    '- Background, environment, outfits, props',
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
        'BODY PROPORTIONS:',
        personGuide,
        '- Keep the face strictly from Image 1; only the body silhouette and proportions follow the guide above.',
      ]
    : [];

  return [
    `Compose a SOLO ${role === 'groom' ? 'groom' : 'bride'} wedding portrait using TWO input images:`,
    `- Image 1 = ${role === 'groom' ? 'Groom' : 'Bride'} anchor (solo portrait). PRESERVE the face, hair, skin tone, and body proportions exactly.`,
    "- Image 2 = Composition reference (catalog master). Replicate pose, framing, camera angle, depth of field, background, outfit, lighting, and composition.",
    '',
    `Scene context: ${opts.catalogPromptHint}`,
    '',
    'IDENTITY FIDELITY:',
    `- Image 1's face is the ${role === 'groom' ? 'groom' : 'bride'} — match this identity precisely (eye shape, nose bridge, jawline, skin tone/texture, hair style/color).`,
    `- The output contains ONLY the ${role === 'groom' ? 'groom' : 'bride'} (one person). Do NOT add a ${role === 'groom' ? 'bride' : 'groom'} or any second person, even if the catalog master suggests space for one.`,
    '',
    'FRAMING MISMATCH HANDLING:',
    "- Image 1 (anchor) may be cropped differently from Image 2. Use Image 1 as the canonical identity / body reference and RE-RENDER at whatever scale Image 2 demands.",
    "- Extrapolate body parts not visible in Image 1 using the body guide (if any) and the anchor's visible shoulders.",
    '',
    'COMPOSITION (from Image 2 — replicate):',
    '- Pose, body position, gesture, hand position',
    '- Camera angle, framing, depth of field, lens character',
    '- Background, environment, outfit, props',
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

  return [
    'Compose a wedding portrait using TWO input images:',
    "- Image 1 = Couple photo. PRESERVE the two people exactly — faces, identities, body shapes, poses, hand positions, relative scale, eye lines, and their interaction with each other. This is the anchor for identity and pose.",
    "- Image 2 = Style reference (catalog master). Take outfits, background, environment, and overall lighting tone from this image.",
    '',
    `Scene context: ${opts.catalogPromptHint}`,
    '',
    'IDENTITY & POSE FIDELITY (from Image 1 — must be preserved):',
    '- Faces must match Image 1 with high fidelity (eye shape, nose bridge, jawline, skin tone/texture, hair, expression)',
    '- Keep the exact poses, gestures, hand positions, head tilts, and the way the couple holds / leans toward each other',
    '- Keep camera angle and framing close to Image 1; do not arbitrarily reframe',
    '',
    'STYLE TRANSFER (from Image 2):',
    "- Replace casual / everyday outfits with the wedding attire shown in Image 2 (groom: formal suit/tux as in Image 2; bride: wedding dress as in Image 2)",
    '- Replace the background/environment with the one in Image 2',
    "- Match Image 2's lighting direction, color temperature, and softness across the whole frame",
    '- Add small wedding props (bouquet, boutonniere) only if naturally consistent with Image 2',
    ...bodySection,
    ...CATALOG_INTEGRATION,
    ...PHOTOREALISM,
    ...NEGATIVES,
    '',
    'Style: Professional wedding photography, photorealistic, cinematic.',
  ].join('\n');
}
