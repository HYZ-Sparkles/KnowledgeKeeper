import { useEffect, useState } from 'react';
import type { Core } from '../core';
import type {
  DraftQuestion, GroupSummary, QuestionType, ReviewDraft,
} from '../core/types';
import { navigate } from '../router';
import Breadcrumb from './Breadcrumb';
import Dialog from './Dialog';
import { readImportGroupId, writeImportGroupId } from './deviceState';
import { defaultGroupId } from './entryGroups';

const TYPE_LABELS: Record<QuestionType, string> = {
  single: '单选题',
  multiple: '多选题',
  truefalse: '判断题',
  matching: '匹配题',
};

const TRUE_FALSE: Record<string, '√' | '×'> = {
  '√': '√', '对': '√', '正确': '√', 'T': '√',
  '×': '×', '错': '×', '错误': '×', 'F': '×',
};

/** Same normalization the core applies before writing: uppercase, no spaces. */
function normalizeAnswer(raw: string, type: QuestionType): string {
  const answer = raw.replace(/[\s　]+/g, '').toUpperCase();
  if (type === 'truefalse') return TRUE_FALSE[answer] ?? answer;
  return answer;
}

function answerMissing(question: DraftQuestion): boolean {
  const answer = normalizeAnswer(question.answerText, question.type);
  if (!answer) return true;
  if (question.type === 'truefalse') return answer !== '√' && answer !== '×';
  const letters = new Set(question.options.map((option) => option.letter));
  return [...answer].some((letter) => !letters.has(letter));
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
            disabled={busy || !groupId}
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
              className="btn btn-primary btn-small"
              disabled={missingNumbers.length > 0 || rows.length === 0}
              onClick={() => void commit()}
            >
              写入 {rows.length} 道题
            </button>
          </div>
          <ul className="rev-list">
            {rows.map((row, index) => {
              const missing = answerMissing(row);
              return (
                <li className="rev" id={`review-row-${index + 1}`} key={row.draftId}>
                  <span className="no num">{String(index + 1).padStart(2, '0')}</span>
                  <div className="body">
                    <div className="stem">
                      <span className="tiny-type">{TYPE_LABELS[row.type]}</span>
                      {row.stem}
                    </div>
                    <div className="optsline">
                      {row.type === 'truefalse'
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
                    onChange={(event) => updateRow(index, {
                      answerText: normalizeAnswer(event.target.value, row.type),
                    })}
                  />
                  <div className="acts">
                    <button
                      type="button"
                      className="del"
                      onClick={() => setRows((previous) =>
                        previous.filter((_, i) => i !== index))}
                    >
                      删除
                    </button>
                  </div>
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
