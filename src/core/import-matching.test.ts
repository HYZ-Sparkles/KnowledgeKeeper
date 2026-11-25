import { describe, it, expect } from 'vitest';
import { createCore } from './index';
import { fixedClock, fixedRandom, memoryAdapter } from './helpers';

function setup() {
  return createCore({
    storage: memoryAdapter(),
    clock: fixedClock('2026-01-01T08:00:00Z'),
    random: fixedRandom(),
  });
}

const SHARED_LINES = [
  '共用选项：',
  'A. 原码',
  'B. 反码',
  'C. 补码',
  'D. 移码',
];

describe('应用核心 · 文本导入匹配题', () => {
  it('共用选项块与编号子题解析为一道匹配题，按序号带上答案', async () => {
    const core = setup();
    const draft = await core.importFromText([
      '5. 把编码方式与描述对应起来',
      ...SHARED_LINES,
      '1. 符号位加数值位（单选）',
      '2. 负数由原码取反加一得到（多选）',
      '答案：1 A　2 BC',
    ].join('\n'));

    expect(draft.questions).toHaveLength(1);
    expect(draft.questions[0]).toMatchObject({
      sourceNo: 5,
      type: 'matching',
      stem: '把编码方式与描述对应起来',
      answerText: '1 A　2 BC',
      missingAnswer: false,
      explanation: '',
    });
    expect(draft.questions[0].sharedOptions).toEqual([
      { letter: 'A', text: '原码' },
      { letter: 'B', text: '反码' },
      { letter: 'C', text: '补码' },
      { letter: 'D', text: '移码' },
    ]);
    expect(draft.questions[0].subQuestions).toEqual([
      { stem: '符号位加数值位', type: 'single', answer: ['A'] },
      { stem: '负数由原码取反加一得到', type: 'multiple', answer: ['B', 'C'] },
    ]);
    expect(draft.warnings).toEqual([]);
  });

  it('未标注单选多选的子题由答案字母数推断题型', async () => {
    const core = setup();
    const draft = await core.importFromText([
      ...SHARED_LINES,
      '1. 符号位加数值位',
      '2. 负数由原码取反加一得到',
      '1 A　2 BC',
    ].join('\n'));

    expect(draft.questions[0].subQuestions).toEqual([
      { stem: '符号位加数值位', type: 'single', answer: ['A'] },
      { stem: '负数由原码取反加一得到', type: 'multiple', answer: ['B', 'C'] },
    ]);
    expect(draft.warnings).toEqual([]);
  });

  it('写入后仍是一道匹配题，结构与手动录入一致', async () => {
    const core = setup();
    const [group] = await core.listGroups();
    const draft = await core.importFromText([
      '把编码方式与描述对应起来',
      ...SHARED_LINES,
      '1. 符号位加数值位（单选）',
      '2. 负数取反加一（多选）',
      '答案：1 A　2 BC',
    ].join('\n'));

    const written = await core.commitReview(draft, group.group.id);
    const list = await core.listQuestions(group.group.id);

    expect(written).toHaveLength(1);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      type: 'matching',
      stem: '把编码方式与描述对应起来',
      options: [],
      answer: [],
      sharedOptions: draft.questions[0].sharedOptions,
      subQuestions: draft.questions[0].subQuestions,
    });
    expect(list[0].schedule).toEqual({ stage: 0, dueDate: null });
  });

  it('缺任一子题答案时该题标红并进警示，且拒绝写入', async () => {
    const core = setup();
    const [group] = await core.listGroups();
    const draft = await core.importFromText([
      ...SHARED_LINES,
      '1. 符号位加数值位（单选）',
      '2. 负数取反加一（多选）',
      '答案：1 A',
    ].join('\n'));

    expect(draft.questions[0].missingAnswer).toBe(true);
    expect(draft.warnings).toEqual([{
      code: 'ANSWER_COUNT_MISMATCH',
      severity: 'warn',
      questionNumbers: [1],
      message: '识别到 1 道题，答案 0 个。第 1 题缺答案，标红了。',
    }]);
    await expect(core.commitReview(draft, group.group.id)).rejects.toThrow(/第 1 题/);
    expect(await core.listQuestions(group.group.id)).toEqual([]);
  });

  it('子题答案字母不在共用选项范围内按缺答案处理', async () => {
    const core = setup();
    const draft = await core.importFromText([
      ...SHARED_LINES,
      '1. 符号位加数值位（单选）',
      '2. 负数取反加一（多选）',
      '答案：1 E　2 BC',
    ].join('\n'));

    expect(draft.questions[0].answerText).toBe('1 E　2 BC');
    expect(draft.questions[0].missingAnswer).toBe(true);
    expect(draft.warnings[0].questionNumbers).toEqual([1]);
  });

  it('匹配题与普通题混排时各自成题，互不影响题号与答案', async () => {
    const core = setup();
    const [group] = await core.listGroups();
    const draft = await core.importFromText([
      '1. 单选题', 'A. 甲', 'B. 乙', '答案：A',
      '2. 匹配题',
      ...SHARED_LINES,
      '1. 符号位加数值位（单选）',
      '2. 负数取反加一（多选）',
      '答案：1 A　2 BC',
      '3. 判断题', '答案：√',
    ].join('\n'));

    expect(draft.questions.map((q) => q.type)).toEqual([
      'single', 'matching', 'truefalse',
    ]);
    expect(draft.questions.map((q) => q.answerText)).toEqual([
      'A', '1 A　2 BC', '√',
    ]);
    expect(draft.warnings).toEqual([]);

    const list = await core.commitReview(draft, group.group.id);
    expect(list.map((q) => q.type)).toEqual(['single', 'matching', 'truefalse']);
    expect(list.map((q) => q.answer)).toEqual([['A'], [], ['√']]);
    expect(list[1].subQuestions).toHaveLength(2);
  });
});
