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
