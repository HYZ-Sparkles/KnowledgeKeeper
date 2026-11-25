import { describe, it, expect } from 'vitest';
import { createCore } from './index';
import { fixedRandom, memoryAdapter } from './helpers';
import type { Clock, QuestionInput } from './types';

function setup(iso = '2026-04-10T15:30:00') {
  const storage = memoryAdapter();
  let current = iso;
  const clock: Clock & { set: (value: string) => void } = {
    now: () => new Date(current),
    set: (value) => { current = value; },
  };
  const core = createCore({ storage, clock, random: fixedRandom(1) });
  return { core, storage, clock };
}

const single: QuestionInput = {
  type: 'single',
  stem: '备份里的单选题？',
  options: [{ letter: 'A', text: '甲' }, { letter: 'B', text: '乙' }],
  answer: ['B'],
  explanation: '这是解析。',
};

const matching: QuestionInput = {
  type: 'matching',
  stem: '把作者与作品对应起来',
  options: [],
  answer: [],
  explanation: '',
  sharedOptions: [
    { letter: 'A', text: '鲁迅' },
    { letter: 'B', text: '茅盾' },
  ],
  subQuestions: [
    { stem: '《呐喊》的作者', type: 'single', answer: ['A'] },
    { stem: '《子夜》的作者', type: 'single', answer: ['B'] },
  ],
};

describe('应用核心 · 导出备份', () => {
  it('备份字符串带版本号，含分组、题目、排期、收藏、作答与元数据且可解析', async () => {
    const { core, storage, clock } = setup();
    const english = await core.createGroup('英语');
    const choice = await core.createQuestion(single, english.id);
    await core.setFavorite(choice.id, true);
    const match = await core.createQuestion(matching, english.id);
    await core.submitAnswer(choice.id, ['A']);
    await core.submitAnswer(match.id, [['A'], ['A']]);
    await storage.putSchedule(match.id, { stage: 0, dueDate: null, completed: true });

    const parsed = JSON.parse(await core.backup());

    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.groups.map((g: { name: string }) => g.name)).toEqual([
      '错题集', '英语',
    ]);
    expect(parsed.questions.find((q: { id: string }) => q.id === choice.id))
      .toMatchObject({
        type: 'single',
        stem: '备份里的单选题？',
        options: [
          { letter: 'A', text: '甲' }, { letter: 'B', text: '乙' },
        ],
        answer: ['B'],
        explanation: '这是解析。',
        favorite: true,
        groupId: english.id,
      });
    expect(parsed.questions.find((q: { id: string }) => q.id === match.id))
      .toMatchObject({
        type: 'matching',
        sharedOptions: [
          { letter: 'A', text: '鲁迅' }, { letter: 'B', text: '茅盾' },
        ],
        subQuestions: matching.subQuestions,
      });
    expect(parsed.schedules[choice.id]).toEqual({
      stage: 1, dueDate: '2026-04-11',
    });
    expect(parsed.schedules[match.id]).toEqual({
      stage: 0, dueDate: null, completed: true,
    });
    expect(parsed.attempts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        questionId: choice.id, subIndex: null, correct: false,
      }),
      expect.objectContaining({ questionId: match.id, subIndex: 0 }),
      expect.objectContaining({ questionId: match.id, subIndex: 1 }),
    ]));
    expect(parsed.meta.lastBackupAt).toBe(clock.now().toISOString());
  });

  it('导出后题库元数据的上次备份时间是固定时钟的当前时间', async () => {
    const { core, clock } = setup('2026-04-10T15:30:00');
    expect((await core.getMeta()).lastBackupAt).toBeNull();

    await core.backup();

    expect((await core.getMeta()).lastBackupAt).toBe(clock.now().toISOString());
  });

  it('没有作答的题库也能导出', async () => {
    const { core } = setup();

    const parsed = JSON.parse(await core.backup());

    expect(parsed.groups).toHaveLength(1);
    expect(parsed.questions).toHaveLength(0);
    expect(parsed.attempts).toHaveLength(0);
    expect(parsed.meta.lastBackupAt).not.toBeNull();
  });

  it('备份文件名取注入时钟的本地日历日', () => {
    const { core } = setup('2026-04-10T15:30:00');
    expect(core.backupFileName()).toBe('KnowledgeKeeper-2026-04-10.json');
  });
});
