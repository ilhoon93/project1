import type { ColorTheme, FontKey, PetalType } from '@/lib/theme';
import type { FrameVariant, InvitationContent } from '@/types/invitation';

/**
 * 에디터 "메인디자인 빠른설정" 프리셋 — 표지 레이아웃 + 색상/폰트/배경효과를 한 번에
 * 적용한다. /designs 카탈로그 시드(sample-invitations SEEDS)와 같은 룩을 공유하되,
 * 에디터 클라이언트가 서버 전용 마케팅 모듈을 번들하지 않도록 디자인 필드만 분리한다.
 *
 * 적용 시 이름·사진·표지 문구 등 사용자 데이터는 건드리지 않고 theme(색/꽃/폰트)과
 * main.layout(표지 형태)만 바꾼다.
 */
export interface DesignPresetItem {
  id: string;
  name: string;
  layoutLabel: string;
  colorTheme: ColorTheme;
  petalType: PetalType;
  font: FontKey;
  layout: InvitationContent['main']['layout'];
  // 액자(frame) 레이아웃은 variant(폴라로이드·아치·클래식…)에 따라 셰이프가 크게
  // 달라진다. 지정하지 않으면 스키마 기본값(polaroid)이라 모든 액자가 폴라로이드로
  // 보이므로, 액자 프리셋마다 예시와 같은 variant 를 명시해 준다.
  frameVariant?: FrameVariant;
}

export const DESIGN_PRESETS: readonly DesignPresetItem[] = [
  { id: 'cream-poster', name: '크림 포스터', layoutLabel: '풀이미지 · 벚꽃', colorTheme: 'cream', petalType: 'sakura', font: 'gowun', layout: 'poster' },
  { id: 'blush-frame', name: '블러쉬 프레임', layoutLabel: '액자 · 꽃잎', colorTheme: 'blush', petalType: 'flower', font: 'songMyung', layout: 'frame', frameVariant: 'classic' },
  { id: 'forest-illust', name: '포레스트 보태니컬', layoutLabel: '일러스트 · 잎', colorTheme: 'forest', petalType: 'leaf', font: 'jeju', layout: 'illustration' },
  { id: 'midnight-cinematic', name: '미드나잇 시네마틱', layoutLabel: '풀이미지 · 별빛', colorTheme: 'midnight', petalType: 'starlight', font: 'pretendard', layout: 'poster' },
  { id: 'navy-classic', name: '네이비 클래식', layoutLabel: '풀이미지 · 별', colorTheme: 'navy', petalType: 'star', font: 'gmarket', layout: 'poster' },
  { id: 'letter-minimal', name: '편지지 미니멀', layoutLabel: '텍스트 · 무효과', colorTheme: 'letterPaper', petalType: 'none', font: 'songMyung', layout: 'text' },
  { id: 'lavender-starlight', name: '라벤더 오로라', layoutLabel: '액자 · 별빛', colorTheme: 'lavender', petalType: 'starlight', font: 'gowun', layout: 'frame', frameVariant: 'arch' },
  { id: 'champagne-gold', name: '샴페인 골드', layoutLabel: '풀이미지 · 보케', colorTheme: 'champagne', petalType: 'bokeh', font: 'songMyung', layout: 'poster' },
  { id: 'rose-romantic', name: '더스티 로즈', layoutLabel: '액자 · 흰 꽃잎', colorTheme: 'rose', petalType: 'whitePetal', font: 'gowun', layout: 'frame', frameVariant: 'polaroid' },
  { id: 'sky-poster', name: '스카이 포스터', layoutLabel: '풀이미지 · 하트', colorTheme: 'sky', petalType: 'heart', font: 'gowun', layout: 'poster' },
  { id: 'pearl-minimal', name: '펄 미니멀', layoutLabel: '텍스트 · 무효과', colorTheme: 'pearl', petalType: 'none', font: 'songMyung', layout: 'text' },
  { id: 'charcoal-modern', name: '차콜 모던', layoutLabel: '일러스트 · 잎', colorTheme: 'charcoal', petalType: 'leaf', font: 'pretendard', layout: 'illustration' },
];
