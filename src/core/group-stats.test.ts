import { describe, it, expect } from 'vitest';
import { createCore } from './index';
import { fixedClock, fixedRandom, memoryAdapter } from './helpers';
import type { Question, QuestionType, StorageAdapter } from './types';

function setup() {
  const storage = memoryAdapter();
  const core = createCore({
    storage,
    clock: fixedClock('2026-10-14T09:00:00'),
    random: fixedRandom(),
  });
  return { core, storage };
}

const group = {
  id: 'g-stats', name: '计算机组成原理',
  createdAt: '2026-10-01T00:00:00.000Z',
};

const TYPES: Record<string, QuestionType> = {
  q1: 'single', q2: 'single',
  q3: 'multiple', q4: 'multiple',
  q5: 'truefalse', q6: 'truefalse',
  q7: 'matching', q8: 'matching',
};

async function seed(storage: StorageAdapter) {
  await storage.putGroup(group);
  for (const [id, type] of Object.entries(TYPES)) {
    const question: Question = {
      id, groupId: group.id, type, stem: `题 ${id}`,
      options: [
        { letter: 'A', text: '甲' }, { letter: 'B', text: '乙' },
      ],
      answer: ['B'], explanation: '', favorite: false,
      importOrder: Number(id.slice(1)),
      sharedOptions: type === 'matching'
        ? [{ letter: 'A', text: '甲' }] : null,
      subQuestions: type === 'matching'
        ? [{ stem: '子题', type: 'single', answer: ['A'] }] : null,
    };
    await storage.putQuestion(question);
  }
  const schedules: Record<string, { stage: number; dueDate: string | null; completed?: boolean }> = {
    q1: { stage: 1, dueDate: '2026-10-13' },
    q2: { stage: 2, dueDate: '2026-10-18' },
    q3: { stage: 6, dueDate: '2026-10-20' },
    q4: { stage: 0, dueDate: null, completed: true },
    q7: { stage: 3, dueDate: '2026-10-14' },
    q8: { stage: 4, dueDate: '2026-10-15' },
  };
  for (const [id, schedule] of Object.entries(schedules)) {
    await storage.putSchedule(id, schedule);
  }
  const attempts: Array<[string, boolean]> = [
    ['q1', true], ['q1', false],
    ['q2', true], ['q2', true],
    ['q3', true],
    ['q4', true], ['q4', true], ['q4', false],
    ['q5', true],
    ['q7', false],
  ];
  for (const [index, [questionId, correct]] of attempts.entries()) {
    await storage.putAttempt({
      id: `a${index + 1}`, questionId, subIndex: null,
      correct, at: '2026-10-10T09:00:00.000Z',
    });
  }
}

describe('应用核心 · 分组统计实时计算', () => {
  it('分组列表给出题数、正确率、到期数、在复习数、题型数与八个刻度', async () => {
    const { core, storage } = setup();
    await seed(storage);

    const [summary] = await core.listGroups();

    expect(summary).toMatchObject({
      questionCount: 8,
      dueCount: 2,
      inReviewCount: 5,
      correctRate: 0.7,
      typeCounts: { single: 2, multiple: 2, truefalse: 2, matching: 2 },
      // 1、2、4、7、15、30 天、完成复习、未排期，依次八格。
      distribution: [1, 1, 1, 1, 0, 1, 1, 2],
    });
  });

  it('没有作答的分组正确率为空，八格中只落未排期', async () => {
    const { core } = setup();
    const [empty] = await core.listGroups();

    expect(empty.correctRate).toBeNull();
    expect(empty.questionCount).toBe(0);
    expect(empty.distribution).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);

    const other = await core.createGroup('空白组');
    await core.createQuestion({
      type: 'single', stem: '新题',
      options: [
        { letter: 'A', text: '甲' }, { letter: 'B', text: '乙' },
      ],
      answer: ['B'], explanation: '',
    }, other.id);

    expect((await core.listGroups()).find(
      (g) => g.group.id === other.id,
    )).toMatchObject({
      questionCount: 1,
      correctRate: null,
      typeCounts: { single: 1, multiple: 0, truefalse: 0, matching: 0 },
      distribution: [0, 0, 0, 0, 0, 0, 0, 1],
    });
  });

  it('作答后统计随排期与作答实时变化，不读取存储里的缓存', async () => {
    const { core, storage } = setup();
    await seed(storage);

    const advanced = await core.submitAnswer('q1', ['B']);
    expect([advanced.before.stage, advanced.after.stage]).toEqual([1, 2]);

    const [summary] = await core.listGroups();
    expect(summary.dueCount).toBe(1);
    expect(summary.correctRate).toBeCloseTo(8 / 11);
    expect(summary.distribution).toEqual([0, 2, 1, 1, 0, 1, 1, 2]);
  });
});
