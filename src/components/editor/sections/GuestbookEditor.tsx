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
      description="하객 메시지는 신랑신부에게만 전달됩니다"
      toggle={{
        enabled: guestbook.enabled,
        onChange: (next) => patch('guestbook', { ...guestbook, enabled: next }),
      }}
    >
      <div className="flex flex-col gap-3">
        <TextAreaField
          label="신랑신부의 인사말 (모두에게 보입니다)"
          value={guestbook.coupleMessage}
          maxLength={300}
          rows={3}
          placeholder="와주신 모든 분들께 감사한 마음을 전합니다"
          onChange={(e) =>
            patch('guestbook', { ...guestbook, coupleMessage: e.target.value })
          }
        />
        <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          하객이 남긴 메시지는 두 분에게만 전달되며, 다른 하객에게는 노출되지
          않습니다. 받은 메시지는 곧 추가될 관리 페이지에서 확인할 수 있어요.
        </p>
      </div>
    </SectionEditor>
  );
}
