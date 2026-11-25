import { describe, it, expect } from 'vitest';
import { createCore } from './index';
import { fixedRandom, memoryAdapter, observeBackup } from './helpers';
import type { Clock, QuestionInput } from './types';

function setup(iso = '2026-03-02T09:00:00') {
  const storage = memoryAdapter();
  let current = iso;
  const clock: Clock & { set: (value: string) => void } = {
    now: () => new Date(current),
    set: (value) => { current = value; },
  };
  const core = createCore({ storage, clock, random: fixedRandom(1) });
  return { core, storage, clock };
}

const matching: QuestionInput = {
  type: 'matching',
  stem: '把作者与作品对应起来',
  options: [],
  answer: [],
  explanation: '《呐喊》是小说集。',
  sharedOptions: [
    { letter: 'A', text: '鲁迅' },
    { letter: 'B', text: '茅盾' },
    { letter: 'C', text: '老舍' },
  ],
  subQuestions: [
    { stem: '《呐喊》的作者', type: 'single', answer: ['A'] },
    { stem: '《子夜》的作者', type: 'single', answer: ['B'] },
    { stem: '《骆驼祥子》的作者', type: 'single', answer: ['C'] },
  ],
};

const single: QuestionInput = {
  type: 'single',
  stem: '单选题干？',
  options: [{ letter: 'A', text: '甲' }, { letter: 'B', text: '乙' }],
  answer: ['B'],
  explanation: '',
};

describe('应用核心 · 匹配题进入练习轮', () => {
  it('匹配题进轮：到期匹配题排在最前，队列长度等于组内题数', async () => {
    const { core, storage } = setup();
    const [group] = await core.listGroups();
    const dueMatch = await core.createQuestion(matching, group.group.id);
    const other = await core.createQuestion(single, group.group.id);
    const restMatch = await core.createQuestion(matching, group.group.id);
    await storage.putSchedule(dueMatch.id, {
      stage: 1, dueDate: '2026-03-01',
    });

    const round = await core.startRound(group.group.id);

    expect(round[0].id).toBe(dueMatch.id);
    expect(round.map((item) => item.id)).toHaveLength(3);
    expect(new Set(round.map((item) => item.id))).toEqual(
      new Set([dueMatch.id, other.id, restMatch.id]),
    );
    expect((await core.listGroups())[0].dueCount).toBe(1);
  });
});

describe('应用核心 · 匹配题一次提交与逐子题判定', () => {
  async function seeded() {
    const ctx = setup();
    const [group] = await ctx.core.listGroups();
    const question = await ctx.core.createQuestion(matching, group.group.id);
    return { ...ctx, group, question };
  }

  it('全对整题对并推进排期，逐子题返回判定与正确答案', async () => {
    const { core, clock, question } = await seeded();

    const missed = await core.submitAnswer(question.id, [['A'], ['A'], ['A']]);
    expect(missed.correct).toBe(false);
    expect(missed.after).toEqual({ stage: 1, dueDate: '2026-03-03' });

    clock.set('2026-03-03T09:00:00');
    const passed = await core.submitAnswer(question.id, [['A'], ['B'], ['C']]);

    expect(passed.correct).toBe(true);
    expect(passed.before).toEqual({ stage: 1, dueDate: '2026-03-03' });
    expect(passed.after).toEqual({ stage: 2, dueDate: '2026-03-05' });
    expect(passed.subResults).toEqual([
      { subIndex: 0, correct: true, submitted: ['A'], correctAnswer: ['A'] },
      { subIndex: 1, correct: true, submitted: ['B'], correctAnswer: ['B'] },
      { subIndex: 2, correct: true, submitted: ['C'], correctAnswer: ['C'] },
    ]);
  });

  it('任一子题错则整题错、回到第 1 个间隔，作答条数等于子题数', async () => {
    const { core, clock, question } = await seeded();

    await core.submitAnswer(question.id, [['A'], ['A'], ['A']]);
    clock.set('2026-03-03T09:00:00');
    await core.submitAnswer(question.id, [['A'], ['B'], ['C']]);
    clock.set('2026-03-05T09:00:00');
    const before = (await observeBackup(core)).attempts.filter(
      (a) => a.questionId === question.id,
    ).length;
    const wrong = await core.submitAnswer(question.id, [['A'], ['B'], ['A']]);

    expect(wrong.correct).toBe(false);
    expect(wrong.before.stage).toBe(2);
    expect(wrong.after).toEqual({ stage: 1, dueDate: '2026-03-06' });
    expect(wrong.subResults?.map((sub) => sub.correct)).toEqual([
      true, true, false,
    ]);
    expect(wrong.subResults?.[2]).toMatchObject({
      subIndex: 2, submitted: ['A'], correctAnswer: ['C'],
    });

    const attempts = (await observeBackup(core)).attempts.filter(
      (a) => a.questionId === question.id,
    );
    expect(attempts.length - before).toBe(matching.subQuestions!.length);
    expect(attempts.slice(-3).map((a) => a.subIndex)).toEqual([0, 1, 2]);
    expect(attempts.slice(-3).map((a) => a.correct)).toEqual([
      true, true, false,
    ]);
  });

  it('多选子题按集合判定：漏选算错、顺序无关，时间取自注入时钟', async () => {
    const { core } = setup();
    const [group] = await core.listGroups();
    const question = await core.createQuestion({
      ...matching,
      subQuestions: [
        { stem: '多选子题', type: 'multiple', answer: ['A', 'C'] },
      ],
    }, group.group.id);

    const missing = await core.submitAnswer(question.id, [['A']]);
    expect(missing.correct).toBe(false);
    expect(missing.subResults?.[0].correct).toBe(false);

    const passed = await core.submitAnswer(question.id, [['C', 'A']]);
    expect(passed.correct).toBe(true);
    expect(passed.subResults?.[0]).toMatchObject({
      correct: true, correctAnswer: ['A', 'C'],
    });
    const attempts = (await observeBackup(core)).attempts.filter(
      (a) => a.questionId === question.id,
    );
    expect(attempts.map((a) => a.subIndex)).toEqual([0, 0]);
    for (const attempt of attempts) {
      expect(attempt.at).toBe(new Date('2026-03-02T09:00:00').toISOString());
    }
  });

  it('答案数量与子题数不符时拒绝提交，不写排期或作答', async () => {
    const { core, question } = await seeded();

    await expect(core.submitAnswer(question.id, [['A'], ['B']]))
      .rejects.toThrow();
    const snapshot = await observeBackup(core);
    expect(snapshot.attempts.filter(
      (a) => a.questionId === question.id,
    )).toHaveLength(0);
    expect(snapshot.schedules[question.id]).toBeUndefined();
  });
});
