/**
 * 웨딩스냅 멀티-이미지 프롬프트 빌더
 *
 * gpt-image-2/edit 의 image_urls 가 [신랑얼굴, 신부얼굴, 카탈로그_마스터샘플]
 * 3장을 받는 점을 활용해, 각 이미지의 역할을 prompt 로 명시한다.
 *   - Image 1 = 신랑 얼굴 reference (얼굴 일치도)
 *   - Image 2 = 신부 얼굴 reference (얼굴 일치도)
 *   - Image 3 = 포즈/구도/배경/의상/조명 reference (씬 일관성)
 *
 * 모델은 Image 3 의 컴포지션을 그대로 복제하되 두 인물의 얼굴만 Image 1·2 의
 * 얼굴로 바꾼다. 추가로 카탈로그별 scene 컨텍스트(promptHint) + (선택) 키·
 * 몸무게로 추론한 체형 가이드를 끼워 전신 비율을 보강.
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

export function buildSnapPrompt(input: SnapPromptInput | string): string {
  // 하위 호환: 문자열만 받던 옛 시그니처도 그대로 동작.
  const opts: SnapPromptInput =
    typeof input === 'string' ? { catalogPromptHint: input } : input;

  const bodyLines: string[] = [];
  const groomGuide = buildPersonGuide('groom', opts.groom);
  const brideGuide = buildPersonGuide('bride', opts.bride);
  const compare = buildHeightComparison(opts.groom, opts.bride);
  if (groomGuide) bodyLines.push(groomGuide);
  if (brideGuide) bodyLines.push(brideGuide);
  if (compare) bodyLines.push(compare);

  const bodySection =
    bodyLines.length > 0
      ? [
          '',
          'BODY PROPORTIONS (apply when the framing includes the full or half body):',
          ...bodyLines,
          '- Keep faces strictly from Image 1 / Image 2; only the body silhouette and proportions follow the guide above.',
          '- Tailor wedding attire to drape naturally on the described build (no shrink-wrap, no padding mismatch).',
        ]
      : [];

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
    '',
    'Style: Professional wedding photography, photorealistic, cinematic.',
  ].join('\n');
}
