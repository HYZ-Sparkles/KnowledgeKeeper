import { useEffect, useState } from 'react';
import type { Core } from '../core';
import type { GroupSummary, RoundItem, SubmitResult } from '../core/types';
import { navigate } from '../router';
import Breadcrumb from './Breadcrumb';
import {
  localDayString, scheduleConsequence, scheduleIsDue, scheduleLabel,
} from './scheduleCopy';

const TYPE_LABELS: Record<string, string> = {
  single: '单选题',
  multiple: '多选题',
  truefalse: '判断题',
  matching: '匹配题',
};

function formatLetters(letters: readonly string[]): string {
  return letters.join(' ');
}

/** One practice round; the core owns ordering, grading and scheduling. */
export default function PracticeView({
  core, groupId, groups, refreshGroups, onItemChange,
}: {
  core: Core;
  groupId: string;
  groups: GroupSummary[];
  refreshGroups: () => Promise<void>;
  onItemChange: (item: RoundItem | null) => void;
}) {
  const [items, setItems] = useState<RoundItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [subPicked, setSubPicked] = useState<string[][]>([]);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(false);
  const [tally, setTally] = useState({ correct: 0, wrong: 0 });
  const [dueLeft, setDueLeft] = useState(0);

  const groupName = groups.find((g) => g.group.id === groupId)?.group.name ?? '分组';

  function startRound() {
    setItems(null);
    setIndex(0);
    setPicked([]);
    setSubPicked([]);
    setResult(null);
    setFinished(false);
    setTally({ correct: 0, wrong: 0 });
    setDueLeft(0);
    void core.startRound(groupId).then((list) => {
      setItems(list);
      const today = localDayString(new Date());
      setDueLeft(list.filter((entry) =>
        scheduleIsDue(entry.schedule, today)).length);
    }, () => setItems([]));
  }

  useEffect(() => { startRound(); }, [core, groupId]);

  function leave() {
    navigate({ name: 'group', groupId });
    void refreshGroups();
  }

  function toggle(letter: string) {
    if (result) return;
    const item = items?.[index];
    if (!item) return;
    if (item.type === 'multiple') {
      setPicked((prev) => prev.includes(letter)
        ? prev.filter((value) => value !== letter)
        : [...prev, letter].sort());
    } else {
      setPicked((prev) => (prev[0] === letter ? [] : [letter]));
    }
  }

  function toggleSub(subIndex: number, type: 'single' | 'multiple', letter: string) {
    if (result) return;
    setSubPicked((prev) => {
      const current = prev[subIndex] ?? [];
      const chosen = type === 'multiple'
        ? (current.includes(letter)
          ? current.filter((value) => value !== letter)
          : [...current, letter].sort())
        : (current[0] === letter ? [] : [letter]);
      const next = [...prev];
      next[subIndex] = chosen;
      return next;
    });
  }

  async function submit() {
    const item = items?.[index];
    if (!item || result || submitting) return;
    const subs = item.type === 'matching' ? (item.subQuestions ?? []) : [];
    if (item.type === 'matching') {
      if (subs.some((_, position) => (subPicked[position]?.length ?? 0) === 0)) {
        return;
      }
    } else if (picked.length === 0) return;
    const answer = item.type === 'matching'
      ? subs.map((_, position) => subPicked[position] ?? [])
      : picked;
    const wasDue = scheduleIsDue(item.schedule, localDayString(new Date()));
    setSubmitting(true);
    try {
      const outcome = await core.submitAnswer(item.id, answer);
      setResult(outcome);
      if (wasDue) setDueLeft((count) => Math.max(0, count - 1));
      setTally((prev) => ({
        correct: prev.correct + (outcome.correct ? 1 : 0),
        wrong: prev.wrong + (outcome.correct ? 0 : 1),
      }));
      setItems((prev) => prev?.map((roundItem, position) => position === index
        ? {
          ...roundItem,
          correctCount: roundItem.correctCount + (outcome.correct ? 1 : 0),
          wrongCount: roundItem.wrongCount + (outcome.correct ? 0 : 1),
        }
        : roundItem) ?? null);
    } finally {
      setSubmitting(false);
    }
  }

  function next() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (items && index + 1 < items.length) {
      setIndex(index + 1);
      setPicked([]);
      setSubPicked([]);
      setResult(null);
    } else {
      setFinished(true);
    }
  }

  const item = items?.[index];

  useEffect(() => { onItemChange(item ?? null); }, [item, onItemChange]);

  const subs = item?.type === 'matching' ? (item.subQuestions ?? []) : [];
  const unanswered = subs.filter(
    (_, position) => (subPicked[position]?.length ?? 0) === 0,
  ).length;
  const canSubmit = item?.type === 'matching'
    ? subs.length > 0 && unanswered === 0
    : picked.length > 0;
  const hint = item?.type === 'matching'
    ? unanswered === subs.length
      ? `${subs.length} 个子题共用一组选项，全选完再提交`
      : unanswered > 0
        ? `还有 ${unanswered} 个子题没选`
        : '全部子题已选，可以提交'
    : picked.length > 0
      ? `已选 ${formatLetters(picked)}`
      : item?.type === 'multiple' ? '可多选，全对才算对' : '选一个再提交';
  const wrongSubs = (result?.subResults ?? [])
    .map((sub, position) => ({ sub, position }))
    .filter(({ sub }) => !sub.correct);
  const wrongMulti = wrongSubs.some(
    ({ position }) => subs[position]?.type === 'multiple',
  );

  return (
    <>
      <Breadcrumb trail={['我的题库', groupName, '练习']} />
      {items === null ? null : items.length === 0 ? (
        <>
          <h1 className="text-t40 font-bold text-ink-2 mb-3 tracking-[-.3px]">练习</h1>
          <p className="text-t14 text-faint">这一组还没有可练习的题。</p>
          <button className="btn mt-4" type="button"
            onClick={leave}>回到题目列表</button>
        </>
      ) : finished ? (
        <>
          <h1 className="text-t40 font-bold text-ink-2 mb-3 tracking-[-.3px]">练习</h1>
          <div>
            <h2 className="text-t16 font-semibold text-ink-2 m-0 mb-[14px]">
              本轮完成：{items.length} 道，对 {tally.correct} 错 {tally.wrong}。
            </h2>
            <div className="flex flex-wrap gap-[10px]">
              <button className="btn btn-primary" type="button"
                onClick={startRound}>开始下一轮</button>
              <button className="btn btn-ghost" type="button"
                onClick={leave}>回到题目列表</button>
            </div>
          </div>
        </>
      ) : item ? (
        <>
          <div className="practice-head">
            <span className="num">第 {index + 1} / {items.length}</span>
            <span className="bar">
              <i style={{ width: `${((index + 1) / items.length) * 100}%` }} />
            </span>
            <span>到期题 <b className="num font-semibold text-orange">{dueLeft}</b> 道未做</span>
            <span className="grow" />
            <button className="btn btn-ghost btn-small" type="button"
              onClick={leave}>退出练习</button>
          </div>
          <div className="qlabel">
            <span className="qtype">{TYPE_LABELS[item.type] ?? item.type}</span>
            <span className="num">
              {scheduleLabel(
                item.schedule, item.correctCount, item.wrongCount,
                localDayString(new Date()),
              )}
            </span>
          </div>
          <h2 className="qstem">{item.stem}</h2>
          {item.type === 'matching' ? (
            <div className="match">
              <div className="shared">
                <h3>共用选项</h3>
                <ol>
                  {item.sharedOptions?.map((option) => (
                    <li key={option.letter}>
                      <b>{option.letter}</b>
                      <span>{option.text}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <ul className="subs">
                {subs.map((sub, position) => {
                  const verdict = result?.subResults?.[position];
                  const chosen = subPicked[position] ?? [];
                  return (
                    <li className="sub" key={position}>
                      <div className="sub-q">
                        <i className="num">{position + 1}</i>
                        <span>{sub.stem}</span>
                        <span className="qtype">
                          {sub.type === 'multiple' ? '多选' : '单选'}
                        </span>
                      </div>
                      <div className="sub-opts">
                        {item.sharedOptions?.map((option) => {
                          const isAnswer = verdict?.correctAnswer.includes(option.letter)
                            ?? false;
                          const isMistake = !!verdict
                            && verdict.submitted.includes(option.letter)
                            && !isAnswer;
                          const classes = ['chip'];
                          if (verdict) {
                            if (isAnswer) classes.push('right');
                            if (isMistake) classes.push('wrong');
                          } else if (chosen.includes(option.letter)) {
                            classes.push('sel');
                          }
                          return (
                            <button
                              className={classes.join(' ')}
                              type="button"
                              key={option.letter}
                              disabled={!!result}
                              onClick={() => toggleSub(
                                position, sub.type, option.letter,
                              )}
                            >
                              {option.letter}
                            </button>
                          );
                        })}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <ul className="opts">
              {item.options.map((option) => {
                const isAnswer = result?.correctAnswer.includes(option.letter) ?? false;
                const isMistake = !!result
                  && picked.includes(option.letter) && !isAnswer;
                const classes = ['opt'];
                if (result) {
                  if (isAnswer) classes.push('right');
                  if (isMistake) classes.push('wrong');
                } else if (picked.includes(option.letter)) {
                  classes.push('sel');
                }
                return (
                  <li key={option.letter}>
                    <button className={classes.join(' ')} type="button"
                      disabled={!!result}
                      onClick={() => toggle(option.letter)}>
                      <span className="lt">{option.letter}</span>
                      <span className="tx">{option.text}</span>
                      {isAnswer && <span className="tick">正确答案</span>}
                      {isMistake && <span className="tick bad">你的选择</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {result ? (
            <div className={`feedback ${result.correct ? '' : 'bad'}`}>
              <div className="fb-head">{result.correct ? '答对' : '答错'}</div>
              <div className="fb-body">
                {item.type === 'matching' ? (
                  result.correct ? (
                    <>全部子题都答对了。</>
                  ) : (
                    <>第 {wrongSubs.map(({ position }) => position + 1).join('、')}{' '}
                      个子题错了，整道题算答错</>
                  )
                ) : result.correct ? (
                  <>正确答案 <b>{formatLetters(result.correctAnswer)}</b></>
                ) : (
                  <>你选的是 <b>{formatLetters(picked)}</b>，正确答案{' '}
                    <b>{formatLetters(result.correctAnswer)}</b></>
                )}
                <div className="mt-[4px]">{scheduleConsequence(result)}</div>
                {!result.correct && (item.type === 'multiple' || wrongMulti) && (
                  <div>漏选也算错。</div>
                )}
              </div>
              {item.explanation && (
                <div className="fb-exp"><b>解析</b>　{item.explanation}</div>
              )}
              <div className="fb-next">
                <button className="btn btn-small" type="button"
                  onClick={next}>下一题</button>
              </div>
            </div>
          ) : (
            <div className="submit-row">
              <button className="btn btn-primary" type="button"
                disabled={!canSubmit || submitting}
                onClick={() => void submit()}>提交</button>
              <span className="hintline">{hint}</span>
            </div>
          )}
        </>
      ) : null}
    </>
  );
}
