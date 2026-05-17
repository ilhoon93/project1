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
  /**
   * 카탈로그 마스터에서 사전 추출한 컬러/조명 메타 (CatalogColorMeta).
   * "Catalog uses ~5500K warm daylight" 같은 객관 hint 를 동적으로 주입해
   * 모델이 추상적 "match the tone" 이 아닌 구체 수치 지시를 받게 한다.
   */
  catalogColorHint?: string | null;
  /**
   * Phase A — together 카탈로그 입력에 anchor 외에 selfie 진본도 함께 전달했는지.
   * true 면 5장 입력 (groom anchor, bride anchor, groom selfie, bride selfie, catalog),
   * false 면 기존 3장 (anchor 만).
   */
  includeSelfieRefs?: boolean;
  /**
   * Phase A — solo 카탈로그용. true 면 3장 (anchor, selfie, catalog), false 면 2장.
   */
  includeSelfieRef?: boolean;
}

/**
 * 카탈로그 메타데이터(CatalogColorMeta) 의 moodHint 를 prompt 친화적 한 줄로 변환.
 * harmonize/finishing 모듈과 빌더 사이 결합도를 낮추기 위해 빌더는 string 만 받는다.
 */
function colorHintSection(hint: string | null | undefined): string[] {
  if (!hint) return [];
  return [
    '',
    'CATALOG COLOR / LIGHTING GROUND TRUTH (objective measurement from the catalog master):',
    `- ${hint}`,
    '- Match this exact white balance, color temperature, and overall mood. Do NOT use the anchor selfies\' lighting as reference for color.',
  ];
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
  'SELFIE PERSPECTIVE CORRECTION — common user input issue:',
  "- The face reference image(s) may be a SELFIE shot at close range with a wide-angle phone front camera (~24mm equivalent). Wide-angle close-up distorts faces: nose appears enlarged, cheeks pushed out, ears smaller, jawline rounded — the so-called \"selfie distortion\".",
  '- INTERPRET the face identity from the reference, but RENDER it as if photographed under a 50–85mm portrait lens at proper distance (~2m). That means: natural facial proportions, slimmer nose (corrected), normal cheek width, ears at proper relative size.',
  '- Preserve identity features (eye shape, eye spacing, brow shape, lip shape, hair, skin tone) but normalize the perspective distortion of the input.',
  '- If the reference looks like a normal portrait already (not a close-up selfie), no correction needed — just match identity directly.',
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
  'ANATOMICAL PROPORTIONS — HIGHEST PRIORITY (recurring failure mode — must fix):',
  '- HEAD SIZE RULE: Head height MUST be 1/8 of total body height (use the smaller side — never larger than 1/7.5). Shoulders ≈ 2× head width.',
  '- FRAMING RULE: For full-body framing the face occupies ≤ 12% of the vertical frame. For 3/4 framing ≤ 18%. For half-body (waist-up) framing ≤ 28%. NEVER more.',
  '- THE CATALOG REFERENCE IS THE AUTHORITY ON SCALE. Match the face size of the people in the catalog reference precisely. Ignore the anchor crop scale entirely — the anchor exists ONLY for identity (eye/nose/jaw/skin tone/hair).',
  '- DO NOT enlarge the face to make identity more visible. The catalog reference dictates how big the face is in the final frame. Identity ≠ scale.',
  '- Self-check before finalizing: place a mental ruler against the rendered head. If it appears bigger than the head of the same-framed person in the catalog reference, RE-RENDER with a smaller head. An oversized head is a hard failure that must be fixed.',
  '- Avoid "bobblehead" effect: shrunken torso with oversized head, neck-too-thin, shoulders-too-narrow. Torso/limbs must match the head scale, not the other way around.',
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
  /**
   * baselineSceneHint = ANCHOR_BASELINE + ANCHOR_EXPRESSION_* + ANCHOR_ATTIRE[slot] + framingHint.
   * Expression 은 API route 가 slightSmile 옵션 보고 NEUTRAL / SLIGHT_SMILE
   * 중 골라 미리 합쳐서 넘긴다.
   */
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

  // 사용자 피드백 (반복): 앵커 결과에 머리가 비대하게 나오는 실패 모드가 끈질김.
  // 해결: 비율 룰을 첫 instruction 으로 끌어올리고, 수치 임계값과 self-check
  // 단계를 명시적으로 박아 모델 attention 이 face fidelity 쪽으로만 쏠리지 않게 함.
  const headSizeRule = [
    '',
    '⚠️ HEAD SIZE — HIGHEST PRIORITY RULE (failure to follow this = re-render):',
    '- The HEAD must occupy AT MOST 1/8 of the total body height. Eight head-heights stacked = the full body, not less.',
    '- For a half-body (waist-up) framing, the FACE must occupy LESS THAN 33% of the vertical frame height. If you find yourself rendering the face at 40%+ of frame height, STOP and re-render with the face smaller.',
    '- For a close-up framing, the face fills ~50% of frame height — never more than 60%. No exception.',
    '- The FACE is an IDENTITY REFERENCE, not the focal element. The BODY is the focal element. Render the body realistically; the face is the natural-sized portion at the top.',
    '- ABSOLUTELY FORBIDDEN: oversized "bobblehead" head perched on a small body, shrunken neck/shoulders, head wider than shoulders, face larger than the chest area in a waist-up shot. These are immediate failures.',
    '- Before finalizing the render: mentally measure the head height in the output. If head_height × 8 ≥ total body height — pass. Otherwise re-render.',
  ];

  return [
    `Compose a clean solo wedding anchor portrait using ${faceCount} input image${faceCount > 1 ? 's' : ''}:`,
    faceLine,
    ...headSizeRule,
    '',
    `Scene & framing: ${opts.baselineSceneHint}`,
    '',
    'IDENTITY FIDELITY (match identity, not scale):',
    `- Match the ${role === 'groom' ? "groom's" : "bride's"} identity from ${ref} (eye shape, nose bridge, jawline, skin tone/texture, hair style/color) precisely — but render the face at the anatomically correct size described in the HEAD SIZE RULE above. Identity ≠ scale.`,
    faceCount > 1
      ? '- Multi-angle references describe a single 3D face. Reconcile them into one consistent face; do NOT produce different-looking siblings.'
      : '- The single reference face is frontal — extrapolate plausible 3D shape without identity drift.',
    `- The frame contains ONLY the ${role === 'groom' ? 'groom' : 'bride'} (one person). Do NOT add a second person.`,
    '- The face is sharp and well-lit but rendered SMALL relative to the body. Do NOT enlarge the face to "show off" identity.',
    ...bodySection,
    ...ANCHOR_INTEGRATION,
    ...PHOTOREALISM,
    ...NEGATIVES,
    '',
    'Style: Professional wedding photography, photorealistic, cinematic. The face is sharp but rendered at the natural anatomical size — small head, full body proportions.',
  ].join('\n');
}

// ──────────────────────────────────────────────────────────────
// (B) Together 카탈로그 — groom-anchor + bride-anchor + catalog
// ──────────────────────────────────────────────────────────────

export function buildTogetherCatalogPrompt(input: SnapPromptInput | string): string {
  const opts: SnapPromptInput =
    typeof input === 'string' ? { catalogPromptHint: input } : input;
  const bodySection = buildBodySection(opts.groom, opts.bride);
  const colorSection = colorHintSection(opts.catalogColorHint);

  // Phase A — 5장 입력 (anchor + selfie + catalog) vs 3장 fallback (anchor + catalog).
  if (opts.includeSelfieRefs) {
    return [
      'Compose a couple wedding portrait using FIVE input images:',
      '- Image 1 = Groom anchor (solo wedding portrait of the groom). Use for BODY proportions, silhouette, and pose reference.',
      '- Image 2 = Bride anchor (solo wedding portrait of the bride). Use for BODY proportions, silhouette, and pose reference.',
      '- Image 3 = Groom face REFERENCE (ORIGINAL photo of the groom — not AI generated). HIGHEST PRIORITY for facial identity: eye shape, eye color, nose bridge/tip shape, lip shape, jawline contour, skin tone, hair texture, brow shape.',
      '- Image 4 = Bride face REFERENCE (ORIGINAL photo of the bride — not AI generated). HIGHEST PRIORITY for facial identity (same list as above).',
      "- Image 5 = Composition reference (catalog master). Replicate pose, framing, camera angle, depth of field, background, outfits, lighting, and overall composition — including face/head SIZE relative to the frame.",
      '',
      `Scene context: ${opts.catalogPromptHint}`,
      '',
      'IDENTITY FIDELITY — face from REAL photos, body from anchors:',
      "- The faces in Image 3 and Image 4 are the ground truth. The output faces MUST be unmistakably recognizable as the SAME two people from those photos — never blend, never substitute, never approximate.",
      "- Image 3's face → groom position in Image 5. Image 4's face → bride position. NO swapping.",
      "- Anchors (Image 1, 2) describe BODY only — height, build, shoulder width, posture. Their faces are AI-generated approximations and should be considered LESS authoritative than the original photos for face details.",
      '- If anchor face and selfie face differ (anchor is AI re-rendered), trust the SELFIE for all facial features. The anchor face is just a placeholder.',
      '- Do NOT add additional people. Do NOT use catalog master (Image 5) as a face reference — its people are unrelated.',
      '',
      'SCALE AUTHORITY — catalog reference (Image 5) determines head SIZE:',
      '- Match output head size relative to frame to Image 5. No bigger. The selfies and anchors are NOT scale references.',
      '- If anchors are close-up and Image 5 is full-body, the rendered faces must be SMALL (matching Image 5), not large (matching anchors).',
      '- Oversized head = hard failure. Re-render with smaller head.',
      '',
      'COMPOSITION (from Image 5 — replicate):',
      '- Pose, body positions, gestures, hand positions, interaction between the two',
      '- Camera angle, framing, depth of field, lens character',
      '- Background, environment, outfits, props',
      ...bodySection,
      ...colorSection,
      ...CATALOG_INTEGRATION,
      ...PHOTOREALISM,
      ...NEGATIVES,
      '',
      'Style: Professional wedding photography, photorealistic, cinematic.',
    ].join('\n');
  }

  // Fallback (selfie 미보존된 구버전 / 라이브러리 anchor) — 기존 3장 흐름.
  return [
    'Compose a couple wedding portrait using THREE input images:',
    '- Image 1 = Groom anchor (solo portrait of the groom). PRESERVE his face, hair, skin tone, and body proportions exactly.',
    '- Image 2 = Bride anchor (solo portrait of the bride). PRESERVE her face, hair, skin tone, and body proportions exactly.',
    "- Image 3 = Composition reference (catalog master). Replicate this image's pose, framing, camera angle, depth of field, background, outfits, lighting, and overall composition — including face/head SIZE relative to the frame.",
    '',
    `Scene context: ${opts.catalogPromptHint}`,
    '',
    'IDENTITY FIDELITY — strict role assignment:',
    "- Image 1's groom → the groom position in Image 3. Image 2's bride → the bride position. Do NOT swap, do NOT blend the two faces.",
    "- Face details (eye shape, nose bridge, jawline, skin tone/texture, hair style/color) must clearly match each respective anchor.",
    '- Do NOT add additional people not present in the anchors.',
    '',
    'SCALE AUTHORITY — the catalog reference (Image 3) ALWAYS wins on face/head size:',
    '- Measure the head height of each person in Image 3 relative to its frame. The output heads MUST be that same size relative to the output frame. No bigger.',
    '- The anchors (Image 1 / Image 2) are IDENTITY references only. They are not scale references. Crop and zoom level of the anchors are irrelevant.',
    '- If the anchors are close-up portraits and Image 3 is a full-body / wide shot, the rendered faces must be SMALL (matching Image 3), not large (matching the anchors).',
    '- If you find yourself rendering heads larger than those in Image 3, STOP and re-render smaller. An oversized head is a hard failure mode.',
    '',
    'FRAMING MISMATCH HANDLING (anchors may be close-up while catalog is full-body, etc.):',
    '- Use anchors as canonical identity / body references and RE-RENDER each person at the scale demanded by Image 3.',
    "- If an anchor is close-up and Image 3 is full-body, extrapolate the body below the anchor crop using the body guide and the anchor's visible shoulders/neck — and shrink the head to match Image 3's head scale.",
    '- If an anchor is half-body and Image 3 is close-up, scale up the face without softness or identity loss.',
    '',
    'COMPOSITION (from Image 3 — replicate):',
    '- Pose, body positions, gestures, hand positions, interaction between the two',
    '- Camera angle, framing, depth of field, lens character',
    '- Background, environment, outfits, props',
    ...bodySection,
    ...colorSection,
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
  const roleEn = role === 'groom' ? 'groom' : 'bride';
  const RoleEn = role === 'groom' ? 'Groom' : 'Bride';
  const otherEn = role === 'groom' ? 'bride' : 'groom';
  const bodyMetrics = role === 'groom' ? opts.groom : opts.bride;
  const personGuide = bodyMetrics ? buildPersonGuide(role, bodyMetrics) : null;
  const colorSection = colorHintSection(opts.catalogColorHint);

  // Phase A — 3장 입력 (anchor + selfie + catalog) vs 2장 fallback (anchor + catalog).
  if (opts.includeSelfieRef) {
    const bodySection = personGuide
      ? [
          '',
          'BODY PROPORTIONS:',
          personGuide,
          '- Keep facial features strictly from Image 2 (the original photo); body silhouette and proportions follow the guide above + Image 1 (anchor).',
        ]
      : [];
    return [
      `Compose a SOLO ${roleEn} wedding portrait using THREE input images:`,
      `- Image 1 = ${RoleEn} anchor (solo wedding portrait). Use for BODY proportions, silhouette, and pose reference.`,
      `- Image 2 = ${RoleEn} face REFERENCE (ORIGINAL photo — not AI generated). HIGHEST PRIORITY for facial identity: eye shape, eye color, nose bridge/tip shape, lip shape, jawline contour, skin tone, hair texture, brow shape.`,
      "- Image 3 = Composition reference (catalog master). Replicate pose, framing, camera angle, depth of field, background, outfit, lighting, and composition.",
      '',
      `Scene context: ${opts.catalogPromptHint}`,
      '',
      'IDENTITY FIDELITY — face from REAL photo, body from anchor:',
      `- The face in Image 2 is the ground truth. The output face MUST be unmistakably recognizable as the SAME person from that photo. Match: eye shape, eye color, nose, lips, jawline, skin tone, hair, brows.`,
      `- The anchor (Image 1) describes BODY only — height, build, posture. Its face is AI-rendered, so trust Image 2 for all face details when they differ.`,
      `- The output contains ONLY the ${roleEn} (one person). Do NOT add a ${otherEn} or any second person, even if the catalog master (Image 3) suggests space for one. Do NOT use Image 3's people as a face reference — they are unrelated.`,
      '',
      'SCALE AUTHORITY — catalog reference (Image 3) determines head SIZE:',
      '- Match output head size relative to frame to Image 3. The anchor (Image 1) and selfie (Image 2) are NOT scale references.',
      '- If anchor/selfie are close-up and Image 3 is full-body, the rendered face must be SMALL (matching Image 3), not large.',
      '',
      'COMPOSITION (from Image 3 — replicate):',
      '- Pose, body position, gesture, hand position',
      '- Camera angle, framing, depth of field, lens character',
      '- Background, environment, outfit, props',
      ...bodySection,
      ...colorSection,
      ...CATALOG_INTEGRATION,
      ...PHOTOREALISM,
      ...NEGATIVES,
      '',
      'Style: Professional wedding photography, photorealistic, cinematic.',
    ].join('\n');
  }

  // Fallback — 2장 입력 (anchor + catalog). 구버전 / 라이브러리 anchor 에 selfie 없음.
  const bodySection = personGuide
    ? [
        '',
        'BODY PROPORTIONS:',
        personGuide,
        '- Keep the face strictly from Image 1; only the body silhouette and proportions follow the guide above.',
      ]
    : [];
  return [
    `Compose a SOLO ${roleEn} wedding portrait using TWO input images:`,
    `- Image 1 = ${RoleEn} anchor (solo portrait). PRESERVE the face, hair, skin tone, and body proportions exactly.`,
    "- Image 2 = Composition reference (catalog master). Replicate pose, framing, camera angle, depth of field, background, outfit, lighting, and composition.",
    '',
    `Scene context: ${opts.catalogPromptHint}`,
    '',
    'IDENTITY FIDELITY:',
    `- Image 1's face is the ${roleEn} — match this identity precisely (eye shape, nose bridge, jawline, skin tone/texture, hair style/color).`,
    `- The output contains ONLY the ${roleEn} (one person). Do NOT add a ${otherEn} or any second person, even if the catalog master suggests space for one.`,
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
    ...colorSection,
    ...CATALOG_INTEGRATION,
    ...PHOTOREALISM,
    ...NEGATIVES,
    '',
    'Style: Professional wedding photography, photorealistic, cinematic.',
  ].join('\n');
}

// ──────────────────────────────────────────────────────────────
// (B') Together prompt-only — anchor + selfie 만, 카탈로그 마스터 미참조
// ──────────────────────────────────────────────────────────────
//
// strict 버전 (buildTogetherCatalogPrompt) 과의 차이:
//   - 입력 이미지에서 카탈로그 마스터 제거 (4장 또는 2장)
//   - 포즈 / 구도 / 배경 / 의상은 catalogPromptHint 텍스트로만 지시
//   - 카탈로그 마스터가 사라져 "scale authority" 가 없어지므로 ANCHOR_INTEGRATION
//     의 머리:몸 1/8 비율 강제 블록을 함께 주입 (앵커 파이프라인과 동일 강도)
//   - CATALOG_INTEGRATION (re-light to match catalog) 은 빼고, 텍스트 hint 의
//     광질 묘사로 대체. catalogColorHint(LAB 평균 기반) 는 그대로 활용.
//
// 사용 사례: 얼굴 보존이 우선이고 정확한 포즈 재현은 덜 중요한 카탈로그.
// 추천 컷 — face-front 정자세 (studio-classic, meadow-spring, beach-sunset).

export function buildTogetherPromptOnly(input: SnapPromptInput | string): string {
  const opts: SnapPromptInput =
    typeof input === 'string' ? { catalogPromptHint: input } : input;
  const bodySection = buildBodySection(opts.groom, opts.bride);
  const colorSection = colorHintSection(opts.catalogColorHint);

  if (opts.includeSelfieRefs) {
    return [
      'Compose a couple wedding portrait using FOUR input images (no catalog reference — pose & composition described in text):',
      '- Image 1 = Groom anchor (solo wedding portrait of the groom). Use for BODY proportions, silhouette, and pose reference.',
      '- Image 2 = Bride anchor (solo wedding portrait of the bride). Same usage.',
      '- Image 3 = Groom face REFERENCE (ORIGINAL photo of the groom — not AI generated). HIGHEST PRIORITY for facial identity: eye shape, eye color, nose bridge/tip shape, lip shape, jawline contour, skin tone, hair texture, brow shape.',
      '- Image 4 = Bride face REFERENCE (ORIGINAL photo of the bride — not AI generated). HIGHEST PRIORITY for facial identity (same list as above).',
      '',
      `Scene, composition & styling (text-only — there is NO image reference for these; follow the description faithfully): ${opts.catalogPromptHint}`,
      '',
      'IDENTITY FIDELITY — face from REAL photos, body from anchors:',
      "- The faces in Image 3 and Image 4 are the ground truth. The output faces MUST be unmistakably recognizable as the SAME two people from those photos — never blend, never substitute, never approximate.",
      "- Image 3's face → groom position. Image 4's face → bride position. NO swapping.",
      '- Anchors (Image 1, 2) describe BODY only — height, build, shoulder width, posture. Their faces are AI-generated approximations and should be considered LESS authoritative than the original photos for face details.',
      '- If anchor face and selfie face differ, trust the SELFIE for all facial features. The anchor face is just a placeholder.',
      '- Do NOT add additional people. There is no catalog master image — do NOT invent extra subjects.',
      '',
      'COMPOSITION & POSE (from the scene description above — no image reference):',
      '- Interpret the described pose, framing, camera angle, depth of field, and outfits from the text.',
      '- If the description is ambiguous, default to: standing side by side, eye-level camera, three-quarter framing, 50–85mm portrait lens, shallow depth of field, both subjects looking softly at camera with natural relaxed expressions.',
      '- DO NOT extrapolate poses that put the face out of view (extreme profile, head turned away) unless the scene description explicitly says so.',
      ...bodySection,
      ...colorSection,
      ...ANCHOR_INTEGRATION,
      ...PHOTOREALISM,
      ...NEGATIVES,
      '',
      'Style: Professional wedding photography, photorealistic, cinematic.',
    ].join('\n');
  }

  // Fallback (selfie 미보존된 라이브러리 anchor) — anchor 2장만.
  return [
    'Compose a couple wedding portrait using TWO input images (no catalog reference):',
    '- Image 1 = Groom anchor (solo portrait of the groom). PRESERVE his face, hair, skin tone, and body proportions exactly.',
    '- Image 2 = Bride anchor (solo portrait of the bride). PRESERVE her face, hair, skin tone, and body proportions exactly.',
    '',
    `Scene, composition & styling (text-only): ${opts.catalogPromptHint}`,
    '',
    'IDENTITY FIDELITY — strict role assignment:',
    "- Image 1's groom → the groom position. Image 2's bride → the bride position. Do NOT swap, do NOT blend the two faces.",
    '- Face details (eye shape, nose bridge, jawline, skin tone/texture, hair style/color) must clearly match each respective anchor.',
    '- Do NOT add additional people not present in the anchors.',
    '',
    'COMPOSITION & POSE (from the scene description above — no image reference):',
    '- Interpret the described pose, framing, camera angle, depth of field, and outfits from the text.',
    '- If ambiguous, default to: standing side by side at eye level, three-quarter framing, 50–85mm lens, shallow DOF, both looking softly at camera.',
    ...bodySection,
    ...colorSection,
    ...ANCHOR_INTEGRATION,
    ...PHOTOREALISM,
    ...NEGATIVES,
    '',
    'Style: Professional wedding photography, photorealistic, cinematic.',
  ].join('\n');
}

// ──────────────────────────────────────────────────────────────
// (C') Solo prompt-only — one anchor + selfie 만, 카탈로그 마스터 미참조
// ──────────────────────────────────────────────────────────────

export function buildSoloPromptOnly(opts: SoloCatalogPromptOpts): string {
  const role = opts.slot;
  const roleEn = role === 'groom' ? 'groom' : 'bride';
  const RoleEn = role === 'groom' ? 'Groom' : 'Bride';
  const otherEn = role === 'groom' ? 'bride' : 'groom';
  const bodyMetrics = role === 'groom' ? opts.groom : opts.bride;
  const personGuide = bodyMetrics ? buildPersonGuide(role, bodyMetrics) : null;
  const colorSection = colorHintSection(opts.catalogColorHint);

  if (opts.includeSelfieRef) {
    const bodySection = personGuide
      ? [
          '',
          'BODY PROPORTIONS:',
          personGuide,
          '- Keep facial features strictly from Image 2 (the original photo); body silhouette and proportions follow the guide above + Image 1 (anchor).',
        ]
      : [];
    return [
      `Compose a SOLO ${roleEn} wedding portrait using TWO input images (no catalog reference — pose & composition described in text):`,
      `- Image 1 = ${RoleEn} anchor (solo wedding portrait). Use for BODY proportions, silhouette, and pose reference.`,
      `- Image 2 = ${RoleEn} face REFERENCE (ORIGINAL photo — not AI generated). HIGHEST PRIORITY for facial identity: eye shape, eye color, nose bridge/tip shape, lip shape, jawline contour, skin tone, hair texture, brow shape.`,
      '',
      `Scene, composition & styling (text-only — there is NO image reference for these; follow the description faithfully): ${opts.catalogPromptHint}`,
      '',
      'IDENTITY FIDELITY — face from REAL photo, body from anchor:',
      `- The face in Image 2 is the ground truth. The output face MUST be unmistakably recognizable as the SAME person from that photo. Match: eye shape, eye color, nose, lips, jawline, skin tone, hair, brows.`,
      `- The anchor (Image 1) describes BODY only — height, build, posture. Its face is AI-rendered, so trust Image 2 for all face details when they differ.`,
      `- The output contains ONLY the ${roleEn} (one person). Do NOT add a ${otherEn} or any second person. There is no catalog master image — do NOT invent extra subjects.`,
      '',
      'COMPOSITION & POSE (from the scene description above — no image reference):',
      '- Interpret the described pose, framing, camera angle, depth of field, and outfit from the text.',
      '- If the description is ambiguous, default to: standing upright, three-quarter angle, 50–85mm portrait lens, shallow DOF, subject looking softly at camera with a calm natural expression.',
      '- DO NOT generate poses that put the face out of view (extreme profile, head turned away) unless the description explicitly says so.',
      ...bodySection,
      ...colorSection,
      ...ANCHOR_INTEGRATION,
      ...PHOTOREALISM,
      ...NEGATIVES,
      '',
      'Style: Professional wedding photography, photorealistic, cinematic.',
    ].join('\n');
  }

  // Fallback — anchor 1장만 (selfie 미보존).
  const bodySection = personGuide
    ? [
        '',
        'BODY PROPORTIONS:',
        personGuide,
        '- Keep the face strictly from Image 1; only the body silhouette and proportions follow the guide above.',
      ]
    : [];
  return [
    `Compose a SOLO ${roleEn} wedding portrait using ONE input image (no catalog reference):`,
    `- Image 1 = ${RoleEn} anchor (solo portrait). PRESERVE the face, hair, skin tone, and body proportions exactly.`,
    '',
    `Scene, composition & styling (text-only): ${opts.catalogPromptHint}`,
    '',
    'IDENTITY FIDELITY:',
    `- Image 1's face is the ${roleEn} — match this identity precisely (eye shape, nose bridge, jawline, skin tone/texture, hair style/color).`,
    `- The output contains ONLY the ${roleEn} (one person). Do NOT add a ${otherEn} or any second person.`,
    '',
    'COMPOSITION & POSE (from the scene description above — no image reference):',
    '- Interpret the described pose, framing, camera angle, depth of field, and outfit from the text.',
    '- If ambiguous, default to: standing upright, three-quarter angle, 50–85mm lens, shallow DOF, subject looking softly at camera.',
    ...bodySection,
    ...colorSection,
    ...ANCHOR_INTEGRATION,
    ...PHOTOREALISM,
    ...NEGATIVES,
    '',
    'Style: Professional wedding photography, photorealistic, cinematic.',
  ].join('\n');
}

// ──────────────────────────────────────────────────────────────
// (D) 커플 사진 직결 — anchor 우회
// ──────────────────────────────────────────────────────────────

/**
 * 커플 사진 직결 — anchor 우회. STRICT 모드:
 *
 *   업로드된 커플 사진(Image 1)의 얼굴·구도·포즈·프레이밍은 절대 변형하지 않고,
 *   카탈로그 마스터(Image 2)에서는 배경 / 의상 / 분위기·조명·컬러 그레이드만 참조해
 *   바꾼다. 흔히 발생하는 실패 모드 (얼굴이 카탈로그 인물로 변형, 프레이밍이 카탈로그
 *   비율로 끌려감, 포즈가 살짝 다른 자세로 재구성) 를 명시적으로 차단.
 *
 * 사용자 요청 (PR 시점):
 *   "올린 사진의 구도와 얼굴을 절대 변형하지 않고 카탈로그의 배경과 의상과 분위기만
 *    참조해서 변경하게 만들어줘."
 */
export function buildCouplePhotoSnapPrompt(input: SnapPromptInput | string): string {
  const opts: SnapPromptInput =
    typeof input === 'string' ? { catalogPromptHint: input } : input;
  const bodySection = buildBodySection(opts.groom, opts.bride);
  const colorSection = colorHintSection(opts.catalogColorHint);

  return [
    'STRICT preservation task. Two input images, very different roles:',
    "- Image 1 = User couple photo. THIS IS THE LOCKED REFERENCE. Faces, identities, poses, hand positions, head tilts, the way they lean toward each other, eye lines, framing, camera angle, and face/head SIZE relative to the frame ALL come from Image 1 unchanged.",
    "- Image 2 = Catalog style reference. ONLY THREE ELEMENTS come from Image 2: (a) wedding outfits, (b) background / environment, (c) overall lighting tone, color grade, and atmospheric mood. NOTHING else.",
    '',
    `Scene context (mood only, NOT for composition): ${opts.catalogPromptHint}`,
    '',
    'LOCKED FROM IMAGE 1 — DO NOT CHANGE ANY OF THESE:',
    '- Faces: identical eye shape, nose bridge, jawline, mouth shape, skin tone/texture, hair shape and color, facial expression. The faces in the output MUST be the same two people as Image 1, indistinguishable from those reference faces.',
    '- Composition: same camera angle, same framing tightness, same crop. Do not recompose, do not reframe wider or tighter than Image 1.',
    '- Pose: identical body positions, gestures, hand positions, where each hand rests, head tilts, shoulder angles, who-leans-toward-whom, eye direction, who looks at camera vs. who looks at partner.',
    '- Relative scale of the two people to each other and to the frame: exact same as Image 1. Heights, body proportions, distance between heads — all locked.',
    '- Face/head SIZE relative to the frame: matches Image 1. Do NOT shrink or enlarge faces based on Image 2 framing. If Image 1 is a close-up, the output is a close-up. If Image 1 is a half-body, the output is a half-body.',
    '',
    'TAKE FROM IMAGE 2 — ONLY THESE THREE THINGS:',
    "- Wedding attire: replace whatever the couple is wearing in Image 1 with the wedding attire shown in Image 2 (groom: the formal suit/tux from Image 2; bride: the wedding dress from Image 2). Drape the new attire naturally onto the existing poses without changing the poses themselves.",
    '- Background / environment: replace the background of Image 1 with the environment in Image 2 (studio backdrop, outdoor garden, hanok courtyard, etc. as appropriate).',
    "- Lighting and color mood: re-light the couple to match Image 2's primary light direction, color temperature, softness, and overall grade. Apply Image 2's color grade across the whole frame so subject and background read as one exposure.",
    '',
    'EXPLICITLY DO NOT:',
    '- Adopt the poses, hand positions, or composition of Image 2. Image 2 is mood reference, not pose reference.',
    '- Replace any face with a face from Image 2 (or from any other source). The faces are Image 1\'s, period.',
    '- Add or remove people. Same two people from Image 1, no third person, no removed person.',
    '- Reframe to match Image 2\'s framing (e.g., if Image 1 is half-body and Image 2 is full-body, the output stays half-body).',
    '- Modify facial expressions to look "more wedding-like" — keep Image 1\'s expressions exactly.',
    '',
    'OPTIONAL WEDDING PROPS:',
    '- A small bouquet or boutonniere may be added ONLY if it can be placed naturally in an existing hand position from Image 1 (bride holding something at waist level, groom\'s pocket). Otherwise, omit. Do not move hands to hold props.',
    ...bodySection,
    ...colorSection,
    ...PHOTOREALISM,
    ...NEGATIVES,
    '',
    'Style: Professional wedding photography, photorealistic, cinematic. Above all: Image 1 IS the photo — Image 2 only changes its costume, room, and lighting.',
  ].join('\n');
}
