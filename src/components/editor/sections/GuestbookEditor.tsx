'use client';

import { useEditorStore } from '@/stores/editor';
import { SectionEditor } from '../SectionEditor';
import { TextAreaField } from '../form-fields';

export function GuestbookEditor() {
  const guestbook = useEditorStore((s) => s.content?.guestbook);
  const patch = useEditorStore((s) => s.patchSection);
  if (!guestbook) return null;

  return (
    <SectionEditor
      title="방명록"
      description="하객이 메시지를 남길 수 있는 공간"
      toggle={{
        enabled: guestbook.enabled,
        onChange: (next) => patch('guestbook', { ...guestbook, enabled: next }),
      }}
    >
      <TextAreaField
        label="신랑신부 인사말 (선택)"
        value={guestbook.coupleMessage}
        maxLength={300}
        rows={3}
        placeholder="와주신 모든 분들께 감사한 마음을 전합니다"
        onChange={(e) =>
          patch('guestbook', { ...guestbook, coupleMessage: e.target.value })
        }
      />
    </SectionEditor>
  );
}
