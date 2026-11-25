import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { Core } from '../core';
import type {
  DraftQuestion, GroupSummary, Option, QuestionInput, ReviewDraft, SubQuestion,
} from '../core/types';
import { navigate } from '../router';
import Breadcrumb from './Breadcrumb';
import Dialog from './Dialog';
import QuestionForm from './QuestionForm';
import { readImportGroupId, writeImportGroupId } from './deviceState';
import { defaultGroupId } from './entryGroups';
import { TYPE_LABELS } from './labels';
import {
  mergeDraftQuestions, normalizeAnswer,
} from './mergeDraftQuestions';

const TRUE_FALSE_OPTIONS: Option[] = [
  { letter: '√', text: '正确' },
  { letter: '×', text: '错误' },
];

let nextDraftId = 1;

function answerMissing(question: DraftQuestion): boolean {
  if (question.type === 'matching') {
    const shared = question.sharedOptions ?? [];
    const subs = question.subQuestions ?? [];
    if (shared.length < 2 || subs.length === 0) return true;
    const allowed = new Set(shared.map((option) => option.letter));
    return subs.some((sub) => sub.answer.length === 0
      || sub.answer.some((letter) => !allowed.has(letter))
      || (sub.type === 'single' && sub.answer.length !== 1)
      || (sub.type === 'multiple' && sub.answer.length < 2));
  }
  const answer = normalizeAnswer(question.answerText, question.type);
  if (!answer) return true;
  if (question.type === 'truefalse') return answer !== '√' && answer !== '×';
  const letters = new Set(question.options.map((option) => option.letter));
  return [...answer].some((letter) => !letters.has(letter));
}

/** Keep the editable answer box and the per-sub-question answers in sync. */
function splitMatchingAnswer(
  raw: string, subs: SubQuestion[],
): SubQuestion[] {
  const bySub = new Map<number, string>();
  for (const match of raw.matchAll(/(\d+)\s*[:：.、]?\s*([A-Ja-j]+)/g)) {
    bySub.set(Number(match[1]), match[2].toUpperCase());
  }
  return subs.map((sub, index) => ({
    ...sub,
    answer: [...(bySub.get(index + 1) ?? '')].filter((letter) => /^[A-J]$/.test(letter)),
  }));
}

function matchingOptionsLine(
  shared: Option[] | null | undefined, subs: SubQuestion[] | null | undefined,
): string {
  const list = (shared ?? []).map((option) =>
    `${option.letter} ${option.text}`).join('　');
  return `共用选项 ${list} · ${subs?.length ?? 0} 个子题`;
}

function matchingAnswerText(subs: SubQuestion[]): string {
  return subs
    .map((sub, index) => sub.answer.length
      ? `${index + 1} ${sub.answer.join('')}` : '')
    .filter(Boolean)
    .join('　');
}

/** Prefill the shared entry form from one review row. */
function draftToInput(question: DraftQuestion): QuestionInput {
  if (question.type === 'matching') {
    return {
      type: 'matching',
      stem: question.stem,
      options: [],
      answer: [],
      explanation: question.explanation,
      sharedOptions: (question.sharedOptions ?? []).map((option) => ({ ...option })),
      subQuestions: (question.subQuestions ?? []).map((sub) => ({
        ...sub, answer: [...sub.answer],
      })),
    };
  }
  const normalized = normalizeAnswer(question.answerText, question.type);
  return {
    type: question.type,
    stem: question.stem,
    options: question.type === 'truefalse'
      ? TRUE_FALSE_OPTIONS.map((option) => ({ ...option }))
      : question.options.map((option) => ({ ...option })),
    answer: question.type === 'truefalse'
      ? (normalized ? [normalized] : [])
      : [...normalized].filter((letter) =>
        question.options.some((option) => option.letter === letter)),
    explanation: question.explanation,
    sharedOptions: null,
    subQuestions: null,
  };
}

/** Fold a completed form back into the same row and draft id. */
function inputToDraft(input: QuestionInput, original: DraftQuestion): DraftQuestion {
  if (input.type === 'matching') {
    const subs: SubQuestion[] = (input.subQuestions ?? []).map((sub) => ({
      ...sub, answer: [...sub.answer],
    }));
    const next: DraftQuestion = {
      ...original,
      type: 'matching',
      stem: input.stem,
      options: [],
      answerText: matchingAnswerText(subs),
      explanation: input.explanation,
      sharedOptions: (input.sharedOptions ?? []).map((option) => ({ ...option })),
      subQuestions: subs,
    };
    return { ...next, missingAnswer: answerMissing(next) };
  }
  const next: DraftQuestion = {
    ...original,
    type: input.type,
    stem: input.stem,
    options: input.type === 'truefalse'
      ? [] : input.options.map((option) => ({ ...option })),
    answerText: input.answer.join(''),
    explanation: input.explanation,
    sharedOptions: null,
    subQuestions: null,
  };
  return { ...next, missingAnswer: answerMissing(next) };
}

export default function ImportView({
  core, groups, showToast, refreshGroups,
}: {
  core: Core;
  groups: GroupSummary[];
  showToast: (message: string) => void;
  refreshGroups: () => Promise<void>;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [rows, setRows] = useState<DraftQuestion[]>([]);
  const [groupId, setGroupId] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [splittingIndex, setSplittingIndex] = useState<number | null>(null);
  const [splitStem, setSplitStem] = useState('');
  const splitRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractedFrom, setExtractedFrom] = useState<{
    name: string; length: number;
  } | null>(null);

  // Keep the form's prefill stable while its own fields are being edited.
  const editingInitial = useMemo(
    () => editingIndex === null ? null : draftToInput(rows[editingIndex]),
    [editingIndex, rows],
  );

  useEffect(() => {
    if (groups.length === 0) return;
    const valid = (id: string | null) =>
      id && groups.some((g) => g.group.id === id) ? id : null;
    setGroupId((current) =>
      valid(current) ?? valid(readImportGroupId()) ?? defaultGroupId(groups));
  }, [groups]);

  const missingNumbers = rows.flatMap((row, index) =>
    answerMissing(row) ? [index + 1] : []);
  const answered = rows.length - missingNumbers.length;

  function changeGroup(id: string) {
    setGroupId(id);
    writeImportGroupId(id);
  }

  function updateRow(index: number, patch: Partial<DraftQuestion>) {
    setRows((previous) => previous.map((row, i) =>
      i === index ? { ...row, ...patch } : row));
  }

  function jumpToRow(number: number) {
    document.getElementById(`review-row-${number}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function openEditor(index: number) {
    setSplittingIndex(null);
    setEditingIndex(index);
  }

  function openSplit(index: number) {
    setEditingIndex(null);
    setSplitStem(rows[index].stem);
    setSplittingIndex(index);
  }

  function splitRow(index: number) {
    const caret = splitRef.current?.selectionStart ?? splitStem.length;
    const before = splitStem.slice(0, caret).trim();
    const after = splitStem.slice(caret).trim();
    if (!before || !after) return;
    setRows((previous) => {
      const original = previous[index];
      const splitOff: DraftQuestion = {
        draftId: `draft-new-${nextDraftId++}`,
        sourceNo: original.sourceNo,
        type: 'single',
        stem: after,
        options: [],
        answerText: '',
        explanation: '',
        missingAnswer: true,
        sharedOptions: null,
        subQuestions: null,
      };
      const next = [...previous];
      next.splice(index, 1, { ...original, stem: before }, splitOff);
      return next;
    });
    setSplittingIndex(null);
  }

  function mergeRow(index: number) {
    setRows((previous) => {
      const first = previous[index];
      const second = previous[index + 1];
      if (!first || !second) return previous;
      if (first.type === 'matching' || second.type === 'matching') return previous;
      const merged = mergeDraftQuestions(first, second);
      const next = [...previous];
      next.splice(index, 2, { ...merged, missingAnswer: answerMissing(merged) });
      return next;
    });
  }

  function downloadTemplate() {
    const blob = core.excelTemplate();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'KnowledgeKeeper-导入模板.xlsx';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast('已下载 Excel 模板');
  }

  /** File text lands in the same editable box; spreadsheets go straight in. */
  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow picking the same file again
    if (!file) return;
    setExtracting(true);
    setError('');
    setExtractedFrom(null);
    try {
      const result = await core.importFromFile(file);
      if (result.skipTextarea) {
        setRows(result.draft.questions.map((question) => ({ ...question })));
        setStep(2);
        window.scrollTo({ top: 0 });
      } else {
        setText(result.text);
        setExtractedFrom({ name: result.fileName, length: result.text.length });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setExtracting(false);
    }
  }

  async function startReview() {
    setBusy(true);
    setError('');
    try {
      const draft = await core.importFromText(text);
      setRows(draft.questions.map((question) => ({ ...question })));
      setStep(2);
      window.scrollTo({ top: 0 });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function createGroup() {
    const group = await core.createGroup(newName);
    await refreshGroups();
    changeGroup(group.id);
    setCreating(false);
  }

  async function commit() {
    if (missingNumbers.length > 0 || rows.length === 0 || !groupId) return;
    const draft: ReviewDraft = { questions: rows, warnings: [] };
    await core.commitReview(draft, groupId);
    const name = groups.find((g) => g.group.id === groupId)?.group.name ?? '';
    showToast(`已写入 ${rows.length} 道题到「${name}」`);
    await refreshGroups();
    navigate({ name: 'group', groupId });
  }

  return (
    <>
      <Breadcrumb trail={['我的题库', '导入']} />
      <h1 className="text-t40 font-bold text-ink-2 mb-3 tracking-[-.3px]">导入题目</h1>
      <p className="text-t15 text-mute mb-[18px] max-w-[62ch]">
        把从网页复制的题目文本粘贴进来，解析结果先进入校对页，逐题改完再写进分组——解析错了不会直接进题库。
      </p>
      <div className="pills">
        <span className="pill bg-blue-wash text-blue-ink">支持 .pdf .docx .xlsx .xls</span>
        <span className="pill bg-orange-wash text-[#9C5620]">.doc 需先另存为 .docx</span>
      </div>
      <hr className="hairline" />

      {step === 1 ? (
        <>
          <div className="toolbar">
            <input
              ref={fileInputRef}
              className="hidden"
              type="file"
              accept=".pdf,.docx,.xlsx,.xls"
              aria-label="从「文件」选择"
              onChange={(event) => void handleFile(event)}
            />
            <button
              className="btn"
              type="button"
              disabled={extracting}
              onClick={() => fileInputRef.current?.click()}
            >
              {extracting ? '正在提取…' : '从「文件」选择'}
            </button>
            <span className="hintline">或直接粘贴文本</span>
            <button
              className="btn btn-ghost btn-small"
              type="button"
              onClick={downloadTemplate}
            >
              下载 Excel 模板
            </button>
          </div>
          {extractedFrom && (
            <p className="extracted-note">
              已从「{extractedFrom.name}」提取约{' '}
              <b className="num">{extractedFrom.length}</b> 字
            </p>
          )}
          <label className="field max-w-none">
            <span>粘贴题目文本</span>
            <textarea
              className="paste"
              aria-label="粘贴题目文本"
              value={text}
              placeholder={'1. 题目\nA. 选项\nB. 选项\n答案：A'}
              onChange={(event) => {
                setText(event.target.value);
                setError('');
                setExtractedFrom(null);
              }}
            />
          </label>
          {error && (
            <div className="warn" role="alert">
              <span>{error}</span>
            </div>
          )}
          <label className="field">
            <span>放进哪个分组</span>
            <select
              className="field-input"
              value={groupId}
              onChange={(event) => {
                if (event.target.value === '__new__') {
                  setNewName('');
                  setCreating(true);
                } else {
                  changeGroup(event.target.value);
                }
              }}
            >
              {groups.map(({ group }) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
              <option value="__new__">＋ 新建分组…</option>
            </select>
          </label>
          <button
            className="btn btn-primary"
            type="button"
            disabled={busy || extracting || !groupId}
            onClick={() => void startReview()}
          >
            开始校对
          </button>
        </>
      ) : (
        <>
          <div className={`review-bar ${missingNumbers.length === 0 ? 'ok' : ''}`}
            role="status">
            <span>
              识别到 <b className="num">{rows.length}</b> 道题，答案{' '}
              <b className="num">{answered}</b> 个。{' '}
              {missingNumbers.length > 0 ? (
                <>
                  第{' '}
                  {missingNumbers.map((number, index) => (
                    <span key={number}>
                      {index > 0 && '、'}
                      <button
                        type="button"
                        className="jump"
                        aria-label={`跳到第 ${number} 题`}
                        onClick={() => jumpToRow(number)}
                      >
                        {number}
                      </button>
                    </span>
                  ))}
                  {' '}题缺答案，标红了。
                </>
              ) : '都齐了。'}
            </span>
            <button
              type="button"
              className="btn btn-primary btn-small btn-tap"
              disabled={missingNumbers.length > 0 || rows.length === 0}
              onClick={() => void commit()}
            >
              写入 {rows.length} 道题
            </button>
          </div>
          <ul className="rev-list">
            {rows.map((row, index) => {
              const missing = answerMissing(row);
              const next = rows[index + 1];
              const canMerge = Boolean(next) && row.type !== 'matching'
                && next.type !== 'matching';
              const mergeTitle = !next ? '已经是最后一题'
                : !canMerge ? '匹配题不能与别的题合并' : '';
              return (
                <li className="rev" id={`review-row-${index + 1}`} key={row.draftId}>
                  <span className="no num">{String(index + 1).padStart(2, '0')}</span>
                  {editingIndex === index && editingInitial ? (
                    <div className="rev-edit">
                      <QuestionForm
                        mode="edit"
                        submitLabel="完成"
                        initialValue={editingInitial}
                        onSubmit={(input) => {
                          setRows((previous) => previous.map((item, i) =>
                            i === index ? inputToDraft(input, item) : item));
                          setEditingIndex(null);
                        }}
                        extraActions={(
                          <button
                            type="button"
                            className="btn"
                            onClick={() => setEditingIndex(null)}
                          >
                            取消
                          </button>
                        )}
                      />
                    </div>
                  ) : splittingIndex === index ? (
                    <div className="rev-edit">
                      <label className="field">
                        <span>把光标放在要分开的位置</span>
                        <textarea
                          ref={splitRef}
                          className="field-input"
                          value={splitStem}
                          autoFocus
                          onChange={(event) => setSplitStem(event.target.value)}
                        />
                      </label>
                      <div className="flex gap-[10px]">
                        <button
                          type="button"
                          className="btn btn-primary btn-small"
                          onClick={() => splitRow(index)}
                        >
                          从此处拆分
                        </button>
                        <button
                          type="button"
                          className="btn btn-small"
                          onClick={() => setSplittingIndex(null)}
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="body">
                        <div className="stem">
                          <span className="tiny-type">{TYPE_LABELS[row.type]}</span>
                          {row.stem}
                        </div>
                        <div className="optsline">
                          {row.type === 'matching'
                            ? matchingOptionsLine(row.sharedOptions, row.subQuestions)
                            : row.type === 'truefalse'
                              ? '（无选项，判断题固定「正确 / 错误」）'
                              : row.options.map((option) =>
                                `${option.letter}. ${option.text}`).join('　')}
                        </div>
                      </div>
                      <input
                        className={`ans ${missing ? 'miss' : ''}`}
                        aria-label={`第 ${index + 1} 题答案`}
                        placeholder="缺答案"
                        value={row.answerText}
                        onChange={(event) => {
                          const raw = event.target.value;
                          if (row.type === 'matching') {
                            const upper = raw.toUpperCase();
                            updateRow(index, {
                              answerText: upper,
                              subQuestions: splitMatchingAnswer(
                                upper, row.subQuestions ?? []),
                            });
                          } else {
                            updateRow(index, {
                              answerText: normalizeAnswer(raw, row.type),
                            });
                          }
                        }}
                      />
                      <div className="acts">
                        <button type="button" onClick={() => openEditor(index)}>
                          编辑题干
                        </button>
                        <button type="button" onClick={() => openEditor(index)}>
                          改题型
                        </button>
                        <button type="button" onClick={() => openSplit(index)}>
                          拆分
                        </button>
                        <button
                          type="button"
                          disabled={!canMerge}
                          title={mergeTitle}
                          onClick={() => mergeRow(index)}
                        >
                          与下一题合并
                        </button>
                        <button
                          type="button"
                          className="del"
                          onClick={() => setRows((previous) =>
                            previous.filter((_, i) => i !== index))}
                        >
                          删除
                        </button>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="toolbar mt-5">
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => {
                setStep(1);
                window.scrollTo({ top: 0 });
              }}
            >
              ← 重新粘贴
            </button>
          </div>
        </>
      )}

      {creating && (
        <Dialog
          title="新建分组"
          message="起个名字，之后录入和导入时都能选中它。"
          confirmLabel="创建"
          confirmDisabled={!newName.trim()}
          onConfirm={() => void createGroup()}
          onCancel={() => setCreating(false)}
        >
          <label className="field">
            <span>分组名</span>
            <input
              className="field-input w-full"
              autoFocus
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
            />
          </label>
        </Dialog>
      )}
    </>
  );
}
