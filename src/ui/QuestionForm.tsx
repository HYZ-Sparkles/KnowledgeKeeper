import { useEffect, useState, type FormEvent } from 'react';
import type { GroupSummary, QuestionInput, QuestionType } from '../core/types';

export interface QuestionFormProps {
  mode: 'create' | 'edit';
  initialValue?: QuestionInput;
  onSubmit: (input: QuestionInput) => Promise<void> | void;
  groups?: GroupSummary[];
  groupId?: string;
  onGroupChange?: (groupId: string) => void;
  onRequestCreateGroup?: () => void;
}

interface FormState {
  type: QuestionType;
  stem: string;
  options: string[];
  answers: string[];
  explanation: string;
}

const TYPE_LABELS: Record<string, string> = {
  single: '单选题',
  multiple: '多选题',
  truefalse: '判断题',
};

const TRUE_FALSE_OPTIONS = [
  { letter: '√', text: '正确' },
  { letter: '×', text: '错误' },
];

/** Letters keep flowing after an option is removed, with no fixed upper count. */
function letterAt(index: number): string {
  let rest = index;
  let letters = '';
  do {
    letters = String.fromCharCode(65 + (rest % 26)) + letters;
    rest = Math.floor(rest / 26) - 1;
  } while (rest >= 0);
  return letters;
}

function makeState(value?: QuestionInput): FormState {
  const type = value?.type ?? 'single';
  return {
    type,
    stem: value?.stem ?? '',
    options: value?.options.length ? value.options.map((o) => o.text) : ['', ''],
    answers: value?.answer ? [...value.answer] : [],
    explanation: value?.explanation ?? '',
  };
}

/**
 * The one entry form. Ticket 06 (question page) and ticket 16 (inline review
 * editor) reuse it by passing an initial value and mode; no behaviour here
 * depends on the entry route.
 */
export default function QuestionForm({
  mode, initialValue, onSubmit, groups, groupId, onGroupChange,
  onRequestCreateGroup,
}: QuestionFormProps) {
  const [state, setState] = useState<FormState>(() => makeState(initialValue));
  const { type, stem, options, answers, explanation } = state;

  useEffect(() => { setState(makeState(initialValue)); }, [initialValue]);

  const missing: string[] = [];
  if (!stem.trim()) missing.push('题干不能为空');
  if (type === 'truefalse') {
    if (answers.length !== 1) missing.push('判断题需要选一个答案');
  } else {
    if (options.length < 2) missing.push('至少要有 2 个选项');
    if (type === 'single' && answers.length !== 1) {
      missing.push('单选题需要恰好 1 个正确选项');
    }
    if (type === 'multiple' && answers.length < 2) {
      missing.push('多选题至少需要 2 个正确选项');
    }
  }

  function update(patch: Partial<FormState>) {
    setState((prev) => ({ ...prev, ...patch }));
  }

  function changeType(next: QuestionType) {
    update({ type: next, answers: [] });
  }

  function toggleAnswer(letter: string) {
    setState((prev) => {
      if (prev.type === 'single') {
        return { ...prev, answers: prev.answers.includes(letter) ? [] : [letter] };
      }
      return {
        ...prev,
        answers: prev.answers.includes(letter)
          ? prev.answers.filter((a) => a !== letter)
          : [...prev.answers, letter],
      };
    });
  }

  function removeOption(index: number) {
    setState((prev) => {
      const nextAnswers: string[] = [];
      for (const answer of prev.answers) {
        const oldIndex = prev.options.findIndex((_, i) => letterAt(i) === answer);
        if (oldIndex < 0 || oldIndex === index) continue;
        nextAnswers.push(letterAt(oldIndex > index ? oldIndex - 1 : oldIndex));
      }
      return {
        ...prev,
        options: prev.options.filter((_, i) => i !== index),
        answers: nextAnswers,
      };
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (missing.length > 0) return;
    const value: QuestionInput = type === 'truefalse'
      ? {
        type,
        stem: stem.trim(),
        options: TRUE_FALSE_OPTIONS.map((o) => ({ ...o })),
        answer: answers.slice(0, 1),
        explanation,
      }
      : {
        type,
        stem: stem.trim(),
        options: options.map((text, index) => ({
          letter: letterAt(index), text,
        })),
        answer: answers.filter((letter) =>
          options.some((_, index) => letterAt(index) === letter)),
        explanation,
      };
    await onSubmit(value);
    if (mode === 'create') setState(makeState());
  }

  const showGroupSelect = Boolean(groups && groupId !== undefined && onGroupChange);
  return (
    <form className="form-grid" onSubmit={(event) => void submit(event)}>
      <div className={showGroupSelect ? 'two' : ''}>
        <label className="field">
          <span>题型</span>
          <select
            className="field-input"
            value={type}
            onChange={(event) => changeType(event.target.value as QuestionType)}
          >
            {(['single', 'multiple', 'truefalse'] as const).map((value) => (
              <option key={value} value={value}>{TYPE_LABELS[value]}</option>
            ))}
          </select>
        </label>
        {showGroupSelect && (
          <label className="field">
            <span>放进哪个分组</span>
            <select
              className="field-input"
              value={groupId}
              onChange={(event) => {
                if (event.target.value === '__new__') {
                  onRequestCreateGroup?.();
                } else {
                  onGroupChange?.(event.target.value);
                }
              }}
            >
              {groups?.map(({ group }) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
              {onRequestCreateGroup && (
                <option value="__new__">＋ 新建分组…</option>
              )}
            </select>
          </label>
        )}
      </div>

      <label className="field">
        <span>题干</span>
        <textarea
          className="field-input"
          value={stem}
          onChange={(event) => update({ stem: event.target.value })}
        />
      </label>

      {type === 'truefalse' ? (
        <div className="field">
          <span>答案</span>
          <div className="flex gap-[10px] flex-wrap">
            {TRUE_FALSE_OPTIONS.map((option) => (
              <button
                type="button"
                key={option.letter}
                className={`opt-pick w-auto px-[14px] ${answers[0] === option.letter ? 'on' : ''}`}
                onClick={() => update({ answers: [option.letter] })}
              >
                {option.letter} {option.text}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="field">
          <span>选项</span>
          <div>
            {options.map((text, index) => {
              const letter = letterAt(index);
              return (
                <div className="opt-row" key={index}>
                  <span className="opt-letter">{letter}</span>
                  <input
                    className="field-input flex-1 min-w-0"
                    value={text}
                    onChange={(event) => update({
                      options: options.map((item, i) =>
                        i === index ? event.target.value : item),
                    })}
                  />
                  <button
                    type="button"
                    className={`opt-pick ${answers.includes(letter) ? 'on' : ''}`}
                    aria-label={`把 ${letter} 标为正确`}
                    onClick={() => toggleAnswer(letter)}
                  >
                    正确
                  </button>
                  <button
                    type="button"
                    className="opt-remove"
                    aria-label={`删除选项 ${letter}`}
                    onClick={() => removeOption(index)}
                  >
                    删除
                  </button>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="btn btn-ghost self-start"
            onClick={() => update({ options: [...options, ''] })}
          >
            ＋ 再加一个选项
          </button>
        </div>
      )}

      <label className="field">
        <span>解析（可以不填）</span>
        <textarea
          className="field-input"
          value={explanation}
          onChange={(event) => update({ explanation: event.target.value })}
        />
      </label>

      {missing.length > 0 && (
        <p className="form-missing">还缺少：{missing.join('；')}</p>
      )}
      <div className="flex items-center gap-[10px] flex-wrap">
        <button className="btn btn-primary" type="submit" disabled={missing.length > 0}>
          {mode === 'create' ? '保存到题库' : '保存'}
        </button>
      </div>
    </form>
  );
}
