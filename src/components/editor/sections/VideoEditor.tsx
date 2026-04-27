'use client';

import { useEditorStore } from '@/stores/editor';
import { SectionEditor } from '../SectionEditor';
import { TextField } from '../form-fields';

export function VideoEditor() {
  const video = useEditorStore((s) => s.content?.video);
  const patch = useEditorStore((s) => s.patchSection);
  if (!video) return null;

  return (
    <SectionEditor
      title="영상"
      description="유튜브 또는 비메오 링크"
      toggle={{
        enabled: video.enabled,
        onChange: (next) => patch('video', { ...video, enabled: next }),
      }}
    >
      <TextField
        label="영상 URL"
        type="url"
        value={video.url ?? ''}
        placeholder="https://youtu.be/..."
        onChange={(e) => patch('video', { ...video, url: e.target.value || null })}
        hint="유튜브, 비메오 등 임베드 가능한 URL"
      />
    </SectionEditor>
  );
}
