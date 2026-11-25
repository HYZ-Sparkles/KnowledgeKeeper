import { describe, it, expect } from 'vitest';
import { createCore } from './index';
import { fixedRandom, memoryAdapter } from './helpers';
import type { Clock, Question, QuestionInput } from './types';

function setup(iso = '2026-06-14T23:59:00') {
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
  stem: '单选题干？',
  options: [
    { letter: 'A', text: '甲' },
    { letter: 'B', text: '乙' },
  ],
  answer: ['B'],
  explanation: '',
};

function baseQuestion(id: string, groupId: string): Question {
  return {
    id, groupId, type: 'single', stem: `题 ${id}`,
    options: [
      { letter: 'A', text: '甲' }, { letter: 'B', text: '乙' },
    ],
    answer: ['B'], explanation: '', favorite: false, importOrder: Number(id.slice(1)),
    sharedOptions: null, subQuestions: null,
  };
}

describe('应用核心 · 固定时钟下的到期数与排期状态', () => {
  it('同一日历日 00:00 即算到期，分组列表与题目列表同步', async () => {
    const { core, clock } = setup();
    const [group] = await core.listGroups();
    const question = await core.createQuestion(choice, group.group.id);
    await core.submitAnswer(question.id, ['A']); // 答错：次日到期

    expect((await core.listGroups())[0].dueCount).toBe(0);
    clock.set('2026-06-15T00:00:00');

    const [summary] = await core.listGroups();
    expect(summary.dueCount).toBe(1);
    const [listed] = await core.listQuestions(group.group.id);
    expect(listed).toMatchObject({
      id: question.id,
      correctCount: 0,
      wrongCount: 1,
      schedule: { stage: 1, dueDate: '2026-06-15' },
    });
  });

  it('跨日仍未作答：昨天到期今天为逾期 1 天，仍计入到期数', async () => {
    const { core, storage } = setup('2026-06-16T09:00:00');
    const group = {
      id: 'g-due', name: '错题集', createdAt: '2026-06-01T00:00:00.000Z',
    };
    await storage.putGroup(group);
    await storage.putQuestion(baseQuestion('q1', group.id));
    await storage.putSchedule('q1', { stage: 3, dueDate: '2026-06-15' });
    await storage.putAttempt({
      id: 'a1', questionId: 'q1', subIndex: null,
      correct: false, at: '2026-06-10T09:00:00.000Z',
    });
    await storage.putAttempt({
      id: 'a2', questionId: 'q1', subIndex: null,
      correct: true, at: '2026-06-11T09:00:00.000Z',
    });

    expect((await core.listGroups())[0].dueCount).toBe(1);
    const [listed] = await core.listQuestions(group.id);
    expect(listed.schedule).toEqual({ stage: 3, dueDate: '2026-06-15' });
    expect([listed.correctCount, listed.wrongCount]).toEqual([1, 1]);
  });

  it('未排期与完成复习不计到期，题目列表给出真实状态与对错次数', async () => {
    const { core, storage } = setup('2026-06-16T09:00:00');
    const group = {
      id: 'g-states', name: '错题集', createdAt: '2026-06-01T00:00:00.000Z',
    };
    await storage.putGroup(group);
    for (const id of ['q1', 'q2', 'q3']) {
      await storage.putQuestion(baseQuestion(id, group.id));
    }
    await storage.putAttempt({
      id: 'a1', questionId: 'q1', subIndex: null,
      correct: true, at: '2026-06-10T09:00:00.000Z',
    });
    await storage.putAttempt({
      id: 'a2', questionId: 'q2', subIndex: null,
      correct: true, at: '2026-06-10T09:00:00.000Z',
    });
    await storage.putAttempt({
      id: 'a3', questionId: 'q2', subIndex: null,
      correct: false, at: '2026-06-11T09:00:00.000Z',
    });
    await storage.putSchedule('q2', { stage: 0, dueDate: null, completed: true });
    await storage.putSchedule('q3', { stage: 2, dueDate: '2026-06-20' });

    expect((await core.listGroups())[0].dueCount).toBe(0);
    const listed = await core.listQuestions(group.id);
    expect(listed.map((q) => [q.correctCount, q.wrongCount])).toEqual([
      [1, 0], [1, 1], [0, 0],
    ]);
  });
});
