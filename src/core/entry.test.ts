import { describe, it, expect } from 'vitest';
import { createCore } from './index';
import { fixedClock, fixedRandom, memoryAdapter } from './helpers';
import type { QuestionInput } from './types';

function setup() {
  return createCore({
    storage: memoryAdapter(),
    clock: fixedClock('2026-01-01T08:00:00Z'),
    random: fixedRandom(),
  });
}

const single: QuestionInput = {
  type: 'single',
  stem: '下列哪一项正确？',
  options: [
    { letter: 'A', text: '甲' },
    { letter: 'B', text: '乙' },
  ],
  answer: ['B'],
  explanation: '',
};

describe('应用核心 · 手动录入', () => {
  it('录入单选题后，题目列表的内容与答案和录入一致', async () => {
    const core = setup();
    const [group] = await core.listGroups();

    const created = await core.createQuestion(single, group.group.id);
    const list = await core.listQuestions(group.group.id);

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: created.id,
      groupId: group.group.id,
      type: 'single',
      stem: '下列哪一项正确？',
      options: single.options,
      answer: ['B'],
      explanation: '',
      favorite: false,
      importOrder: 1,
    });
    expect(list[0].schedule).toEqual({ stage: 0, dueDate: null });
    expect(list[0].correctCount).toBe(0);
    expect(list[0].wrongCount).toBe(0);
  });

  it('多选题与判断题按录入顺序排在后面，答案解析可为空', async () => {
    const core = setup();
    const [group] = await core.listGroups();

    await core.createQuestion(single, group.group.id);
    const multiple = await core.createQuestion({
      type: 'multiple',
      stem: '哪些是选项？',
      options: [
        { letter: 'A', text: '甲' },
        { letter: 'B', text: '乙' },
        { letter: 'C', text: '丙' },
      ],
      answer: ['A', 'C'],
      explanation: '',
    }, group.group.id);
    const trueFalse = await core.createQuestion({
      type: 'truefalse',
      stem: '这句话是对的。',
      options: [
        { letter: '√', text: '正确' },
        { letter: '×', text: '错误' },
      ],
      answer: ['×'],
      explanation: '',
    }, group.group.id);

    const list = await core.listQuestions(group.group.id);
    expect(list.map((q) => q.id)).toEqual([
      expect.any(String), multiple.id, trueFalse.id,
    ]);
    expect(list.map((q) => q.importOrder)).toEqual([1, 2, 3]);
    expect(list[1]).toMatchObject({
      type: 'multiple',
      stem: '哪些是选项？',
      answer: ['A', 'C'],
      explanation: '',
    });
    expect(list[2]).toMatchObject({
      type: 'truefalse',
      answer: ['×'],
      options: [
        { letter: '√', text: '正确' },
        { letter: '×', text: '错误' },
      ],
    });
  });

  it('按 id 读取题目时返回完整内容', async () => {
    const core = setup();
    const [group] = await core.listGroups();
    const created = await core.createQuestion(single, group.group.id);

    expect(await core.getQuestion(created.id)).toEqual(created);
  });
});
