'use client';

import { useEditorStore } from '@/stores/editor';
import { SectionEditor } from '../SectionEditor';
import { TextAreaField } from '../form-fields';

export function StoryEditor() {
  const story = useEditorStore((s) => s.content?.story);
  const patch = useEditorStore((s) => s.patchSection);
  if (!story) return null;

  return (
    <SectionEditor
      title="우리 이야기"
      description="첫 만남, 고백, 프로포즈 — 세 챕터"
      toggle={{
        enabled: story.enabled,
        onChange: (next) => patch('story', { ...story, enabled: next }),
      }}
    >
      <div className="flex flex-col gap-4">
        {story.chapters.map((chapter, i) => (
          <div key={chapter.title} className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-muted-foreground">{chapter.title}</h3>
            <TextAreaField
              label=""
              value={chapter.text}
              maxLength={300}
              rows={3}
              placeholder={placeholder(chapter.title)}
              onChange={(e) => {
                const next = [...story.chapters];
                next[i] = { ...chapter, text: e.target.value };
                patch('story', { ...story, chapters: next });
              }}
            />
          </div>
        ))}
      </div>
    </SectionEditor>
  );
}

function placeholder(title: string) {
  if (title === '첫 만남') return '두 사람이 처음 만난 그날, 어떤 일이 있었나요?';
  if (title === '고백') return '먼저 마음을 표현한 사람의 이야기를 들려주세요';
  return '오래 기억하고 싶은 그 순간을 적어주세요';
}
