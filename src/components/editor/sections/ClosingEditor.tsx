'use client';

import { useEditorStore } from '@/stores/editor';
import { SectionEditor } from '../SectionEditor';
import { PresetTextArea } from '../PresetTextArea';
import { CLOSING_PRESETS } from '@/lib/presets';

export function ClosingEditor() {
  const closing = useEditorStore((s) => s.content?.closing);
  const closingShare = useEditorStore((s) => s.content?.closingShare);
  const patch = useEditorStore((s) => s.patchSection);
  if (closing === undefined) return null;

  return (
    <SectionEditor title="마무리 인사" description="마지막 슬라이드에 보일 메시지">
      <PresetTextArea
        label="마무리 메시지"
        value={closing}
        maxLength={300}
        rows={3}
        placeholder="와주셔서 진심으로 감사합니다"
        onChange={(next) => patch('closing', next)}
        presets={CLOSING_PRESETS}
        presetLabel="추천 인사말"
      />

      {/* 공유하기 버튼 — 기본 노출, 끄면 마지막 슬라이드에서 숨김. */}
      <label className="mt-1 flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={closingShare !== false}
          onChange={(e) => patch('closingShare', e.target.checked)}
          className="h-4 w-4 accent-foreground"
        />
        마지막 슬라이드에 &lsquo;공유하기&rsquo; 버튼 표시
      </label>
    </SectionEditor>
  );
}
