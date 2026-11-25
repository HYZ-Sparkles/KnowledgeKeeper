import { describe, it, expect } from 'vitest';
import { createCore } from './index';
import {
  fixedClock, fixedRandom, memoryAdapter, observeBackup,
} from './helpers';
import type { QuestionInput } from './types';

function setup() {
  const storage = memoryAdapter();
  const core = createCore({
    storage,
    clock: fixedClock('2026-01-01T08:00:00Z'),
    random: fixedRandom(),
  });
  return { core, storage };
}

const question: QuestionInput = {
  type: 'single',
  stem: '单选题干？',
  options: [{ letter: 'A', text: '甲' }, { letter: 'B', text: '乙' }],
  answer: ['B'],
  explanation: '',
};

describe('应用核心 · 题目编辑与删除', () => {
  it('编辑题干、选项、答案和解析后排期与作答保持不变', async () => {
    const { core, storage } = setup();
    const [group] = await core.listGroups();
    const own = await core.createQuestion(question, group.group.id);

    // 练习 seam 尚未实现，直接用存储适配器放进初始排期与作答。
    await storage.putSchedule(own.id, { stage: 2, dueDate: '2026-01-05' });
    await storage.putAttempt({
      id: 'a-correct', questionId: own.id, subIndex: null,
      correct: true, at: '2026-01-01T08:00:00.000Z',
    });
    await storage.putAttempt({
      id: 'a-wrong', questionId: own.id, subIndex: null,
      correct: false, at: '2026-01-02T08:00:00.000Z',
    });

    const edited = await core.updateQuestion(own.id, {
      type: 'single',
      stem: '改过的题干？',
      options: [{ letter: 'A', text: '新甲' }, { letter: 'B', text: '新乙' }],
      answer: ['A'],
      explanation: '新解析',
    });

    expect(edited).toMatchObject({
      id: own.id,
      groupId: group.group.id,
      stem: '改过的题干？',
      options: [{ letter: 'A', text: '新甲' }, { letter: 'B', text: '新乙' }],
      answer: ['A'],
      explanation: '新解析',
      favorite: false,
      importOrder: 1,
      schedule: { stage: 2, dueDate: '2026-01-05' },
      correctCount: 1,
      wrongCount: 1,
    });
    expect(await core.getQuestion(own.id)).toEqual(edited);
    const snapshot = await observeBackup(core);
    expect(snapshot.schedules[own.id]).toEqual({
      stage: 2, dueDate: '2026-01-05',
    });
    expect(snapshot.attempts.map((a) => a.id).sort()).toEqual([
      'a-correct', 'a-wrong',
    ]);
  });

  it('删除题目连带清掉作答与排期，分组和其他题目不受影响', async () => {
    const { core, storage } = setup();
    const [group] = await core.listGroups();
    const other = await core.createGroup('其他');
    const own = await core.createQuestion(question, group.group.id);
    const sibling = await core.createQuestion(question, group.group.id);
    const kept = await core.createQuestion(question, other.id);

    for (const [id, stage, dueDate] of [
      [own.id, 2, '2026-01-05'],
      [sibling.id, 1, '2026-01-02'],
      [kept.id, 3, '2026-01-07'],
    ] as const) {
      await storage.putSchedule(id, { stage, dueDate });
      await storage.putAttempt({
        id: `attempt-${id}`, questionId: id, subIndex: null,
        correct: true, at: '2026-01-01T08:00:00.000Z',
      });
    }

    await core.deleteQuestion(own.id);

    expect((await core.listGroups()).map((g) => g.group.id)).toEqual([
      group.group.id, other.id,
    ]);
    const list = await core.listQuestions(group.group.id);
    expect(list.map((q) => q.id)).toEqual([sibling.id]);
    expect(list[0]).toMatchObject({
      schedule: { stage: 1, dueDate: '2026-01-02' },
      correctCount: 1, wrongCount: 0,
    });
    const keptList = await core.listQuestions(other.id);
    expect(keptList.map((q) => q.id)).toEqual([kept.id]);
    expect(keptList[0]).toMatchObject({
      schedule: { stage: 3, dueDate: '2026-01-07' },
      correctCount: 1, wrongCount: 0,
    });
    const snapshot = await observeBackup(core);
    expect(snapshot.schedules[own.id]).toBeUndefined();
    expect(snapshot.attempts.some((a) => a.questionId === own.id)).toBe(false);
  });
});
