import type { ColorTheme, FontKey, PetalType } from '@/lib/theme';
import type { InvitationContent } from '@/types/invitation';

/**
 * 에디터 "추천으로 시작하기 → 추천 디자인" 항목.
 *
 * 소스는 운영자가 admin "알림장 샘플 설정"(getHomeSamplesConfig)에서 세팅한 디자인
 * 미리보기 샘플이다. 에디터 서버 페이지에서 그 샘플을 읽어 이 형태로 매핑해 클라이언트
 * (DesignPreset)로 내려준다 → /designs 미리보기와 에디터 추천 디자인이 항상 일치한다.
 *
 * main 에는 표지 디자인(레이아웃·poster/frame/illustration/text 디자인)과 함께 샘플
 * 인사말(main.greeting)도 담긴다. heroImageUrl 은 샘플 카탈로그 사진의 절대 URL로,
 * 새 알림장에서 "분위기 미리보기"용 메인사진으로 로딩한다(사용자가 교체 전제).
 */
export interface EditorSampleDesign {
  id: string;
  name: string;
  layoutLabel: string;
  colorTheme: ColorTheme;
  petalType: PetalType;
  font: FontKey;
  main: InvitationContent['main'];
  /** 샘플 카탈로그 메인사진의 절대 URL (없으면 null). 새 알림장 분위기 미리보기용. */
  heroImageUrl: string | null;
  groomName: string;
  brideName: string;
  weddingDate: string | null;
}
