'use client';

import { useEditorStore } from '@/stores/editor';
import { AIImageGenerator } from './AIImageGenerator';

/**
 * Standalone tab for the free AI hero-image generator.
 *
 * The generator itself is one-shot per invitation: the API checks
 * `content.main.aiUsed` and the local store's flag controls the UI lock so
 * we don't even attempt a request after a previous run.
 */
export function AIPanel() {
  const main = useEditorStore((s) => s.content?.main);
  const invitationId = useEditorStore((s) => s.invitationId);
  if (!main || !invitationId) return null;

  const aiUsed = !!main.aiUsed;

  return (
    <section className="overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm">
      <header className="flex flex-col gap-1 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">AI 메인 이미지 (무료 1회)</h2>
        <p className="text-xs text-muted-foreground">
          인물 사진을 올리면 배경과 의상이 웨딩 스타일로 바뀝니다. 알림장 1개당 1회만
          무료로 제공됩니다.
        </p>
      </header>

      <div className="px-4 py-4">
        {main.heroImage && (
          <div className="mb-4 flex flex-col gap-2 rounded-md border bg-muted/30 p-3">
            <span className="text-xs font-medium text-muted-foreground">
              현재 메인 이미지
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={main.heroImage}
              alt="현재 메인"
              className="aspect-[3/4] w-full max-w-[200px] rounded object-cover"
            />
            {aiUsed ? (
              <p className="text-xs text-muted-foreground">
                AI로 생성된 이미지입니다.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                직접 업로드한 이미지입니다. AI 생성을 진행하면 이 이미지로 교체됩니다.
              </p>
            )}
          </div>
        )}

        <AIImageGenerator invitationId={invitationId} alreadyUsed={aiUsed} />
      </div>
    </section>
  );
}
