'use client';

import { AIImageGenerator } from './AIImageGenerator';

/**
 * Standalone tab for the AI concept-image generator.
 *
 *   - 사진 업로드 + 컨셉 선택 → 생성 → 결과 미리보기 + 다운로드
 *   - 메인 사진 표시/교체는 하지 않는다 (요구사항)
 *   - 계정(네이버 ID) 당 1회 무료 — 서버에서 ai_image_usage 로 강제
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

      <div className="px-4 py-4">
        <AIImageGenerator />
      </div>
    </section>
  );
}
