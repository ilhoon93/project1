/**
 * 웨딩스냅 프롬프트 빌더
 *
 * 입력 모드 두 가지를 지원한다.
 *   (A) 셀카 2장 — 신랑/신부 얼굴 reference + 카탈로그 마스터샘플 (총 3장)
 *   (B) 커플 사진 1장 — 사용자 포즈/구도 보존, 카탈로그는 스타일(의상/배경) 참조 (총 2장)
 *
 * 두 경우 모두 카탈로그 promptHint 와 (선택) 키·몸무게 가이드를 끼운다.
 *
 * 모든 prompt 의 마지막에는 공통 NEGATIVES 섹션을 추가해 gpt-image-2 가 흔히
 * 만들어내는 인공물(플라스틱 피부, 비대칭 눈, 손가락 오류, 컷아웃 halo 등) 을
 * 사전 차단한다.
 */

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

/**
 * BMI 기반 체형 라벨. 모델이 절대 수치에 민감하지 않으므로 정성적 표현으로
 * 변환해 넣는다. 한국 성인 기준 보수적인 컷오프.
 */
function bodyShape(m: BodyMetrics): string {
  const heightM = m.heightCm / 100;
  const bmi = m.weightKg / (heightM * heightM);
  if (bmi < 18.5) return 'slender, slim build';
  if (bmi < 23) return 'lean and well-proportioned build';
  if (bmi < 25) return 'average, healthy build';
  if (bmi < 28) return 'slightly fuller, soft build';
  return 'fuller-figured, plus-size build';
}

/** 키만 보고 신장 라벨. 두 사람 비교에는 별도 줄에서 다룬다. */
function heightLabel(cm: number): string {
  if (cm < 155) return 'petite stature';
  if (cm < 165) return 'shorter than average stature';
  if (cm < 175) return 'average stature';
  if (cm < 185) return 'tall stature';
  return 'very tall stature';
}

function buildPersonGuide(role: 'groom' | 'bride', m?: BodyMetrics): string | null {
  if (!m) return null;
  const shape = bodyShape(m);
  const height = heightLabel(m.heightCm);
  return `- ${role === 'groom' ? 'Groom' : 'Bride'}: ${m.heightCm} cm tall, ${m.weightKg} kg — ${height}, ${shape}. Render full-body proportions (limb length, shoulder width, torso, waist, hip) consistent with this build.`;
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

/**
 * gpt-image-2 가 자주 만들어내는 흠집들을 자연어 negative 로 차단. 길게 나열할
 * 수록 다른 지시문이 희석되니 가장 잦은 6~8개만 유지.
 */
const NEGATIVES = [
  '',
  'QUALITY REQUIREMENTS — strictly AVOID:',
  '- Plastic, waxy, or overly smooth skin texture (preserve realistic pores and natural micro-detail)',
  '- Asymmetric or misaligned eyes, lopsided pupils, drifting gaze',
  '- Extra, missing, or malformed fingers; deformed hands or wrists',
  '- Distorted, crooked, or missing teeth when smiling',
  '- Visible cutout halos, hard edges, or color fringing around hair and clothing',
  '- Blurry faces while the background is sharp (faces must be the sharpest area)',
  '- Oversharpened artifacts, unnatural HDR look, or overcooked color saturation',
  '- Identity drift — the synthesized faces must clearly match the face reference image(s)',
];

/** (A) 셀카 2장 + 카탈로그 마스터샘플 (image_urls 총 3장) */
export function buildSnapPrompt(input: SnapPromptInput | string): string {
  const opts: SnapPromptInput =
    typeof input === 'string' ? { catalogPromptHint: input } : input;
  const bodySection = buildBodySection(opts.groom, opts.bride);

  return [
    'Compose a wedding portrait using THREE input images:',
    '- Image 1 = Groom face reference. Use this exact face for the groom in the scene.',
    '- Image 2 = Bride face reference. Use this exact face for the bride in the scene.',
    "- Image 3 = Composition reference. Replicate this image's pose, framing, camera angle, depth of field, background, outfits, and overall lighting setup.",
    '',
    `Scene context: ${opts.catalogPromptHint}`,
    '',
    'CRITICAL FACE FIDELITY:',
    "- Reproduce the groom's face from Image 1 (eye shape, nose bridge, jawline, skin tone/texture, hair style/color, expression) with high fidelity",
    "- Reproduce the bride's face from Image 2 the same way",
    '- Do NOT blend the two faces. Assign Image 1 face → groom position in Image 3, Image 2 face → bride position',
    '',
    'COMPOSITION (from Image 3 — replicate exactly):',
    '- Pose, body positions, gestures, hand positions',
    '- Camera angle, framing, depth of field, lens character',
    '- Background, environment, outfits, props',
    ...bodySection,
    '',
    'NATURAL INTEGRATION:',
    "- Re-light the swapped faces to match Image 3's primary light direction, color temperature, and softness",
    '- Re-shade hair highlights and skin tones for consistency with the scene',
    '- Soft natural edges where faces meet hair/clothing — no sharp cutout look',
    '- Apply uniform color grading across the whole frame as if shot on the same camera',
    ...NEGATIVES,
    '',
    'Style: Professional wedding photography, photorealistic, cinematic.',
  ].join('\n');
}

/**
 * (C) 앵커 후보 생성 — 카탈로그 reference 없음.
 *   * 셀카 모드: image_urls = [신랑얼굴, 신부얼굴] (총 2장)
 *   * 커플 모드: image_urls = [커플사진] (총 1장)
 *
 * 카탈로그 단계 reference 로 재사용할 깨끗한 베이스라인 컷을 만든다.
 * baselineSceneHint 에 ANCHOR_BASELINE + framingHint 를 합쳐 전달.
 */
/**
 * 앵커 전용 NATURAL INTEGRATION 섹션 — half-body / full-body 처럼 신체가
 * 많이 보이는 framing 에서 자주 발생하는 두 가지 실패 모드를 적극 차단:
 *   1) 머리 비대증 — face fidelity 강조 때문에 모델이 얼굴을 zoom 해서 그림
 *   2) paste-in 룩  — 인물·배경이 따로 그려진 합성처럼 보임
 * NEGATIVES 와 별도로 양성 instruction 으로 한 번 더 강조.
 */
const ANCHOR_INTEGRATION = [
  '',
  'ANATOMICAL PROPORTIONS — critical for half-body, three-quarter, and full-body framings:',
  '- Head height is roughly 1/7 to 1/8 of total body height (natural adult ratio). Shoulders about 2x head width.',
  '- DO NOT enlarge, zoom into, or up-scale the face when the target framing is anything other than a tight chest-up close-up. The face is the IDENTITY reference, NOT the focal scale.',
  '- Neck-to-shoulder transition must be smooth and realistic — no oversized head perched on a smaller body, no shrunken torso.',
  '- Maintain the natural face size for the camera distance implied by the framing (50–85mm portrait lens for half-body, 35–50mm for full-body).',
  '',
  'NATURAL INTEGRATION — top priority for half-body and full-body framings:',
  '- Subjects MUST look photographed inside the scene by a single physical camera — not pasted on top of it.',
  '- Apply uniform studio lighting, a single consistent color grade, identical micro-grain, identical contrast curve, and identical white balance across subjects and background. There is one camera, one exposure.',
  '- Re-light hair, skin, and clothing so the light direction and softness match the backdrop softboxes.',
  '- Add a soft light wrap (rim light) on shoulders, hair edges, and the bouquet so silhouettes blend with the backdrop.',
  '- Allow soft natural imperfection at the edges of hair and clothing — flyaway strands, fabric falloff, light scatter — instead of perfectly clean cutout edges.',
  '- A subtle environmental color cast from the backdrop bounces softly onto skin and clothing edges so subjects belong in the light.',
  '- For half-body or longer: add a subtle directional shadow on the backdrop behind the couple, matching the softbox direction.',
  '- For full-body: add a soft ambient-occlusion contact shadow where shoes meet the polished floor, and a slight floor reflection beneath them. The dress hem should rest on the floor, never float.',
  '- Edges where hair, clothing, the bouquet, or the dress veil meet the background must be soft and natural — no sharp masks, no halos, no color fringing.',
  '- Match the depth of field of the subjects with the background falloff; no mismatched sharpness.',
];

export function buildAnchorPromptSelfies(
  baselineSceneHint: string,
  body?: { groom?: BodyMetrics; bride?: BodyMetrics },
): string {
  const bodySection = buildBodySection(body?.groom, body?.bride);
  return [
    'Compose a clean wedding anchor portrait using TWO input images:',
    '- Image 1 = Groom face reference. Use this exact face for the groom.',
    '- Image 2 = Bride face reference. Use this exact face for the bride.',
    '',
    `Scene & framing: ${baselineSceneHint}`,
    '',
    'IDENTITY FIDELITY (match identity, not scale):',
    "- Match the groom's identity from Image 1 (eye shape, nose bridge, jawline, skin tone/texture, hair style/color) precisely — but render the face at the anatomically correct size for the chosen framing. Identity, NOT scale.",
    "- Match the bride's identity from Image 2 the same way.",
    '- Do NOT blend the two faces. Assign Image 1 face → groom, Image 2 face → bride.',
    '- Do NOT enlarge or up-scale the face in order to make the identity more obvious — preserve natural head-to-body proportions.',
    ...bodySection,
    ...ANCHOR_INTEGRATION,
    ...NEGATIVES,
    '',
    'Style: Professional wedding photography, photorealistic, cinematic. Faces are sharp but rendered at natural anatomical size.',
  ].join('\n');
}

export function buildAnchorPromptCouple(
  baselineSceneHint: string,
  body?: { groom?: BodyMetrics; bride?: BodyMetrics },
): string {
  const bodySection = buildBodySection(body?.groom, body?.bride);
  return [
    'Compose a clean wedding anchor portrait using ONE input image:',
    '- Image 1 = Couple photo. PRESERVE the two people exactly — faces, identities, body shapes, and their natural way of standing/leaning toward each other.',
    '',
    `Scene & framing: ${baselineSceneHint}`,
    '',
    'IDENTITY & POSE FIDELITY (match identity, not scale):',
    '- Match the faces from Image 1 precisely — but render them at the anatomically correct size for the chosen framing. Identity, NOT scale.',
    "- Replace casual / everyday outfits with the wedding attire specified in the scene, but keep the couple's natural pose, body proportions, and interaction.",
    '- Keep camera angle and framing close to the requested anchor framing above.',
    '- Do NOT enlarge or up-scale the faces to emphasize identity — preserve natural head-to-body proportions implied by the framing.',
    ...bodySection,
    ...ANCHOR_INTEGRATION,
    ...NEGATIVES,
    '',
    'Style: Professional wedding photography, photorealistic, cinematic. Faces are sharp but rendered at natural anatomical size.',
  ].join('\n');
}

/**
 * (D) 앵커 기반 카탈로그 생성 — 앵커 1장 + 카탈로그 마스터샘플 (image_urls 총 2장)
 *
 * 앵커가 이미 얼굴/체형/스타일을 안정화시켜 두었으므로, 카탈로그 생성 시에는
 * 두 얼굴을 다시 블렌딩할 필요 없이 앵커 1장을 정체성 reference 로 쓰고
 * 카탈로그 마스터샘플로 새 scene 을 입힌다. 셀카 2장 합성 대비:
 *   * face fidelity 가 훨씬 안정적 (single-face reference)
 *   * 50컷 사이의 정체성 일관성 보장
 *   * 비용 동일 (image_urls 길이만 다름)
 */
export function buildAnchoredCatalogPrompt(input: SnapPromptInput | string): string {
  const opts: SnapPromptInput =
    typeof input === 'string' ? { catalogPromptHint: input } : input;
  const bodySection = buildBodySection(opts.groom, opts.bride);

  return [
    'Compose a wedding portrait using TWO input images:',
    "- Image 1 = Anchor portrait of the same couple. This is the canonical identity reference — preserve both faces, hair, and body proportions exactly as in this image.",
    "- Image 2 = Composition reference. Take the pose, framing, camera angle, depth of field, background, outfits, and overall lighting setup from this image.",
    '',
    `Scene context: ${opts.catalogPromptHint}`,
    '',
    'FRAMING MISMATCH HANDLING (very important):',
    "- Image 1 (anchor) may be cropped differently from Image 2 (target framing) — e.g. anchor is a close-up while target is a full-body shot, or vice versa.",
    "- Use Image 1 as the canonical identity/body reference and RE-RENDER the couple at whatever scale and framing Image 2 demands. Crop, extend, or zoom as needed.",
    "- Face, hair, skin, and body proportion details from Image 1 must persist regardless of the framing change.",
    "- If Image 1 is a close-up and Image 2 is full-body, extrapolate the body below the anchor crop consistent with the body guide below (height/weight) and the anchor's visible shoulders/neck.",
    "- If Image 1 is full-body and Image 2 is a close-up, scale up the face from Image 1 while preserving sharpness and identity — do not let the face become soft or generic.",
    '',
    'IDENTITY FIDELITY (from Image 1 — strict):',
    '- Faces of both groom and bride must match Image 1 with high fidelity (eye shape, nose bridge, jawline, skin tone/texture, hair style/color).',
    '- Body proportions and silhouettes should remain consistent with Image 1.',
    '- Do NOT introduce people who are not in Image 1.',
    '',
    'COMPOSITION (from Image 2 — replicate):',
    '- Pose, body positions, gestures, hand positions',
    '- Camera angle, framing, depth of field, lens character',
    '- Background, environment, outfits, props',
    ...bodySection,
    '',
    'NATURAL INTEGRATION:',
    "- Re-light the couple to match Image 2's primary light direction, color temperature, and softness",
    '- Soft natural edges where faces meet hair/clothing — no sharp cutout look',
    '- Apply uniform color grading across the whole frame as if shot on the same camera',
    ...NEGATIVES,
    '',
    'Style: Professional wedding photography, photorealistic, cinematic.',
  ].join('\n');
}

/**
 * (B) 커플 사진 1장 + 카탈로그 마스터샘플 (image_urls 총 2장)
 *
 * 사용자 커플 사진의 포즈/구도/상호작용/체형은 그대로 두고, 카탈로그의 의상·
 * 배경·조명 톤만 입힌다. 셀카 합성보다 정체성 일관성과 신체 비율 사실성이
 * 강해, 좋은 커플 사진을 가진 사용자에게 권장되는 경로.
 */
export function buildCouplePhotoSnapPrompt(input: SnapPromptInput | string): string {
  const opts: SnapPromptInput =
    typeof input === 'string' ? { catalogPromptHint: input } : input;
  const bodySection = buildBodySection(opts.groom, opts.bride);

  return [
    'Compose a wedding portrait using TWO input images:',
    "- Image 1 = Couple photo. PRESERVE the two people exactly — faces, identities, body shapes, poses, hand positions, relative scale, eye lines, and their interaction with each other. This is the anchor.",
    "- Image 2 = Style reference. Take outfits, background, environment, and overall lighting tone from this image.",
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
    '',
    'NATURAL INTEGRATION:',
    '- Re-light the people to match the new scene; do not paste them in flat',
    '- Soft natural edges where hair / clothing meet the background — no cutout look',
    '- Uniform color grading as if shot on the same camera in the new scene',
    ...NEGATIVES,
    '',
    'Style: Professional wedding photography, photorealistic, cinematic.',
  ].join('\n');
}
