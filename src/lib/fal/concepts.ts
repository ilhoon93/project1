/**
 * AI 메인 이미지 — 컨셉 카탈로그 + 마스터 프롬프트 빌더
 *
 * 사용자 요청에 맞춰 [배경] / [신랑] / [신부] 변수만 컨셉별로 갈아 끼우고
 * 나머지(마스터 프롬프트) 는 모든 컨셉이 공유한다. 얼굴/포즈/조명 보존
 * 지시문이 마스터에 들어가 있어 결과 품질이 일관된다.
 */

interface ConceptVars {
  background: string;
  groom: string;
  bride: string;
}

export const AI_CONCEPTS = {
  studio: {
    label: '실내 스튜디오',
    icon: '🎬',
    vars: {
      background:
        'Professional indoor studio with seamless neutral gray backdrop, softbox lighting from both sides, clean polished floor, subtle gradient background, editorial portrait atmosphere, controlled lighting',
      groom:
        'Groom in black peak-lapel tuxedo (matte wool jacket, satin lapels, crisp white dress shirt, black bow tie)',
      bride:
        'Bride in ivory A-line wedding dress (off-shoulder neckline, lace bodice, flowing chiffon skirt, subtle beading)',
    },
  },
  meadow: {
    label: '푸른 하늘과 초원',
    icon: '🌤️',
    vars: {
      background:
        'Vast open meadow under bright blue sky, soft green grass with wildflowers, gentle breeze, distant rolling hills, airy natural daylight, spacious outdoor romance, fresh morning light',
      groom:
        'Groom in navy blue tuxedo with clean formal tailoring, crisp white shirt, subtle bow tie',
      bride:
        'Bride in ivory A-line wedding dress with soft chiffon movement, light lace details, romantic flowing silhouette',
    },
  },
  hanok: {
    label: '한옥 예식장',
    icon: '🏯',
    vars: {
      background:
        'Traditional Korean hanok courtyard with cherry blossoms gently falling, dappled sunlight through trees, stone paths, wooden architecture, pond with koi fish, elegant wedding venue atmosphere, warm cultural lighting',
      groom:
        'Groom in black peak-lapel tuxedo (matte wool jacket, satin lapels, crisp white dress shirt, black bow tie)',
      bride:
        'Bride in ivory A-line wedding dress (off-shoulder neckline, lace bodice, flowing chiffon skirt, subtle beading)',
    },
  },
  city: {
    label: '도심 속',
    icon: '🌆',
    vars: {
      background:
        'Modern city street at golden hour, glass skyscrapers reflecting sunset, wet pavement after rain, bridge lights in background, urban cinematic atmosphere, elegant metropolitan wedding setting',
      groom:
        'Groom in black peak-lapel tuxedo with sharp tailoring, crisp white dress shirt, black bow tie',
      bride:
        'Bride in ivory A-line wedding dress with sleek silhouette, refined fabric texture, sophisticated urban style',
    },
  },
  beach: {
    label: '바닷가',
    icon: '🌊',
    vars: {
      background:
        'Quiet beach wedding at golden sunset, soft waves lapping shore, seashell-strewn sand, distant horizon, sea breeze, warm tropical lighting, romantic coastal atmosphere',
      groom:
        'Groom in black tuxedo tailored for beach formal, crisp white shirt, loose black bow tie',
      bride:
        'Bride in ivory A-line wedding dress with lightweight chiffon, soft lace details, natural flowing movement for sea breeze',
    },
  },
} as const satisfies Record<string, { label: string; icon: string; vars: ConceptVars }>;

export type ConceptKey = keyof typeof AI_CONCEPTS;
export const CONCEPT_KEYS = Object.keys(AI_CONCEPTS) as ConceptKey[];
export const isConceptKey = (v: string): v is ConceptKey => Object.hasOwn(AI_CONCEPTS, v);

/**
 * 마스터 인페인팅 프롬프트 — 얼굴/포즈/조명 보존 지시문이 들어 있어
 * 모든 컨셉에서 공통으로 사용한다. CHANGE ONLY 부분만 컨셉별로 치환.
 */
export function buildConceptPrompt(key: ConceptKey): string {
  const v = AI_CONCEPTS[key].vars;
  return [
    'Edit the attached photo using photorealistic inpainting.',
    '',
    'CHANGE ONLY:',
    `- Background → ${v.background}`,
    `- Groom clothing → ${v.groom}`,
    `- Bride clothing → ${v.bride}`,
    '',
    'PRESERVE EXACTLY (pixel-perfect fidelity):',
    '- Both faces: exact facial features, eye shape, nose bridge, jawline, skin tone/texture, freckles/moles',
    '- Facial expressions, gaze direction, head tilt',
    '- Hairstyle, hair length, color, parting',
    '- Body proportions, skeletal structure, pose, hand positions',
    '- Camera angle, lens distortion, framing, depth of field',
    '',
    'ADAPT lighting to the new scene (do NOT preserve original lighting):',
    "- Re-light faces and skin to match the new background's primary light direction, color temperature, and softness (soft/hard quality)",
    '- Re-shade clothing folds and hair highlights to fit the new ambient light',
    '- Re-grade overall color so subjects and scene look shot on the same camera in the same conditions',
    '- Use original lighting only as a starting reference, not a constraint',
    '',
    'TECHNICAL REQUIREMENTS:',
    '- Clothing fabric must drape naturally over preserved body pose (no stiffness)',
    '- Seamless edge integration, matching fabric highlights/reflections to original light source',
    '- Maintain original image resolution, aspect ratio, photographic quality',
    '- No added accessories, jewelry, text, logos, watermarks, or artifacts',
    '',
    'Style: Professional wedding photography, cinematic lighting.',
  ].join('\n');
}
