import { useEffect, useState } from 'react';
import type { Core } from '../core';
import type { GroupSummary, QuestionView } from '../core/types';
import { navigate } from '../router';
import Breadcrumb from './Breadcrumb';
import Dialog from './Dialog';
import { writeEntryGroupId } from './deviceState';
import {
  localDayString, scheduleIsDue, scheduleRowText,
} from './scheduleCopy';

const TYPE_LABELS: Record<string, string> = {
  single: '单选题',
  multiple: '多选题',
  truefalse: '判断题',
  matching: '匹配题',
};

/** The eight fixed ticks of the schedule distribution, in core order. */
const RULER_TICKS = [
  '1 天', '2 天', '4 天', '7 天', '15 天', '30 天', '完成复习', '未排期',
];

export default function GroupView({
  core, groupId, groups, refreshGroups, showToast,
}: {
  core: Core;
  groupId: string;
  groups: GroupSummary[];
  refreshGroups: () => Promise<void>;
  showToast: (message: string) => void;
}) {
  const [questions, setQuestions] = useState<QuestionView[] | null>(null);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameText, setRenameText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const summary = groups.find((g) => g.group.id === groupId);
  const name = summary?.group.name ?? '分组';
  const practiceCount = questions?.length ?? 0;
  const questionCount = summary?.questionCount ?? 0;
  const dueInGroup = summary?.dueCount ?? 0;
  const today = localDayString(new Date());
  const maxCount = Math.max(1, ...(summary?.distribution ?? []));

  useEffect(() => {
    let active = true;
    setQuestions(null);
    void core.listQuestions(groupId, { favoriteOnly }).then((list) => {
      if (active) setQuestions(list);
    });
    return () => { active = false; };
  }, [core, groupId, favoriteOnly]);

  function goToEntry() {
    writeEntryGroupId(groupId);
    navigate({ name: 'entry' });
  }

  async function rename() {
    await core.renameGroup(groupId, renameText);
    await refreshGroups();
    setRenaming(false);
  }

  async function remove() {
    await core.deleteGroup(groupId);
    navigate({ name: 'home' });
    await refreshGroups();
    setDeleting(false);
    showToast(`已删除「${name}」`);
  }

  return (
    <>
      <Breadcrumb trail={['我的题库', name]} />
      <h1 className="text-t40 font-bold text-ink-2 mb-3 tracking-[-.3px]">{name}</h1>
      <p className="text-t15 text-mute mb-[18px] max-w-[62ch]">
        {summary?.questionCount ?? 0} 道题，
        {summary?.correctRate == null
          ? '尚未练习'
          : `总体正确率 ${Math.round(summary.correctRate * 100)}%`}，
        今天到期 {summary?.dueCount ?? 0} 道。到期题排在最前面，最久到期的先出。
      </p>
      {summary && (
        <>
          <div className="pills">
            {(['single', 'multiple', 'truefalse', 'matching'] as const)
              .map((type) => summary.typeCounts[type] > 0 ? (
                <span className="pill bg-blue-wash text-blue-ink" key={type}>
                  {TYPE_LABELS[type]} <b className="num">{summary.typeCounts[type]}</b>
                </span>
              ) : null)}
          </div>
          <div className="sched">
            <div className="sched-h">
              排期分布 <b>{summary.questionCount} 道题</b>
            </div>
            <div className="ruler">
              {summary.distribution.map((count, tick) => {
                const height = count === 0
                  ? 2 : Math.round(10 + (count / maxCount) * 30);
                return (
                  <div
                    key={RULER_TICKS[tick]}
                    className={`${tick >= 6 ? 'rest' : ''} ${count === 0 ? 'zero' : ''}`}
                  >
                    <span>{count || ''}</span>
                    <i style={{ height: `${height}px` }} />
                  </div>
                );
              })}
            </div>
            <div className="sched-legend">
              {RULER_TICKS.map((label, tick) => (
                <div key={label} className={tick >= 6 ? 'rest' : ''}>{label}</div>
              ))}
            </div>
          </div>
        </>
      )}
      <div className="toolbar">
        <button
          className="btn btn-primary"
          type="button"
          disabled={practiceCount === 0}
          onClick={() => navigate({ name: 'practice', groupId })}
        >
          ▶ 开始练习
        </button>
        <span className="hintline">
          {practiceCount === 0
            ? '这一组还没有可练习的题，先录入或导入。'
            : dueInGroup > 0
              ? `到期 ${dueInGroup} 道先出，其余 ${questionCount - dueInGroup} 道打乱`
              : `没有到期的题，${questionCount} 道全部打乱`}
        </span>
        <div className="grow" />
        <button
          className={`switch ${favoriteOnly ? 'on' : ''}`}
          type="button"
          role="switch"
          aria-checked={favoriteOnly}
          onClick={() => setFavoriteOnly((prev) => !prev)}
        >
          <i />只看收藏
        </button>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() => { setRenameText(name); setRenaming(true); }}
        >
          重命名
        </button>
        <button
          className="btn btn-ghost btn-danger"
          type="button"
          onClick={() => setDeleting(true)}
        >
          删除分组
        </button>
      </div>
      <hr className="hairline" />
      {questions === null ? null : questions.length === 0 ? (
        <div className="flex flex-wrap items-center gap-[14px]">
          <p className="text-t14 text-faint m-0">
            {favoriteOnly ? '这一组还没有收藏的题。' : '这一组还没有题。'}
          </p>
          {!favoriteOnly && (
            <button className="btn" type="button" onClick={goToEntry}>录入</button>
          )}
        </div>
      ) : (
        <ul className="dotlist list-none m-0 p-0">
          {questions.map((question) => (
            <li key={question.id}>
              <button
                className="row flex w-full items-baseline gap-[14px] py-[15px] text-left"
                type="button"
                onClick={() => navigate({
                  name: 'question', questionId: question.id,
                })}
              >
                <span className="qtype">{TYPE_LABELS[question.type] ?? question.type}</span>
                <span className="row-title flex-1 min-w-0">{question.stem}</span>
                <span className={`meta flex-none text-t13_5 num w-[152px] text-right ${
                  scheduleIsDue(question.schedule, today) ? 'text-orange' : 'text-faint'
                }`}>
                  {scheduleRowText(question.schedule, today)}
                </span>
                <span className="meta flex-none text-t13_5 text-mute num w-[74px] text-right">
                  {question.correctCount} 对 {question.wrongCount} 错
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {renaming && (
        <Dialog
          title="重命名分组"
          message="改名只影响显示，题目和排期都不变。"
          confirmLabel="保存"
          confirmDisabled={!renameText.trim()}
          onConfirm={() => void rename()}
          onCancel={() => setRenaming(false)}
        >
          <label className="field">
            <span>分组名</span>
            <input
              className="field-input w-full"
              autoFocus
              value={renameText}
              onChange={(event) => setRenameText(event.target.value)}
            />
          </label>
        </Dialog>
      )}
      {deleting && (
        <Dialog
          title="删除分组"
          message={`删除「${name}」及其 ${summary?.questionCount ?? 0} 道题？不能撤销。`}
          confirmLabel="删除分组"
          destructive
          onConfirm={() => void remove()}
          onCancel={() => setDeleting(false)}
        />
      )}
    </>
  );
}
