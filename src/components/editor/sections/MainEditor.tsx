'use client';

import { useEditorStore } from '@/stores/editor';
import { SectionEditor } from '../SectionEditor';
import { TextAreaField } from '../form-fields';
import { AIImageGenerator } from '../AIImageGenerator';

export function MainEditor() {
  const main = useEditorStore((s) => s.content?.main);
  const invitationId = useEditorStore((s) => s.invitationId);
  const patch = useEditorStore((s) => s.patchSection);
  if (!main || !invitationId) return null;

  return (
    <SectionEditor title="메인 화면" description="첫 슬라이드의 메인 이미지와 인사말">
      <div className="flex flex-col gap-4">
        {main.heroImage ? (
          <div className="flex flex-col gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={main.heroImage}
              alt="메인 이미지 미리보기"
              className="aspect-[3/4] w-full rounded-md object-cover"
            />
            <p className="text-xs text-muted-foreground">
              메인 이미지가 설정되었습니다. 추가 이미지는 결제 후 사용 가능합니다.
            </p>
          </div>
        ) : (
          <AIImageGenerator invitationId={invitationId} alreadyUsed={false} />
        )}

        <TextAreaField
          label="인사말"
          value={main.greeting}
          maxLength={500}
          rows={4}
          placeholder="저희 두 사람의 약속을 함께 축복해주세요"
          onChange={(e) => patch('main', { ...main, greeting: e.target.value })}
        />
      </div>
    </SectionEditor>
  );
}
