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
 * 균등 조명. 사용자별 변동은 framingHint 로만 준다.
 */
export const ANCHOR_BASELINE =
  'Clean indoor studio with seamless neutral gray backdrop, two-source softbox lighting from front-left and front-right, polished floor, editorial wedding portrait atmosphere. Groom: black peak-lapel tuxedo with white shirt and black bow tie. Bride: ivory A-line wedding dress with off-shoulder neckline and lace bodice. Soft natural expression, gentle smile.';

export const ANCHOR_TEMPLATES: AnchorTemplate[] = [
  {
    id: 'closeup',
    label: '클로즈업 정면',
    framingHint:
      'Tight chest-up close-up portrait, both faces clearly featured, frontal camera angle, shallow depth of field with creamy bokeh. Faces fill ~60% of the frame.',
  },
  {
    id: 'halfbody',
    label: '반신 사선',
    framingHint:
      'Waist-up half-body portrait, three-quarter (~30°) camera angle, both subjects gently leaning toward each other. Hands visible naturally — bride may hold a small bouquet.',
  },
  {
    id: 'fullbody',
    label: '전신 정면',
    framingHint:
      'Full-body standing portrait, frontal camera at eye level, both subjects facing the camera, full attire visible from head to floor including shoes and dress hem. Generous headroom and floor space.',
  },
  {
    id: 'threequarter',
    label: '3/4 미소',
    framingHint:
      'Three-quarter length portrait (knee-up), slight side angle (~20°), bride angled slightly toward groom with a soft smile, groom looking warmly at bride or at camera. Natural relaxed posture.',
  },
];

export const isAnchorTemplateId = (v: string): v is AnchorTemplate['id'] =>
  ANCHOR_TEMPLATES.some((t) => t.id === v);
