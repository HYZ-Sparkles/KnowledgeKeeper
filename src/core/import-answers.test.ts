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

function numbered(count: number): string[] {
  return Array.from({ length: count }, (_, index) => [
    `${index + 1}. 第${index + 1}题`, 'A. 甲', 'B. 乙', 'C. 丙',
  ]).flat();
}

describe('应用核心 · 文本导入的答案段与判断题', () => {
  it('末尾逐题写法答案按顺序对应各题', async () => {
    const core = setup();
    const draft = await core.importFromText([
      '1. 单选题', 'A. 甲', 'B. 乙',
      '2. 多选题', 'A. 甲', 'B. 乙', 'C. 丙',
      '1A 2BC',
    ].join('\n'));

    expect(draft.questions.map((q) => q.type)).toEqual(['single', 'multiple']);
    expect(draft.questions.map((q) => q.answerText)).toEqual(['A', 'BC']);
    expect(draft.warnings).toEqual([]);
  });

  it('范围写法按题号 1:1 展开，范围与字母可以跨行', async () => {
    const core = setup();
    const draft = await core.importFromText([
      ...numbered(5),
      '1-3',
      'ABC',
      '4-5 BC',
    ].join('\n'));

    expect(draft.questions.map((q) => q.answerText)).toEqual([
      'A', 'B', 'C', 'B', 'C',
    ]);
    expect(draft.warnings).toEqual([]);
  });

  it('一行里的多个范围写法依次展开', async () => {
    const core = setup();
    const draft = await core.importFromText([
      ...numbered(10),
      '1-5 ABCAB 6-10 BCABC',
    ].join('\n'));

    expect(draft.questions.map((q) => q.answerText)).toEqual([
      'A', 'B', 'C', 'A', 'B', 'B', 'C', 'A', 'B', 'C',
    ]);
    expect(draft.warnings).toEqual([]);
  });

  it('范围长度与字母数不符时对应题标为缺答案并进警示', async () => {
    const core = setup();
    const [group] = await core.listGroups();
    const draft = await core.importFromText([
      ...numbered(3), '1-3 AB',
    ].join('\n'));

    expect(draft.questions.map((q) => q.missingAnswer)).toEqual([
      false, false, true,
    ]);
    expect(draft.warnings[0].questionNumbers).toEqual([3]);
    expect(draft.warnings[0].message).toContain('第 3 题缺答案');
    await expect(core.commitReview(draft, group.group.id)).rejects.toThrow();
    expect(await core.listQuestions(group.group.id)).toEqual([]);
  });

  it('没有选项行且答案为判断符号时识别为判断题', async () => {
    const core = setup();
    const [group] = await core.listGroups();
    const draft = await core.importFromText([
      '1. 地球是圆的。', '答案：√',
    ].join('\n'));

    expect(draft.questions[0]).toMatchObject({
      type: 'truefalse', answerText: '√', options: [], missingAnswer: false,
    });
    const written = await core.commitReview(draft, group.group.id);
    expect(written[0].answer).toEqual(['√']);
    expect(written[0].options).toEqual([
      { letter: '√', text: '正确' },
      { letter: '×', text: '错误' },
    ]);
  });

  it('选项写正确 / 错误或 √ / × 时推断为判断题', async () => {
    const core = setup();
    const [group] = await core.listGroups();
    const draft = await core.importFromText([
      '1. 补码的减法可以转换为加法。', 'A. 正确', 'B. 错误', '答案：A',
      '2. 计算机使用二进制。', 'A. √', 'B. ×', '答案：B',
    ].join('\n'));

    expect(draft.questions.map((q) => q.type)).toEqual([
      'truefalse', 'truefalse',
    ]);
    expect(draft.questions.map((q) => q.answerText)).toEqual(['√', '×']);
    expect(draft.warnings).toEqual([]);
    const written = await core.commitReview(draft, group.group.id);
    expect(written[0].options).toEqual([
      { letter: '√', text: '正确' }, { letter: '×', text: '错误' },
    ]);
    expect(written.map((q) => q.answer)).toEqual([['√'], ['×']]);
  });

  it('判断符号全部变体都规范成 √ 或 ×', async () => {
    const core = setup();
    const cases: [string, string][] = [
      ['√', '√'], ['×', '×'], ['对', '√'], ['错', '×'],
      ['正确', '√'], ['错误', '×'], ['T', '√'], ['F', '×'],
    ];
    for (const [index, [symbol, expected]] of cases.entries()) {
      const draft = await core.importFromText([
        `${index + 1}. 这是一道判断题。`, `答案：${symbol}`,
      ].join('\n'));
      expect(draft.questions[0].type, symbol).toBe('truefalse');
      expect(draft.questions[0].answerText, symbol).toBe(expected);
    }
  });

  it('混合题型的末尾答案块包含判断题也能全部识别', async () => {
    const core = setup();
    const draft = await core.importFromText([
      '1. 单选题', 'A. 甲', 'B. 乙',
      '2. 多选题', 'A. 甲', 'B. 乙', 'C. 丙',
      '3. 判断题',
      '答案：',
      '1B',
      '2AC',
      '3错',
    ].join('\n'));

    expect(draft.questions.map((q) => q.type)).toEqual([
      'single', 'multiple', 'truefalse',
    ]);
    expect(draft.questions.map((q) => q.answerText)).toEqual([
      'B', 'AC', '×',
    ]);
    expect(draft.warnings).toEqual([]);
  });
});
