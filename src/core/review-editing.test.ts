import { describe, it, expect } from 'vitest';
import { createCore } from './index';
import { fixedClock, fixedRandom, memoryAdapter } from './helpers';
import type { DraftQuestion, ReviewDraft } from './types';

function setup() {
  const core = createCore({
    storage: memoryAdapter(),
    clock: fixedClock('2026-01-01T08:00:00Z'),
    random: fixedRandom(),
  });
  return { core, groupId: '' };
}

async function ready() {
  const context = setup();
  const [group] = await context.core.listGroups();
  context.groupId = group.group.id;
  return context;
}

function row(patch: Partial<DraftQuestion>): DraftQuestion {
  return {
    draftId: `draft-${patch.sourceNo ?? 1}`,
    sourceNo: 1,
    type: 'single',
    stem: '',
    options: [],
    answerText: '',
    explanation: '',
    missingAnswer: false,
    sharedOptions: null,
    subQuestions: null,
    ...patch,
  };
}

function draft(questions: DraftQuestion[]): ReviewDraft {
  return { questions, warnings: [] };
}

describe('应用核心 · 校对草稿编辑后写入', () => {
  it('拆分出的缺答案题会拦住写入，补上答案后按拆分结果写入两题', async () => {
    const { core, groupId } = await ready();
    const questions = [
      row({
        sourceNo: 1, stem: '前半句', type: 'single',
        options: [{ letter: 'A', text: '甲' }, { letter: 'B', text: '乙' }],
        answerText: 'A',
      }),
      row({ sourceNo: 2, stem: '后半句', type: 'single' }),
    ];

    await expect(core.commitReview(draft(questions), groupId))
      .rejects.toThrow(/第 2 题/);
    expect(await core.listQuestions(groupId)).toEqual([]);

    questions[1] = {
      ...questions[1],
      options: [{ letter: 'A', text: '丙' }, { letter: 'B', text: '丁' }],
      answerText: 'B',
    };
    const list = await core.commitReview(draft(questions), groupId);
    expect(list.map((question) => question.stem)).toEqual(['前半句', '后半句']);
    expect(list.map((question) => question.answer)).toEqual([['A'], ['B']]);
  });

  it('合并后的题干、重排字母的选项与答案、解析按编辑结果写入一题', async () => {
    const { core, groupId } = await ready();
    const merged = row({
      sourceNo: 1,
      type: 'multiple',
      stem: '第一半\n第二半',
      options: [
        { letter: 'A', text: '甲' }, { letter: 'B', text: '乙' },
        { letter: 'C', text: '丙' }, { letter: 'D', text: '丁' },
        { letter: 'E', text: '戊' },
      ],
      answerText: 'ACE',
      explanation: '解析一\n解析二',
    });

    const list = await core.commitReview(draft([merged]), groupId);

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      type: 'multiple',
      stem: '第一半\n第二半',
      answer: ['A', 'C', 'E'],
      explanation: '解析一\n解析二',
    });
    expect(list[0].options).toEqual([
      { letter: 'A', text: '甲' }, { letter: 'B', text: '乙' },
      { letter: 'C', text: '丙' }, { letter: 'D', text: '丁' },
      { letter: 'E', text: '戊' },
    ]);
    expect(list[0].importOrder).toBe(1);
  });

  it('多选改单选后答案清空会拦住写入，重选单个答案才写入', async () => {
    const { core, groupId } = await ready();
    const edited = row({
      sourceNo: 1,
      type: 'single',
      stem: '改题型后的题',
      options: [
        { letter: 'A', text: '甲' }, { letter: 'B', text: '乙' },
        { letter: 'C', text: '丙' },
      ],
      answerText: '',
    });

    await expect(core.commitReview(draft([edited]), groupId))
      .rejects.toThrow(/第 1 题/);
    expect(await core.listQuestions(groupId)).toEqual([]);

    edited.answerText = 'C';
    const list = await core.commitReview(draft([edited]), groupId);
    expect(list[0]).toMatchObject({ type: 'single', answer: ['C'] });
  });

  it('转成判断题后答案清空会拦住写入，选 √ 后写入固定选项', async () => {
    const { core, groupId } = await ready();
    const edited = row({
      sourceNo: 1, type: 'truefalse', stem: '这是一道判断题', answerText: '',
    });

    await expect(core.commitReview(draft([edited]), groupId))
      .rejects.toThrow(/第 1 题/);
    expect(await core.listQuestions(groupId)).toEqual([]);

    edited.answerText = '√';
    const list = await core.commitReview(draft([edited]), groupId);
    expect(list[0]).toMatchObject({ type: 'truefalse', answer: ['√'] });
    expect(list[0].options).toEqual([
      { letter: '√', text: '正确' }, { letter: '×', text: '错误' },
    ]);
  });

  it('匹配题被改成别的题型、丢掉共用选项和子题时拒绝写入', async () => {
    const { core, groupId } = await ready();
    const broken = row({
      sourceNo: 1, type: 'single', stem: '匹配题被错误改型',
      options: [], answerText: '',
      sharedOptions: null, subQuestions: null,
    });

    await expect(core.commitReview(draft([broken]), groupId))
      .rejects.toThrow(/第 1 题/);
    expect(await core.listQuestions(groupId)).toEqual([]);
  });
});
