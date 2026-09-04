'use client';

import { ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { InvitationPreview } from '@/components/marketing/InvitationPreview';
import type { SampleDesign } from '@/lib/marketing/sample-invitations';

/**
 * 관리자 샘플 편집용 하단 고정 실시간 미리보기 시트 — 실제 모바일 에디터
 * (EditorMobilePreview)와 동일한 방식으로 화면 하단에 `fixed` 로 붙는다.
 *
 * 핵심: `position: fixed` 라 페이지 스크롤과 무관하게 항상 뷰포트 하단에 있다.
 * (이전 sticky 방식은 관리자 페이지의 스크롤 컨테이너 구조 때문에 스크롤 시 같이
 *  올라가 버렸다.) 편집 항목을 스크롤하며 값을 바꿔도 미리보기가 계속 보인다.
 *
 * design 은 현재 편집 중인 샘플로 매 렌더 rebuild 되므로, 값을 바꾸면 즉시 반영된다.
 * 접힘 시엔 핸들 바만 남겨 화면을 가리지 않는다.
 */
export function SampleLivePreviewSheet({
  design,
  open,
  onOpenChange,
}: {
  design: SampleDesign;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-0 sm:px-4">
      <div
        className={`flex w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-b-0 border-[#E8DCC9] bg-[#FAF7F2] shadow-[0_-8px_30px_rgba(31,27,23,0.18)] transition-[height] duration-300 ease-out ${
          open ? 'h-[64vh]' : 'h-[46px]'
        }`}
      >
        {/* 핸들 바 — 탭해서 펼치기/접기 */}
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
          aria-label={open ? '미리보기 접기' : '미리보기 펼치기'}
          className="flex shrink-0 items-center justify-between gap-2 px-4"
          style={{ height: 46 }}
        >
          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#3D2E1F]">
            <Eye size={15} />
            실시간 미리보기
          </span>
          <span className="inline-flex items-center gap-1 text-[12px] text-[#8B7355]">
            {open ? '접기' : '펼쳐서 보며 편집'}
            {open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </span>
        </button>

        {/* 펼침 영역 — 폰 프레임(9:18) 을 시트 높이에 맞춰 가운데 배치. InvitationPreview
            가 컨테이너 폭에 맞춰 실제 디바이스와 동일 비율로 축소 렌더한다. */}
        {open && (
          <div className="relative min-h-0 flex-1 overflow-hidden bg-[#EFE7DB] p-3">
            <div className="mx-auto h-full overflow-hidden rounded-[16px] border-2 border-[#15110E] bg-[#15110E]" style={{ aspectRatio: '9 / 18' }}>
              <InvitationPreview design={design} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
