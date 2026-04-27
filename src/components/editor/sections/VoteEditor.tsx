'use client';

import { useEditorStore } from '@/stores/editor';
import { SectionEditor } from '../SectionEditor';
import { TextField } from '../form-fields';
import { Button } from '@/components/ui/button';
import type { VoteQuestion } from '@/types/invitation';

const EMPTY_QUESTION: VoteQuestion = {
  q: '',
  options: ['', ''],
};

export function VoteEditor() {
  const vote = useEditorStore((s) => s.content?.vote);
  const patch = useEditorStore((s) => s.patchSection);
  if (!vote) return null;

  const updateQuestion = (i: number, next: VoteQuestion) => {
    const list = [...vote.questions];
    list[i] = next;
    patch('vote', { ...vote, questions: list });
  };

  const addQuestion = () => {
    if (vote.questions.length >= 2) return;
    patch('vote', { ...vote, questions: [...vote.questions, EMPTY_QUESTION] });
  };

  const removeQuestion = (i: number) => {
    patch('vote', { ...vote, questions: vote.questions.filter((_, idx) => idx !== i) });
  };

  return (
    <SectionEditor
      title="투표"
      description="A/B 양자택일 (최대 2문항)"
      toggle={{
        enabled: vote.enabled,
        onChange: (next) => patch('vote', { ...vote, enabled: next }),
      }}
    >
      <div className="flex flex-col gap-4">
        {vote.questions.map((question, qi) => (
          <div key={qi} className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted-foreground">문항 {qi + 1}</h3>
              <button
                type="button"
                onClick={() => removeQuestion(qi)}
                className="text-xs text-destructive hover:underline"
              >
                삭제
              </button>
            </div>
            <TextField
              label="질문"
              value={question.q}
              maxLength={100}
              placeholder="결혼식 후 신혼여행은?"
              onChange={(e) => updateQuestion(qi, { ...question, q: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              {question.options.map((opt, oi) => (
                <TextField
                  key={oi}
                  label=""
                  value={opt}
                  placeholder={oi === 0 ? 'A 보기' : 'B 보기'}
                  onChange={(e) => {
                    const opts = [...question.options];
                    opts[oi] = e.target.value;
                    updateQuestion(qi, { ...question, options: opts });
                  }}
                />
              ))}
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addQuestion}
          disabled={vote.questions.length >= 2}
        >
          문항 추가
        </Button>
      </div>
    </SectionEditor>
  );
}
