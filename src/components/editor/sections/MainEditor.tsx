'use client';

import { useEditorStore } from '@/stores/editor';
import { MAIN_LAYOUTS } from '@/types/invitation';
import { SectionEditor } from '../SectionEditor';
import { TextAreaField } from '../form-fields';
import { ImageUploader } from '../ImageUploader';

const LAYOUT_LABELS: Record<(typeof MAIN_LAYOUTS)[number], { name: string; hint: string }> = {
  poster: { name: '포스터', hint: '풀이미지 배경' },
  polaroid: { name: '폴라로이드', hint: '액자 프레임' },
  illustration: { name: '일러스트', hint: '신랑신부 그림' },
  text: { name: '텍스트', hint: '이미지 없이' },
};

export function MainEditor() {
  const main = useEditorStore((s) => s.content?.main);
  const invitationId = useEditorStore((s) => s.invitationId);
  const patch = useEditorStore((s) => s.patchSection);
  if (!main || !invitationId) return null;

  const layout = main.layout ?? 'poster';
  const showImagePicker = layout !== 'text' && layout !== 'illustration';

  return (
    <SectionEditor title="메인 화면" description="첫 슬라이드의 레이아웃과 인사말">
      <div className="flex flex-col gap-4">
        {/* 레이아웃 선택 */}
        <div className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-foreground">레이아웃</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MAIN_LAYOUTS.map((key) => {
              const selected = layout === key;
              const meta = LAYOUT_LABELS[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => patch('main', { ...main, layout: key })}
                  aria-pressed={selected}
                  className={`flex flex-col items-center gap-1 rounded-md border px-2 py-3 text-xs transition-colors ${
                    selected
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-input bg-background text-foreground hover:bg-muted'
                  }`}
                >
                  <span className="font-medium">{meta.name}</span>
                  <span className={selected ? 'opacity-80' : 'text-muted-foreground'}>
                    {meta.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {showImagePicker && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">메인 사진</span>
            <ImageUploader
              value={main.heroImage ?? null}
              onChange={(url) => patch('main', { ...main, heroImage: url })}
              invitationId={invitationId}
              folder="main"
              previewAspect="aspect-[3/4]"
              label="사진 선택하기"
            />
          </div>
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
