'use client';

import { useEditorStore } from '@/stores/editor';
import { SectionEditor, type SectionDragProps } from '../SectionEditor';
import { SectionHeaderFields } from './SectionHeaderFields';
import { TextField, TextAreaField } from '../form-fields';
import { Button } from '@/components/ui/button';
import { ImageUploader } from '../ImageUploader';
import type { StoryChapter } from '@/types/invitation';

const PLACEHOLDERS = ['첫 만남', '고백', '프로포즈', '프로필', '특별한 순간'];

export function StoryEditor({ drag }: { drag?: SectionDragProps }) {
  const story = useEditorStore((s) => s.content?.story);
  const invitationId = useEditorStore((s) => s.invitationId);
  const patch = useEditorStore((s) => s.patchSection);
  if (!story || !invitationId) return null;

  const setChapters = (next: StoryChapter[]) => patch('story', { ...story, chapters: next });

  const updateChapter = (i: number, next: StoryChapter) => {
    const list = [...story.chapters];
    list[i] = next;
    setChapters(list);
  };

  const addChapter = () => {
    if (story.chapters.length >= 5) return;
    setChapters([...story.chapters, { title: '', text: '' }]);
  };

  const removeChapter = (i: number) => {
    setChapters(story.chapters.filter((_, idx) => idx !== i));
  };

  const moveChapter = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= story.chapters.length) return;
    const list = [...story.chapters];
    [list[i], list[j]] = [list[j], list[i]];
    setChapters(list);
  };

  return (
    <SectionEditor
      drag={drag}
      title="우리 이야기"
      description="제목 · 사진 · 내용을 자유롭게 (최대 5개)"
      toggle={{
        enabled: story.enabled,
        onChange: (next) => patch('story', { ...story, enabled: next }),
      }}
    >
      <div className="flex flex-col gap-4">
        <SectionHeaderFields sectionKey="story" />
        {story.chapters.length === 0 && (
          <p className="rounded-md border border-dashed bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
            아래 &lt;챕터 추가&gt;를 눌러 첫 이야기를 시작해보세요
          </p>
        )}

        {story.chapters.map((chapter, i) => {
          const placeholder = PLACEHOLDERS[i] ?? `챕터 ${i + 1}`;
          return (
            <div
              key={i}
              className="flex flex-col gap-3 rounded-md border bg-muted/20 p-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-muted-foreground">
                  챕터 {i + 1}
                </h3>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="위로"
                    disabled={i === 0}
                    onClick={() => moveChapter(i, -1)}
                    className="grid h-6 w-6 place-items-center rounded border border-input bg-background text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label="아래로"
                    disabled={i === story.chapters.length - 1}
                    onClick={() => moveChapter(i, 1)}
                    className="grid h-6 w-6 place-items-center rounded border border-input bg-background text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeChapter(i)}
                    className="ml-1 text-xs text-destructive hover:underline"
                  >
                    삭제
                  </button>
                </div>
              </div>

              <TextField
                label="제목"
                value={chapter.title}
                maxLength={40}
                placeholder={placeholder}
                onChange={(e) => updateChapter(i, { ...chapter, title: e.target.value })}
              />

              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">사진 (선택)</span>
                <ImageUploader
                  value={chapter.image ?? null}
                  onChange={(url) => updateChapter(i, { ...chapter, image: url })}
                  invitationId={invitationId}
                  folder={`story-${i}`}
                  previewAspect="aspect-[4/3]"
                  label="사진 선택하기"
                />
              </div>

              <TextAreaField
                label="내용"
                value={chapter.text}
                maxLength={500}
                rows={3}
                placeholder="기억하고 싶은 그날의 이야기"
                onChange={(e) => updateChapter(i, { ...chapter, text: e.target.value })}
              />
            </div>
          );
        })}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addChapter}
          disabled={story.chapters.length >= 5}
        >
          챕터 추가
        </Button>
      </div>
    </SectionEditor>
  );
}
