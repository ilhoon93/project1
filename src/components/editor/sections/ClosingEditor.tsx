'use client';

import { useEditorStore } from '@/stores/editor';
import { SectionEditor } from '../SectionEditor';
import { PresetTextArea } from '../PresetTextArea';
import { CLOSING_PRESETS } from '@/lib/presets';

export function ClosingEditor() {
  const closing = useEditorStore((s) => s.content?.closing);
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
    </SectionEditor>
  );
}
