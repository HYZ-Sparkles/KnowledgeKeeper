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

describe('应用核心 · 粘贴文本导入', () => {
  it('解析带题号、选项与答案的题目为校对草稿', async () => {
    const core = setup();
    const draft = await core.importFromText([
      '1. 下列哪一项正确？',
      'A. 甲',
      'B. 乙',
      '答案：A',
    ].join('\n'));

    expect(draft.questions).toHaveLength(1);
    expect(draft.questions[0]).toMatchObject({
      sourceNo: 1,
      stem: '下列哪一项正确？',
      options: [{ letter: 'A', text: '甲' }, { letter: 'B', text: '乙' }],
      answerText: 'A',
      type: 'single',
      explanation: '',
      missingAnswer: false,
    });
    expect(draft.warnings).toEqual([]);
  });

  it('接受四种题号写法与三种选项字母写法', async () => {
    const core = setup();
    const draft = await core.importFromText([
      '1. 第一题', 'A、甲', 'B．乙', '答案：A',
      '2、第二题', 'A. 甲', 'B. 乙', '答案：B',
      '(3) 第三题', 'A. 甲', 'B. 乙', '答案：A',
      '04. 第四题', 'A. 甲', 'B. 乙', '答案：B',
    ].join('\n'));

    expect(draft.questions).toHaveLength(4);
    expect(draft.questions.map((q) => q.sourceNo)).toEqual([1, 2, 3, 4]);
    expect(draft.questions.map((q) => q.stem)).toEqual([
      '第一题', '第二题', '第三题', '第四题',
    ]);
    expect(draft.questions[0].options).toEqual([
      { letter: 'A', text: '甲' }, { letter: 'B', text: '乙' },
    ]);
    expect(draft.warnings).toEqual([]);
  });

  it('逐题写法答案既接受「答案：A」也接受「1A 2B」', async () => {
    const core = setup();
    const draft = await core.importFromText([
      '1. 第一题', 'A. 甲', 'B. 乙', '答案：A',
      '2. 第二题', 'A. 甲', 'B. 乙', '2B',
    ].join('\n'));

    expect(draft.questions.map((q) => q.answerText)).toEqual(['A', 'B']);
    expect(draft.warnings).toEqual([]);
  });

  it('题后紧跟的解析被提取，没有解析时留空', async () => {
    const core = setup();
    const draft = await core.importFromText([
      '1. 有解析的题', 'A. 甲', 'B. 乙', '答案：A',
      '解析：因为甲是对的。',
      '2. 没有解析的题', 'A. 甲', 'B. 乙', '答案：B',
    ].join('\n'));

    expect(draft.questions[0].explanation).toBe('因为甲是对的。');
    expect(draft.questions[1].explanation).toBe('');
  });

  it('答案有两个以上字母推断为多选题，一个字母推断为单选题', async () => {
    const core = setup();
    const draft = await core.importFromText([
      '1. 单选', 'A. 甲', 'B. 乙', '答案：B',
      '2. 多选', 'A. 甲', 'B. 乙', 'C. 丙', '答案：AC',
      '3. 选项带全角句点的多选', 'A．甲', 'B．乙', 'C．丙', '答案：ABC',
    ].join('\n'));

    expect(draft.questions.map((q) => q.type)).toEqual([
      'single', 'multiple', 'multiple',
    ]);
    expect(draft.questions[1].answerText).toBe('AC');
  });

  it('答案数与题数不符时草稿带警示并标红缺答案的题', async () => {
    const core = setup();
    const draft = await core.importFromText([
      '1. 第一题', 'A. 甲', 'B. 乙', '答案：A',
      '2. 第二题', 'A. 甲', 'B. 乙',
      '3. 第三题', 'A. 甲', 'B. 乙',
    ].join('\n'));

    expect(draft.questions.map((q) => q.missingAnswer)).toEqual([
      false, true, true,
    ]);
    expect(draft.warnings).toEqual([{
      code: 'ANSWER_COUNT_MISMATCH',
      severity: 'warn',
      questionNumbers: [2, 3],
      message: '识别到 3 道题，答案 1 个。第 2、3 题缺答案，标红了。',
    }]);
  });

  it('解析出 0 题时报错，不生成草稿', async () => {
    const core = setup();

    await expect(core.importFromText('这只是一段没有题号的文字。'))
      .rejects.toThrow(/没有识别到题目/);
  });

  it('写入前校验草稿：缺答案或字母越界都不写入任何题', async () => {
    const core = setup();
    const [group] = await core.listGroups();
    const draft = await core.importFromText([
      '1. 第一题', 'A. 甲', 'B. 乙', '答案：A',
      '2. 第二题', 'A. 甲', 'B. 乙',
    ].join('\n'));
    const blank = { ...draft, questions: draft.questions.map((q, i) => (
      i === 1 ? { ...q, answerText: '' } : q)) };
    const outOfRange = { ...draft, questions: draft.questions.map((q, i) => (
      i === 0 ? { ...q, answerText: 'C' } : q)) };

    await expect(core.commitReview(blank, group.group.id))
      .rejects.toThrow(/第 2 题/);
    await expect(core.commitReview(outOfRange, group.group.id))
      .rejects.toThrow(/第 1 题/);
    const emptyStem = { ...draft, questions: draft.questions.map((q, i) => (
      i === 0 ? { ...q, stem: '   ' } : q)) };
    await expect(core.commitReview(emptyStem, group.group.id))
      .rejects.toThrow(/题干/);
    expect(await core.listQuestions(group.group.id)).toEqual([]);
  });

  it('写入后题目列表与草稿一致并按导入顺序排列', async () => {
    const core = setup();
    const [group] = await core.listGroups();
    const draft = await core.importFromText([
      '1. 第一题', 'A. 甲', 'B. 乙', '答案：A',
      '2. 第二题', 'A. 甲', 'B. 乙', 'C. 丙', '答案：BC',
    ].join('\n'));

    const written = await core.commitReview(draft, group.group.id);
    const list = await core.listQuestions(group.group.id);

    expect(written.map((q) => q.stem)).toEqual(['第一题', '第二题']);
    expect(list.map((q) => q.stem)).toEqual(['第一题', '第二题']);
    expect(list.map((q) => q.importOrder)).toEqual([1, 2]);
    expect(list.map((q) => q.type)).toEqual(['single', 'multiple']);
    expect(list.map((q) => q.answer)).toEqual([['A'], ['B', 'C']]);
    expect(list[1].options).toEqual(draft.questions[1].options);
    expect(list[0].schedule).toEqual({ stage: 0, dueDate: null });
  });
});
