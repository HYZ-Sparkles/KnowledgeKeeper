import { useEffect, useMemo, useState } from 'react';
import type { Core } from '../core';
import type {
  GroupSummary, QuestionInput, QuestionView as QuestionViewData,
} from '../core/types';
import { navigate } from '../router';
import Breadcrumb from './Breadcrumb';
import Dialog from './Dialog';
import { TYPE_LABELS } from './labels';
import QuestionForm from './QuestionForm';
import { localDayString, scheduleRowText } from './scheduleCopy';

/** The group list row opens here; the form is the same one used for entry. */
export default function QuestionPage({
  core, questionId, groups, refreshGroups, showToast,
}: {
  core: Core;
  questionId: string;
  groups: GroupSummary[];
  refreshGroups: () => Promise<void>;
  showToast: (message: string) => void;
}) {
  const [question, setQuestion] = useState<QuestionViewData | null>(null);
  const [missing, setMissing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    setQuestion(null);
    void core.getQuestion(questionId).then(
      (found) => { if (active) setQuestion(found); },
      () => { if (active) setMissing(true); },
    );
    return () => { active = false; };
  }, [core, questionId]);

  const initialValue = useMemo<QuestionInput | undefined>(() => question ? ({
    type: question.type,
    stem: question.stem,
    options: question.options,
    answer: question.answer,
    explanation: question.explanation,
    sharedOptions: question.sharedOptions,
    subQuestions: question.subQuestions,
  }) : undefined, [question]);

  const groupName = groups.find((g) => g.group.id === question?.groupId)
    ?.group.name ?? '分组';
  const back = () => navigate({
    name: 'group', groupId: question?.groupId ?? '',
  });

  async function save(input: QuestionInput) {
    await core.updateQuestion(questionId, input);
    showToast('已保存');
    back();
    await refreshGroups();
  }

  async function remove() {
    await core.deleteQuestion(questionId);
    setDeleting(false);
    back();
    await refreshGroups();
    showToast('已删除题目');
  }

  if (missing) return <p className="text-t14 text-faint">题目不存在。</p>;
  if (!question) return null;

  const today = localDayString(new Date());

  const actions = (
    <>
      <button className="btn btn-ghost" type="button" onClick={back}>取消</button>
      <button
        className="btn btn-ghost btn-danger ml-auto"
        type="button"
        onClick={() => setDeleting(true)}
      >
        删除题目
      </button>
    </>
  );

  return (
    <>
      <Breadcrumb trail={['我的题库', groupName, '题目']} />
      <h1 className="text-t40 font-bold text-ink-2 mb-3 tracking-[-.3px]">编辑题目</h1>
      <p className="flex flex-wrap items-center gap-[10px] text-t13_5 text-mute m-0">
        <span>{TYPE_LABELS[question.type]}</span>
        <span>·</span>
        <span>{scheduleRowText(question.schedule, today)}</span>
        <span>·</span>
        <span className="num">
          {question.correctCount} 对 {question.wrongCount} 错
        </span>
        <span>·</span>
        <span>{question.favorite ? '已收藏' : '未收藏'}</span>
      </p>
      <hr className="hairline" />
      <QuestionForm
        mode="edit"
        initialValue={initialValue}
        onSubmit={(input) => void save(input)}
        extraActions={actions}
      />
      {deleting && (
        <Dialog
          title="删除题目"
          message="删除这道题？它的作答记录和排期会一起删除，不能撤销。"
          confirmLabel="删除题目"
          destructive
          onConfirm={() => void remove()}
          onCancel={() => setDeleting(false)}
        />
      )}
    </>
  );
}
