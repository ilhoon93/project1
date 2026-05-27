'use client';

import Link from 'next/link';
import { AIImageGenerator } from './AIImageGenerator';

/**
 * Standalone tab for the AI concept-image generator.
 *
 *   - 사진 업로드 + 컨셉 선택 → 생성 → 결과 미리보기 + 다운로드
 *   - 메인 사진 표시/교체는 하지 않는다 (요구사항)
 *   - 계정(네이버 ID) 당 1회 무료 — 서버에서 ai_image_usage 로 강제
 *   - 수십 가지 컷을 만들 수 있는 본격 상품인 AI 웨딩스냅 생성 페이지로 넘어가는
 *     진입 버튼을 한 줄 두어, 1회 무료 체험 후 자연스럽게 본 상품으로 안내한다.
 */
export function AIPanel() {
  return (
    <section className="overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm">
      <header className="flex flex-col gap-1 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">AI 웨딩 이미지 (계정당 1회 무료)</h2>
        <p className="text-xs text-muted-foreground">
          인물 사진을 업로드하고 컨셉을 선택하면 배경·의상이 웨딩 스타일로 바뀐 결과를
          만들어 드립니다. 생성된 이미지는 다운로드 받아 자유롭게 사용하세요.
        </p>
      </header>

      <div className="flex flex-col gap-3 px-4 py-4">
        <Link
          href="/wedding-snap/create"
          className="flex items-center justify-between gap-3 rounded-md border border-[#D4C5B0] bg-[#FAF7F2] px-3 py-2.5 text-xs transition-colors hover:bg-[#F2EAD8]"
        >
          <span className="flex flex-col">
            <span className="font-medium text-[#3D2E1F]">
              더 많은 컷이 필요하다면? · AI 웨딩스냅
            </span>
            <span className="text-[11px] text-[#8B7355]">
              앵커 무료 + 카탈로그 컷을 우리 얼굴로 합성
            </span>
          </span>
          <span aria-hidden className="text-[#8B7355]">→</span>
        </Link>

        <AIImageGenerator />
      </div>
    </section>
  );
}
