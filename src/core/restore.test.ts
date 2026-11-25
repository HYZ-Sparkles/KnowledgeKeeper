import { describe, it, expect } from 'vitest';
import { createCore } from './index';
import { fixedRandom, memoryAdapter } from './helpers';
import type { Clock, QuestionInput } from './types';

function setup(iso = '2026-05-01T10:00:00') {
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
  options: [{ letter: 'A', text: '甲' }, { letter: 'B', text: '乙' }],
  answer: ['B'],
  explanation: '解析',
};

const match: QuestionInput = {
  type: 'matching',
  stem: '匹配题干',
  options: [],
  answer: [],
  explanation: '',
  sharedOptions: [
    { letter: 'A', text: '甲' }, { letter: 'B', text: '乙' },
  ],
  subQuestions: [
    { stem: '子题一', type: 'single', answer: ['A'] },
    { stem: '子题二', type: 'single', answer: ['B'] },
  ],
};

async function seeded() {
  const ctx = setup();
  const extra = await ctx.core.createGroup('英语');
  const single = await ctx.core.createQuestion(choice, extra.id);
  const matching = await ctx.core.createQuestion(match, extra.id);
  await ctx.core.setFavorite(single.id, true);
  await ctx.core.submitAnswer(single.id, ['A']);
  await ctx.core.submitAnswer(matching.id, [['A'], ['B']]);
  await ctx.storage.putSchedule(matching.id, {
    stage: 0, dueDate: null, completed: true,
  });
  return { ...ctx, extra, single, matching };
}

describe('应用核心 · 从备份恢复', () => {
  it('备份 → 改动 → 恢复：分组、题目、排期、收藏、作答与元数据完全一致', async () => {
    const { core, storage, clock, extra, single, matching } = await seeded();
    const backup = await core.backup();
    const original = JSON.parse(backup);

    const added = await core.createGroup('临时的组');
    await core.createQuestion(choice, added.id);
    await core.setFavorite(matching.id, true);
    await core.deleteGroup(extra.id);
    await storage.putMeta({ lastBackupAt: '1999-01-01T00:00:00.000Z' });

    const summary = await core.restore(backup);

    expect(summary).toEqual({
      groups: original.groups.length,
      questions: original.questions.length,
      lastBackupAt: original.meta.lastBackupAt,
    });
    expect((await core.listGroups()).map((g) => g.group.name)).toEqual([
      '错题集', '英语',
    ]);
    const restoredQuestion = await core.getQuestion(single.id);
    expect(restoredQuestion.favorite).toBe(true);
    expect(restoredQuestion.schedule).toEqual({
      stage: 1, dueDate: '2026-05-02',
    });
    expect((await core.getQuestion(matching.id)).favorite).toBe(false);
    expect((await core.getMeta()).lastBackupAt)
      .toBe(original.meta.lastBackupAt);
    // 重新读取整库，逐字段比对备份时的内容（含子题序号与完成复习标记）。
    clock.set(original.meta.lastBackupAt);
    expect(JSON.parse(await core.backup())).toEqual(original);
  });

  it('恢复后旧的分组、题目和作答记录消失', async () => {
    const { core, extra, single } = await seeded();
    const backup = await core.backup();
    const added = await core.createGroup('只存在于改动后的组');
    await core.createQuestion(choice, added.id);
    const before = await core.getLibraryCounts();

    await core.restore(backup);

    const after = await core.getLibraryCounts();
    expect(after.questions).toBeLessThan(before.questions);
    expect((await core.listGroups()).map((g) => g.group.id)).not.toContain(added.id);
    expect((await core.listQuestions(extra.id)).map((q) => q.id))
      .toEqual([single.id, expect.any(String)]);
    expect((await core.listQuestions(added.id))).toHaveLength(0);
  });

  it('上次备份时间取自备份文件，而不是恢复时的时钟', async () => {
    const { core, clock, storage } = await seeded();
    const backup = await core.backup();
    const fromFile = JSON.parse(backup).meta.lastBackupAt;
    await storage.putMeta({ lastBackupAt: '2001-01-01T00:00:00.000Z' });
    clock.set('2030-01-01T00:00:00');

    await core.restore(backup);

    expect((await core.getMeta()).lastBackupAt).toBe(fromFile);
  });

  it('非法备份抛错且题库不变：损坏 JSON、不是备份、版本不支持', async () => {
    const { core, clock } = await seeded();
    const before = await core.backup();
    const wrongVersion = JSON.parse(before);
    wrongVersion.schemaVersion = 999;

    for (const bad of ['{ this is not json', '{"hello":"world"}', JSON.stringify(wrongVersion)]) {
      await expect(core.restore(bad)).rejects.toThrow();
    }

    clock.set(JSON.parse(before).meta.lastBackupAt);
    expect(await core.backup()).toBe(before);
  });

  it('inspectBackup 只读地给出分组与题目数，非法输入同样报错', async () => {
    const { core, extra } = await seeded();
    await core.createQuestion(choice, extra.id);
    const backup = await core.backup();

    expect(core.inspectBackup(backup)).toEqual({
      schemaVersion: 1,
      groups: 2,
      questions: 3,
      lastBackupAt: JSON.parse(backup).meta.lastBackupAt,
    });
    expect(() => core.inspectBackup('{ bad json')).toThrow();
    expect((await core.getMeta()).lastBackupAt)
      .toBe(JSON.parse(backup).meta.lastBackupAt);
  });
});
