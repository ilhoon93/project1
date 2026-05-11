/**
 * 앵커 후보 4장 — 다양한 framing 의 베이스라인 스튜디오 컷.
 *
 * 모두 같은 스튜디오/의상 baseline 을 공유하고 프레이밍·각도·표정만 다르게
 * 만들어, 사용자가 "내 얼굴이 가장 잘 살아나는 컷" 을 고를 수 있도록 분산을
 * 의도적으로 키운다. 동일 prompt 의 4 variation 으로 뽑으면 비슷비슷해
 * 보여서 선택 가치가 떨어진다는 점을 반영.
 *
 * 카탈로그와 달리 앵커는 high quality 로 한 번만 만들어 평생 reference 로
 * 재사용되므로 비용 정당화가 된다 (앵커 1장 ≈ $0.13).
 */

export interface AnchorTemplate {
  id: 'closeup' | 'halfbody' | 'fullbody' | 'threequarter';
  label: string;
  /** 카탈로그 promptHint 와 같은 위치에 들어가는 scene/framing 컨텍스트. */
  framingHint: string;
}

/**
 * 모든 앵커 템플릿이 공유하는 베이스라인 — 깨끗한 스튜디오, 클래식 웨딩 의상,
 * 균등 조명, 자연스러운 미소. 사용자별 변동은 framingHint 로만 준다.
 *
 * 표정은 Duchenne 미소 (눈가 주름 + 입꼬리 살짝 올림) 를 명시해 "포즈 사진"
 * 느낌이 아닌 진짜 행복해 보이는 표정을 유도한다. 조명/그림자 통합 표현도
 * 베이스라인에 미리 넣어 framingHint 별로 중복 없이 일관성 유지.
 */
export const ANCHOR_BASELINE =
  'Clean indoor studio with seamless neutral gray backdrop, two-source softbox lighting from front-left and front-right with a subtle floor pickup creating a soft natural shadow under the subjects, polished floor that gently reflects the lighting, editorial wedding portrait atmosphere. Groom: black peak-lapel tuxedo with white shirt and black bow tie. Bride: ivory A-line wedding dress with off-shoulder neckline and lace bodice. Expressions: both share a genuine, relaxed smile — eyes slightly crinkled (Duchenne smile), corners of the mouth gently lifted, soft natural happiness, never staged or forced. Lighting wraps softly around shoulders and hair so the subjects feel integrated with the backdrop — no cut-out or paste-in look.';

export const ANCHOR_TEMPLATES: AnchorTemplate[] = [
  {
    id: 'closeup',
    label: '클로즈업 정면',
    framingHint:
      'Tight chest-up close-up portrait, both faces clearly featured, frontal camera angle at eye level, shallow depth of field with creamy bokeh on the backdrop. Faces fill ~60% of the frame. Soft warm catchlights in both pairs of eyes.',
  },
  {
    id: 'halfbody',
    label: '반신 사선',
    framingHint:
      'Waist-up half-body portrait, three-quarter (~30°) camera angle, both subjects gently leaning toward each other with a natural soft smile. Hands visible naturally — bride may hold a small bouquet, groom\'s hand resting at his side or gently on the bride\'s back. Soft rim light wraps around the shoulder closest to camera so the silhouette blends into the backdrop — explicitly NO sharp outline, NO cutout halo, NO color fringing along shoulders, hair, or the bouquet edge.',
  },
  {
    id: 'fullbody',
    label: '전신 정면',
    framingHint:
      'Full-body standing portrait, frontal camera at eye level, both subjects facing the camera and standing naturally close together with a warm relaxed smile. Full attire visible from head to floor including shoes and the dress hem. Crucial integration cues: a subtle ambient-occlusion contact shadow where shoes meet the floor, a soft directional shadow on the backdrop behind the couple matching the softbox direction, dress hem gently touching the floor (not floating). Subjects must look planted in the scene — NEVER like a cut-out paste-in on a flat backdrop. Generous headroom and floor space.',
  },
  {
    id: 'threequarter',
    label: '3/4 미소',
    framingHint:
      'Three-quarter length portrait (knee-up), slight side angle (~20°), bride angled slightly toward groom with a soft natural smile, groom looking warmly at the bride or at the camera with an easy grin. Relaxed posture, hands and waist naturally placed.',
  },
];

export const isAnchorTemplateId = (v: string): v is AnchorTemplate['id'] =>
  ANCHOR_TEMPLATES.some((t) => t.id === v);
