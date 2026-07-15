'use client';

import { useEditorStore } from '@/stores/editor';
import { SectionEditor, type SectionDragProps } from '../SectionEditor';
import { SectionHeaderFields } from './SectionHeaderFields';
import { TextField } from '../form-fields';
import { Button } from '@/components/ui/button';
import type { QuizQuestion } from '@/types/invitation';

const EMPTY_QUESTION: QuizQuestion = {
  q: '',
  options: ['', '', '', ''],
  answer: 0,
};

export function QuizEditor({ drag }: { drag?: SectionDragProps }) {
  const quiz = useEditorStore((s) => s.content?.quiz);
  const patch = useEditorStore((s) => s.patchSection);
  if (!quiz) return null;

  const updateQuestion = (i: number, next: QuizQuestion) => {
    const list = [...quiz.questions];
    list[i] = next;
    patch('quiz', { ...quiz, questions: list });
  };

  const addQuestion = () => {
    if (quiz.questions.length >= 2) return;
    patch('quiz', { ...quiz, questions: [...quiz.questions, EMPTY_QUESTION] });
  };

  const removeQuestion = (i: number) => {
    patch('quiz', { ...quiz, questions: quiz.questions.filter((_, idx) => idx !== i) });
  };

  return (
    <SectionEditor
      drag={drag}
      title="퀴즈"
      description="하객이 풀 수 있는 4지선다 퀴즈 (최대 2문항)"
      toggle={{
        enabled: quiz.enabled,
        onChange: (next) => patch('quiz', { ...quiz, enabled: next }),
      }}
    >
      <div className="flex flex-col gap-4">
        <SectionHeaderFields sectionKey="quiz" />
        {quiz.questions.map((question, qi) => (
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
              placeholder="신랑이 신부에게 처음 선물한 것은?"
              onChange={(e) => updateQuestion(qi, { ...question, q: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              {question.options.map((opt, oi) => (
                <label
                  key={oi}
                  className="flex items-center gap-2 rounded border bg-background px-2 py-1.5 text-sm"
                >
                  <input
                    type="radio"
                    name={`quiz-${qi}-answer`}
                    checked={question.answer === oi}
                    onChange={() => updateQuestion(qi, { ...question, answer: oi })}
                    aria-label={`정답 ${oi + 1}번`}
                  />
                  <input
                    value={opt}
                    placeholder={`보기 ${oi + 1}`}
                    onChange={(e) => {
                      const opts = [...question.options];
                      opts[oi] = e.target.value;
                      updateQuestion(qi, { ...question, options: opts });
                    }}
                    className="flex-1 bg-transparent text-sm outline-none"
                  />
                </label>
              ))}
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addQuestion}
          disabled={quiz.questions.length >= 2}
        >
          문항 추가
        </Button>
      </div>
    </SectionEditor>
  );
}
