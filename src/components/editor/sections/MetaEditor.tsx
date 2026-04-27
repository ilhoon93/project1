'use client';

import { useEditorStore } from '@/stores/editor';
import { SectionEditor } from '../SectionEditor';
import { TextField } from '../form-fields';

export function MetaEditor() {
  const meta = useEditorStore((s) => s.meta);
  const setMeta = useEditorStore((s) => s.setMeta);
  if (!meta) return null;

  return (
    <SectionEditor
      title="기본 정보"
      description="신랑신부 이름과 결혼식 날짜"
      defaultOpen
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="신랑 이름"
            value={meta.groomName}
            maxLength={20}
            onChange={(e) => setMeta({ groomName: e.target.value })}
          />
          <TextField
            label="신부 이름"
            value={meta.brideName}
            maxLength={20}
            onChange={(e) => setMeta({ brideName: e.target.value })}
          />
        </div>
        <TextField
          label="결혼식 날짜"
          type="date"
          value={meta.weddingDate ?? ''}
          onChange={(e) => setMeta({ weddingDate: e.target.value || null })}
          hint="발행 후 30일이 만료일이 됩니다"
        />
      </div>
    </SectionEditor>
  );
}
