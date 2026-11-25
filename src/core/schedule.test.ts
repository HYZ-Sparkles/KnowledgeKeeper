import { describe, it, expect } from 'vitest';
import { createCore } from './index';
import { fixedRandom, memoryAdapter, observeBackup } from './helpers';
import type { Clock, Question, QuestionInput } from './types';

function setup(iso = '2026-01-10T09:00:00') {
  const storage = memoryAdapter();
  let current = iso;
  const clock: Clock & { set: (value: string) => void } = {
    now: () => new Date(current),
    set: (value) => { current = value; },
  };
  const core = createCore({ storage, clock, random: fixedRandom(1) });
  return { core, storage, clock };
}

const choice: QuestionInput = {
  type: 'single',
  stem: '这道题后来做错了？',
  options: [
    { letter: 'A', text: '甲' },
    { letter: 'B', text: '乙' },
  ],
  answer: ['B'],
  explanation: '',
};

async function questionIn(core: Awaited<ReturnType<typeof setup>>['core']) {
  const [group] = await core.listGroups();
  return core.createQuestion(choice, group.group.id);
}

describe('应用核心 · 遗忘曲线状态机', () => {
  it('从未做错保持未排期；未排期答错进入第 1 个间隔，次日到期', async () => {
    const { core } = setup();
    const alwaysRight = await questionIn(core);
    const missed = await questionIn(core);

    const kept = await core.submitAnswer(alwaysRight.id, ['B']);
    expect(kept.before).toEqual({ stage: 0, dueDate: null });
    expect(kept.after).toEqual({ stage: 0, dueDate: null });
    expect((await observeBackup(core)).schedules[alwaysRight.id]).toBeUndefined();

    const entered = await core.submitAnswer(missed.id, ['A']);
    expect(entered.before).toEqual({ stage: 0, dueDate: null });
    expect(entered.after).toEqual({ stage: 1, dueDate: '2026-01-11' });
    expect((await observeBackup(core)).schedules[missed.id]).toEqual(entered.after);
  });

  it('到期答对依次推进 1、2、4、7、15、30 天，第六个间隔后完成复习', async () => {
    const { core, clock } = setup('2026-01-01T09:00:00');
    const question = await questionIn(core);

    const steps: Array<[string, string[]]> = [
      ['2026-01-01T09:00:00', ['A']],
      ['2026-01-02T09:00:00', ['B']],
      ['2026-01-04T09:00:00', ['B']],
      ['2026-01-08T09:00:00', ['B']],
      ['2026-01-15T09:00:00', ['B']],
      ['2026-01-30T09:00:00', ['B']],
      ['2026-03-01T09:00:00', ['B']],
    ];
    const results = [];
    for (const [when, answer] of steps) {
      clock.set(when);
      results.push(await core.submitAnswer(question.id, answer));
    }

    expect(results.map((r) => [r.before.stage, r.after.stage])).toEqual([
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0],
    ]);
    expect(results.slice(0, 6).map((r) => r.after.dueDate)).toEqual([
      '2026-01-02', '2026-01-04', '2026-01-08',
      '2026-01-15', '2026-01-30', '2026-03-01',
    ]);
    expect(results[6].after).toEqual({ stage: 0, dueDate: null, completed: true });
  });

  it('复习中答错回到第 1 个间隔；完成复习后答对不变、答错重新成为错题', async () => {
    const { core, clock } = setup('2026-01-01T09:00:00');
    const question = await questionIn(core);

    clock.set('2026-01-01T09:00:00');
    await core.submitAnswer(question.id, ['A']);          // 进入第 1 个间隔
    clock.set('2026-01-02T09:00:00');
    await core.submitAnswer(question.id, ['B']);          // 进第 2 个间隔
    clock.set('2026-01-04T09:00:00');
    const reset = await core.submitAnswer(question.id, ['A']);
    expect([reset.before.stage, reset.after.stage]).toEqual([2, 1]);
    expect(reset.after.dueDate).toBe('2026-01-05');

    clock.set('2026-01-05T09:00:00');
    await core.submitAnswer(question.id, ['B']);
    for (const when of [
      '2026-01-07', '2026-01-11', '2026-01-18', '2026-02-02', '2026-03-04',
    ]) {
      clock.set(`${when}T09:00:00`);
      await core.submitAnswer(question.id, ['B']);
    }
    const [completed] = await core.listQuestions(
      (await core.listGroups())[0].group.id,
    );
    expect(completed.schedule).toEqual({ stage: 0, dueDate: null, completed: true });

    clock.set('2026-03-05T09:00:00');
    const stayed = await core.submitAnswer(question.id, ['B']);
    expect(stayed.before).toEqual(stayed.after);
    const relapsed = await core.submitAnswer(question.id, ['A']);
    expect(relapsed.before).toEqual({ stage: 0, dueDate: null, completed: true });
    expect(relapsed.after).toEqual({ stage: 1, dueDate: '2026-03-06' });
  });

  it('本地日历日边界：23:59 答错，次日本地 00:00 到期', async () => {
    const { core, clock } = setup('2026-06-15T23:59:00');
    const question = await questionIn(core);

    const result = await core.submitAnswer(question.id, ['A']);

    expect(result.after.dueDate).toBe('2026-06-16');
    clock.set('2026-06-16T00:00:00');
    const [listed] = await core.listQuestions(
      (await core.listGroups())[0].group.id,
    );
    expect(listed.schedule.dueDate).toBe('2026-06-16');
    const dueRound = await core.startRound(
      (await core.listGroups())[0].group.id,
    );
    expect(dueRound.map((item) => item.id)).toEqual([question.id]);

    // 跨月与跨年同样按本地日历日推进。
    clock.set('2026-12-31T23:59:00');
    const yearEnd = await core.submitAnswer(question.id, ['A']);
    expect(yearEnd.after.dueDate).toBe('2027-01-01');
  });
});

describe('应用核心 · 到期优先的轮', () => {
  async function seeded() {
    const { core, storage } = setup('2026-01-10T09:00:00');
    const group = {
      id: 'g-test', name: '错题集', createdAt: '2026-01-01T00:00:00.000Z',
    };
    await storage.putGroup(group);
    const base = (id: string, favorite = false): Question => ({
      id, groupId: group.id, type: 'single', stem: `题 ${id}`,
      options: [
        { letter: 'A', text: '甲' }, { letter: 'B', text: '乙' },
      ],
      answer: ['B'], explanation: '', favorite, importOrder: Number(id.slice(1)),
      sharedOptions: null, subQuestions: null,
    });
    for (const id of ['q1', 'q2', 'q3', 'q4', 'q5']) {
      await storage.putQuestion(base(id, id === 'q3'));
    }
    await storage.putSchedule('q1', { stage: 1, dueDate: '2026-01-05' });
    await storage.putSchedule('q2', { stage: 3, dueDate: '2026-01-08' });
    await storage.putSchedule('q3', { stage: 2, dueDate: '2026-02-01' });
    for (const id of ['q1', 'q2', 'q3']) {
      await storage.putAttempt({
        id: `a-${id}`, questionId: id, subIndex: null,
        correct: true, at: '2026-01-01T00:00:00.000Z',
      });
    }
    return { core, storage };
  }

  it('到期题按到期日升序在前，其余按注入随机打乱，N 不漏题', async () => {
    const { core } = await seeded();

    const round = await core.startRound('g-test');

    // 到期 q1(01-05)、q2(01-08) 在前；其余 q3/q4/q5 洗牌为 [1,2,0]。
    expect(round.map((item) => item.id)).toEqual([
      'q1', 'q2', 'q4', 'q5', 'q3',
    ]);
    expect(round).toHaveLength(5);
    expect(round.find((item) => item.id === 'q3')).toMatchObject({
      stem: '题 q3',
      favorite: true,
      correctCount: 1,
      wrongCount: 0,
      schedule: { stage: 2, dueDate: '2026-02-01' },
    });
  });

  it('编辑有排期的题目只改内容，间隔与到期日不变', async () => {
    const { core } = await seeded();

    await core.updateQuestion('q1', {
      type: 'single', stem: '改过的题 q1',
      options: [
        { letter: 'A', text: '新甲' }, { letter: 'B', text: '新乙' },
      ],
      answer: ['A'], explanation: '新解析',
    });

    expect((await observeBackup(core)).schedules.q1).toEqual({
      stage: 1, dueDate: '2026-01-05',
    });
    expect((await core.getQuestion('q1')).schedule).toEqual({
      stage: 1, dueDate: '2026-01-05',
    });
  });
});
