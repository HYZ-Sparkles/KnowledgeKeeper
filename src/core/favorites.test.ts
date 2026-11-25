import { describe, it, expect } from 'vitest';
import { createCore } from './index';
import {
  fixedClock, fixedRandom, memoryAdapter, observeBackup,
} from './helpers';
import type { QuestionInput } from './types';

function seededCore(storage = memoryAdapter()) {
  const core = createCore({
    storage,
    clock: fixedClock('2026-04-01T09:00:00Z'),
    random: fixedRandom(1),
  });
  return { core, storage };
}

const choice = (stem: string): QuestionInput => ({
  type: 'single',
  stem,
  options: [{ letter: 'A', text: '甲' }, { letter: 'B', text: '乙' }],
  answer: ['B'],
  explanation: '',
});

const matching: QuestionInput = {
  type: 'matching',
  stem: '匹配题',
  options: [],
  answer: [],
  explanation: '',
  sharedOptions: [{ letter: 'A', text: '甲' }, { letter: 'B', text: '乙' }],
  subQuestions: [
    { stem: '子题一', type: 'single', answer: ['A'] },
    { stem: '子题二', type: 'single', answer: ['B'] },
  ],
};

describe('应用核心 · 收藏与只看收藏', () => {
  it('切换收藏后「只看收藏」恰好返回收藏的题目，取消后随之减少', async () => {
    const { core } = seededCore();
    const [group] = await core.listGroups();
    const a = await core.createQuestion(choice('甲'), group.group.id);
    const b = await core.createQuestion(choice('乙'), group.group.id);
    const c = await core.createQuestion(choice('丙'), group.group.id);
    const favoriteOnly = { favoriteOnly: true };

    expect(await core.listQuestions(group.group.id, favoriteOnly)).toEqual([]);
    expect(await core.setFavorite(b.id, true)).toMatchObject({
      id: b.id, favorite: true,
    });
    expect((await core.listQuestions(group.group.id, favoriteOnly))
      .map((q) => q.id)).toEqual([b.id]);
    await core.setFavorite(a.id, true);
    expect((await core.listQuestions(group.group.id, favoriteOnly))
      .map((q) => q.id)).toEqual([a.id, b.id]);
    await core.setFavorite(b.id, false);
    expect((await core.listQuestions(group.group.id, favoriteOnly))
      .map((q) => q.id)).toEqual([a.id]);
    expect((await core.listQuestions(group.group.id)).map((q) => q.id))
      .toEqual([a.id, b.id, c.id]);
  });

  it('匹配题以整题收藏，切换前后排期、轮顺序与作答记录不变', async () => {
    async function seeded() {
      const ctx = seededCore();
      const [group] = await ctx.core.listGroups();
      const match = await ctx.core.createQuestion(matching, group.group.id);
      await ctx.core.createQuestion(choice('单选题'), group.group.id);
      await ctx.storage.putSchedule(match.id, {
        stage: 2, dueDate: '2026-04-10',
      });
      await ctx.storage.putAttempt({
        id: 'a-match', questionId: match.id, subIndex: 0,
        correct: false, at: '2026-03-30T09:00:00.000Z',
      });
      return { ...ctx, group, match };
    }

    const watched = await seeded();
    const control = await seeded();
    const groupId = watched.group.group.id;
    const roundBefore = (await watched.core.startRound(groupId))
      .map((item) => item.id);
    const controlFirst = (await control.core.startRound(groupId))
      .map((item) => item.id);
    expect(roundBefore).toEqual(controlFirst);

    const toggled = await watched.core.setFavorite(watched.match.id, true);

    expect(toggled.favorite).toBe(true);
    expect(toggled.schedule).toEqual({ stage: 2, dueDate: '2026-04-10' });
    expect([toggled.correctCount, toggled.wrongCount]).toEqual([0, 1]);
    expect((await watched.core.listQuestions(groupId, { favoriteOnly: true }))
      .map((q) => q.id)).toEqual([watched.match.id]);
    const watchedBackup = await observeBackup(watched.core);
    const controlBackup = await observeBackup(control.core);
    expect(watchedBackup.schedules).toEqual(controlBackup.schedules);
    expect(watchedBackup.attempts).toEqual(controlBackup.attempts);

    const roundAfter = (await watched.core.startRound(groupId))
      .map((item) => item.id);
    const controlSecond = (await control.core.startRound(groupId))
      .map((item) => item.id);
    expect(roundAfter).toEqual(controlSecond);
    expect(roundAfter).toContain(watched.match.id);

    await watched.core.setFavorite(watched.match.id, false);
    expect(await watched.core.listQuestions(groupId, { favoriteOnly: true }))
      .toEqual([]);
    expect(await watched.core.getQuestion(watched.match.id))
      .toMatchObject({ favorite: false, schedule: toggled.schedule });
  });
});
