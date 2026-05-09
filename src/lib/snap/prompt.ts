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
 * 얼굴로 바꾼다. 추가로 카탈로그별 scene 컨텍스트(promptHint) 를 끼워 톤 보강.
 */
export function buildSnapPrompt(catalogPromptHint: string): string {
  return [
    'Compose a wedding portrait using THREE input images:',
    '- Image 1 = Groom face reference. Use this exact face for the groom in the scene.',
    '- Image 2 = Bride face reference. Use this exact face for the bride in the scene.',
    '- Image 3 = Composition reference. Replicate this image\'s pose, framing, camera angle, depth of field, background, outfits, and overall lighting setup.',
    '',
    `Scene context: ${catalogPromptHint}`,
    '',
    'CRITICAL FACE FIDELITY:',
    '- Reproduce the groom\'s face from Image 1 (eye shape, nose bridge, jawline, skin tone/texture, hair style/color, expression) with high fidelity',
    '- Reproduce the bride\'s face from Image 2 the same way',
    '- Do NOT blend the two faces. Assign Image 1 face → groom position in Image 3, Image 2 face → bride position',
    '',
    'COMPOSITION (from Image 3 — replicate exactly):',
    '- Pose, body positions, gestures, hand positions',
    '- Camera angle, framing, depth of field, lens character',
    '- Background, environment, outfits, props',
    '',
    'NATURAL INTEGRATION:',
    '- Re-light the swapped faces to match Image 3\'s primary light direction, color temperature, and softness',
    '- Re-shade hair highlights and skin tones for consistency with the scene',
    '- Soft natural edges where faces meet hair/clothing — no sharp cutout look',
    '- Apply uniform color grading across the whole frame as if shot on the same camera',
    '',
    'Style: Professional wedding photography, photorealistic, cinematic.',
  ].join('\n');
}
