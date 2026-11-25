import { describe, it, expect } from 'vitest';
import { createCore } from './index';
import { fixedClock, fixedRandom, memoryAdapter } from './helpers';

function setup() {
  const storage = memoryAdapter();
  const core = createCore({
    storage,
    clock: fixedClock('2026-01-01T08:00:00Z'),
    random: fixedRandom(),
  });
  return { core, storage };
}

const question = {
  type: 'single' as const,
  stem: '单选题干？',
  options: [{ letter: 'A', text: '甲' }, { letter: 'B', text: '乙' }],
  answer: ['B'],
  explanation: '',
};

describe('应用核心 · 分组管理', () => {
  it('创建与重命名分组后，分组列表同步更新', async () => {
    const { core } = setup();
    const [initial] = await core.listGroups();

    const created = await core.createGroup('英语');
    expect(created.name).toBe('英语');
    expect((await core.listGroups()).map((g) => g.group.name)).toEqual([
      '错题集', '英语',
    ]);

    const renamed = await core.renameGroup(created.id, '英语阅读');
    const list = await core.listGroups();
    expect(renamed.name).toBe('英语阅读');
    expect(list.map((g) => g.group.name)).toEqual(['错题集', '英语阅读']);
    expect(list[1].group.createdAt).toBe(created.createdAt);
    expect(initial.group.name).toBe('错题集');
  });

  it('删除默认分组连带清掉题目、作答与排期，其他分组不受影响', async () => {
    const { core, storage } = setup();
    const [defaultGroup] = await core.listGroups();
    const other = await core.createGroup('其他');
    const own = await core.createQuestion(question, defaultGroup.group.id);
    const kept = await core.createQuestion(question, other.id);

    // 练习 seam 尚未实现，这里直接用存储适配器放进作答与排期作为初始状态。
    await storage.putSchedule(own.id, { stage: 2, dueDate: '2026-01-05' });
    await storage.putAttempt({
      id: 'attempt-own', questionId: own.id, subIndex: null,
      correct: false, at: '2026-01-01T08:00:00.000Z',
    });
    await storage.putSchedule(kept.id, { stage: 1, dueDate: '2026-01-02' });
    await storage.putAttempt({
      id: 'attempt-kept', questionId: kept.id, subIndex: null,
      correct: true, at: '2026-01-01T08:00:00.000Z',
    });

    await core.deleteGroup(defaultGroup.group.id);

    const list = await core.listGroups();
    expect(list.map((g) => g.group.id)).toEqual([other.id]);
    expect(await core.listQuestions(defaultGroup.group.id)).toEqual([]);
    const keptQuestions = await core.listQuestions(other.id);
    expect(keptQuestions.map((q) => q.id)).toEqual([kept.id]);
    expect(keptQuestions[0]).toMatchObject({
      correctCount: 1, wrongCount: 0,
      schedule: { stage: 1, dueDate: '2026-01-02' },
    });
    expect((await storage.getSchedules())[own.id]).toBeUndefined();
    expect((await storage.getAttempts()).some((a) => a.questionId === own.id))
      .toBe(false);
  });
});
