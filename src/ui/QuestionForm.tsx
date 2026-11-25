import {
  useEffect, useState, type FormEvent, type ReactNode,
} from 'react';
import type { GroupSummary, QuestionInput, QuestionType } from '../core/types';
import { TYPE_LABELS } from './labels';

export interface QuestionFormProps {
  mode: 'create' | 'edit';
  initialValue?: QuestionInput;
  onSubmit: (input: QuestionInput) => Promise<void> | void;
  groups?: GroupSummary[];
  groupId?: string;
  onGroupChange?: (groupId: string) => void;
  onRequestCreateGroup?: () => void;
  /** Extra bottom-row actions, e.g. the question page's cancel and delete. */
  extraActions?: ReactNode;
  /** The review editor calls the submit action 「完成」 instead of 「保存」. */
  submitLabel?: string;
}

interface SubFormState {
  stem: string;
  type: 'single' | 'multiple';
  answers: string[];
}

interface FormState {
  type: QuestionType;
  stem: string;
  options: string[];
  answers: string[];
  sharedOptions: string[];
  subs: SubFormState[];
  explanation: string;
}

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
    sharedOptions: value?.sharedOptions?.length
      ? value.sharedOptions.map((o) => o.text)
      : ['', ''],
    subs: value?.subQuestions?.length
      ? value.subQuestions.map((sub) => ({
        stem: sub.stem, type: sub.type, answers: [...sub.answer],
      }))
      : [],
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
  onRequestCreateGroup, extraActions, submitLabel,
}: QuestionFormProps) {
  const [state, setState] = useState<FormState>(() => makeState(initialValue));
  const [answerCleared, setAnswerCleared] = useState(false);
  const { type, stem, options, answers, sharedOptions, subs, explanation } = state;
  // In edit mode a matching question cannot become another type, or vice versa.
  const lockedType = mode === 'edit' ? initialValue?.type : undefined;

  useEffect(() => {
    setState(makeState(initialValue));
    setAnswerCleared(false);
  }, [initialValue]);

  const missing: string[] = [];
  if (!stem.trim()) missing.push('题干不能为空');
  if (type === 'matching') {
    if (sharedOptions.length < 2) missing.push('至少要有 2 个共用选项');
    if (subs.length < 1) missing.push('至少要有 1 个子题');
    subs.forEach((sub, index) => {
      const label = `子题 ${index + 1}`;
      if (!sub.stem.trim()) missing.push(`${label}题干不能为空`);
      if (sub.type === 'single' && sub.answers.length !== 1) {
        missing.push(`${label}需要恰好 1 个正确答案`);
      }
      if (sub.type === 'multiple' && sub.answers.length < 2) {
        missing.push(`${label}至少需要 2 个正确答案`);
      }
    });
  } else if (type === 'truefalse') {
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
    if (next === type) return;
    let nextAnswers = state.answers;
    let cleared = false;
    if (next === 'truefalse' || type === 'truefalse') {
      nextAnswers = [];
      cleared = true;
    } else if (type === 'multiple' && next === 'single' && nextAnswers.length > 1) {
      nextAnswers = [];
      cleared = true;
    }
    setAnswerCleared(cleared);
    update({ type: next, answers: nextAnswers });
  }

  function toggleAnswer(letter: string) {
    setAnswerCleared(false);
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

  function toggleSubAnswer(subIndex: number, letter: string) {
    setState((prev) => ({
      ...prev,
      subs: prev.subs.map((sub, index) => {
        if (index !== subIndex) return sub;
        if (sub.type === 'single') {
          return {
            ...sub,
            answers: sub.answers.includes(letter) ? [] : [letter],
          };
        }
        return {
          ...sub,
          answers: sub.answers.includes(letter)
            ? sub.answers.filter((a) => a !== letter)
            : [...sub.answers, letter],
        };
      }),
    }));
  }

  function changeSubType(index: number, next: 'single' | 'multiple') {
    setState((prev) => ({
      ...prev,
      subs: prev.subs.map((sub, i) => i !== index ? sub : {
        ...sub,
        type: next,
        answers: next === 'single' && sub.answers.length > 1 ? [] : sub.answers,
      }),
    }));
  }

  /** Letters re-flow with the shared options, carrying each sub's answers. */
  function removeSharedOption(index: number) {
    setState((prev) => {
      const removed = letterAt(index);
      return {
        ...prev,
        sharedOptions: prev.sharedOptions.filter((_, i) => i !== index),
        subs: prev.subs.map((sub) => ({
          ...sub,
          answers: sub.answers.flatMap((answer) => {
            if (answer === removed) return [];
            const oldIndex = prev.sharedOptions.findIndex(
              (_, i) => letterAt(i) === answer);
            if (oldIndex < 0) return [];
            return [letterAt(oldIndex > index ? oldIndex - 1 : oldIndex)];
          }),
        })),
      };
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (missing.length > 0) return;
    const value: QuestionInput = type === 'matching'
      ? {
        type,
        stem: stem.trim(),
        options: [],
        answer: [],
        explanation,
        sharedOptions: sharedOptions.map((text, index) => ({
          letter: letterAt(index), text,
        })),
        subQuestions: subs.map((sub) => ({
          stem: sub.stem.trim(),
          type: sub.type,
          answer: sub.answers.filter((letter) =>
            sharedOptions.some((_, index) => letterAt(index) === letter)),
        })),
      }
      : type === 'truefalse'
      ? {
        type,
        stem: stem.trim(),
        options: TRUE_FALSE_OPTIONS.map((o) => ({ ...o })),
        answer: answers.slice(0, 1),
        explanation,
        sharedOptions: null,
        subQuestions: null,
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
        sharedOptions: null,
        subQuestions: null,
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
            {(['single', 'multiple', 'truefalse', 'matching'] as const).map((value) => (
              <option
                key={value}
                value={value}
                disabled={lockedType === 'matching'
                  ? value !== 'matching'
                  : lockedType !== undefined && value === 'matching'}
              >
                {TYPE_LABELS[value]}
              </option>
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

      {type === 'matching' ? (
        <>
          <div className="field">
            <span className="section-label">共用选项</span>
            <div>
              {sharedOptions.map((text, index) => {
                const letter = letterAt(index);
                return (
                  <div className="opt-row" key={index}>
                    <span className="opt-letter">{letter}</span>
                    <input
                      className="field-input flex-1 min-w-0"
                      aria-label={`共用选项 ${letter}`}
                      value={text}
                      onChange={(event) => update({
                        sharedOptions: sharedOptions.map((item, i) =>
                          i === index ? event.target.value : item),
                      })}
                    />
                    <button
                      type="button"
                      className="opt-remove"
                      aria-label={`删除共用选项 ${letter}`}
                      onClick={() => removeSharedOption(index)}
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
              onClick={() => update({ sharedOptions: [...sharedOptions, ''] })}
            >
              ＋ 再加一个共用选项
            </button>
          </div>

          <div className="field">
            <span className="section-label">子题</span>
            {subs.map((sub, index) => (
              <div className="sub-block" key={index}>
                <div className="sub-head">
                  <b className="text-t14 text-ink-2">子题 {index + 1}</b>
                  <div className="flex gap-[6px]">
                    <button
                      type="button"
                      className={`sub-type ${sub.type === 'single' ? 'on' : ''}`}
                      onClick={() => changeSubType(index, 'single')}
                    >
                      单选
                    </button>
                    <button
                      type="button"
                      className={`sub-type ${sub.type === 'multiple' ? 'on' : ''}`}
                      onClick={() => changeSubType(index, 'multiple')}
                    >
                      多选
                    </button>
                  </div>
                  <button
                    type="button"
                    className="opt-remove ml-auto"
                    onClick={() => update({
                      subs: subs.filter((_, i) => i !== index),
                    })}
                  >
                    删除子题
                  </button>
                </div>
                <label className="field mb-[10px]">
                  <span>子题题干</span>
                  <input
                    className="field-input w-full"
                    aria-label={`子题 ${index + 1} 题干`}
                    value={sub.stem}
                    onChange={(event) => update({
                      subs: subs.map((item, i) =>
                        i === index ? { ...item, stem: event.target.value } : item),
                    })}
                  />
                </label>
                <div>
                  {sharedOptions.map((text, i) => {
                    const letter = letterAt(i);
                    return (
                      <div className="opt-row" key={letter}>
                        <span className="opt-letter">{letter}</span>
                        <span className="shared-text">{text}</span>
                        <button
                          type="button"
                          className={`opt-pick w-auto px-[12px] ${sub.answers.includes(letter) ? 'on' : ''}`}
                          aria-label={`把子题 ${index + 1} 的 ${letter} 标为正确`}
                          onClick={() => toggleSubAnswer(index, letter)}
                        >
                          正确
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-ghost self-start mt-[10px]"
              onClick={() => update({
                subs: [...subs, { stem: '', type: 'single', answers: [] }],
              })}
            >
              ＋ 再加一个子题
            </button>
          </div>
        </>
      ) : type === 'truefalse' ? (
        <div className="field">
          <span>答案</span>
          <div className="flex gap-[10px] flex-wrap">
            {TRUE_FALSE_OPTIONS.map((option) => (
              <button
                type="button"
                key={option.letter}
                className={`opt-pick w-auto px-[14px] ${answers[0] === option.letter ? 'on' : ''}`}
                onClick={() => {
                  setAnswerCleared(false);
                  update({ answers: [option.letter] });
                }}
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

      {answerCleared && (
        <p className="form-invalid">题型已改，请重新选择答案</p>
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
          {submitLabel ?? (mode === 'create' ? '保存到题库' : '保存')}
        </button>
        {extraActions}
      </div>
    </form>
  );
}
