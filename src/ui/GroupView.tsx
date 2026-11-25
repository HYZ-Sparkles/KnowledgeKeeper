import { useEffect, useState } from 'react';
import type { Core } from '../core';
import type { GroupSummary, QuestionView } from '../core/types';
import { navigate } from '../router';
import Breadcrumb from './Breadcrumb';
import { writeEntryGroupId } from './deviceState';

const TYPE_LABELS: Record<string, string> = {
  single: '单选题',
  multiple: '多选题',
  truefalse: '判断题',
  matching: '匹配题',
};

export default function GroupView({
  core, groupId, groups,
}: {
  core: Core;
  groupId: string;
  groups: GroupSummary[];
}) {
  const [questions, setQuestions] = useState<QuestionView[] | null>(null);
  const summary = groups.find((g) => g.group.id === groupId);
  const name = summary?.group.name ?? '分组';

  useEffect(() => {
    let active = true;
    setQuestions(null);
    void core.listQuestions(groupId).then((list) => {
      if (active) setQuestions(list);
    });
    return () => { active = false; };
  }, [core, groupId]);

  function goToEntry() {
    writeEntryGroupId(groupId);
    navigate({ name: 'entry' });
  }

  return (
    <>
      <Breadcrumb trail={['我的题库', name]} />
      <h1 className="text-t40 font-bold text-ink-2 mb-3 tracking-[-.3px]">{name}</h1>
      <p className="text-t15 text-mute mb-[18px] max-w-[62ch]">
        {summary?.questionCount ?? 0} 道题，
        总体正确率 {summary?.correctRate == null ? '尚未练习' : `${Math.round(summary.correctRate * 100)}%`}，
        今天到期 {summary?.dueCount ?? 0} 道。到期题排在最前面，最久到期的先出。
      </p>
      <hr className="hairline" />
      {questions === null ? null : questions.length === 0 ? (
        <div className="flex flex-wrap items-center gap-[14px]">
          <p className="text-t14 text-faint m-0">这一组还没有题。</p>
          <button className="btn" type="button" onClick={goToEntry}>录入</button>
        </div>
      ) : (
        <ul className="dotlist list-none m-0 p-0">
          {questions.map((question) => (
            <li key={question.id}>
              <div className="row flex w-full items-baseline gap-[14px] py-[15px] text-left">
                <span className="qtype">{TYPE_LABELS[question.type] ?? question.type}</span>
                <span className="row-title flex-1 min-w-0">{question.stem}</span>
                <span className="meta flex-none text-t13 text-faint num w-[152px] text-right">
                  未排期
                </span>
                <span className="meta flex-none text-t13 text-mute num w-[74px] text-right">
                  {question.correctCount} 对 {question.wrongCount} 错
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
