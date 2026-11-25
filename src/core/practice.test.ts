import { describe, it, expect } from 'vitest';
import { createCore } from './index';
import { fixedClock, fixedRandom, memoryAdapter } from './helpers';
import type { QuestionInput } from './types';

function setup() {
  const storage = memoryAdapter();
  const core = createCore({
    storage,
    clock: fixedClock('2026-01-10T09:00:00Z'),
    random: fixedRandom(1),
  });
  return { core, storage };
}

function singleQuestion(stem: string, answer: string): QuestionInput {
  return {
    type: 'single',
    stem,
    options: [
      { letter: 'A', text: '甲' },
      { letter: 'B', text: '乙' },
      { letter: 'C', text: '丙' },
    ],
    answer: [answer],
    explanation: '',
  };
}

const multipleQuestion: QuestionInput = {
  type: 'multiple',
  stem: '哪些说法正确？',
  options: [
    { letter: 'A', text: '甲' },
    { letter: 'B', text: '乙' },
    { letter: 'C', text: '丙' },
  ],
  answer: ['A', 'B'],
  explanation: '多选解析',
};

const trueFalseQuestion: QuestionInput = {
  type: 'truefalse',
  stem: '这句话是对的。',
  options: [
    { letter: '√', text: '正确' },
    { letter: '×', text: '错误' },
  ],
  answer: ['√'],
  explanation: '',
};

const matchingQuestion: QuestionInput = {
  type: 'matching',
  stem: '把作者与作品对应起来',
  options: [],
  answer: [],
  explanation: '',
  sharedOptions: [
    { letter: 'A', text: '鲁迅' },
    { letter: 'B', text: '茅盾' },
  ],
  subQuestions: [{ stem: '《呐喊》的作者', type: 'single', answer: ['A'] }],
};

describe('应用核心 · 练习轮构建', () => {
  it('一轮含全部可练习题，按注入随机排序，匹配题不进轮', async () => {
    const { core } = setup();
    const [group] = await core.listGroups();
    const first = await core.createQuestion(
      singleQuestion('单选一？', 'A'), group.group.id,
    );
    const second = await core.createQuestion(multipleQuestion, group.group.id);
    const third = await core.createQuestion(trueFalseQuestion, group.group.id);
    await core.createQuestion(matchingQuestion, group.group.id);

    const round = await core.startRound(group.group.id);

    // fixedRandom(1)：建组与四道题消耗 10 次取样，余下取样令 3 项洗牌为 [1,2,0]。
    expect(round.map((item) => item.id)).toEqual([
      second.id, third.id, first.id,
    ]);
    expect(round).toHaveLength(3);
    expect(round.some((item) => item.type === 'matching')).toBe(false);
  });

  it('下一轮重新打乱；轮项自带完整内容、排期、对错次数与收藏', async () => {
    const { core } = setup();
    const [group] = await core.listGroups();
    const a = await core.createQuestion(
      singleQuestion('单选一？', 'A'), group.group.id,
    );
    const b = await core.createQuestion(
      singleQuestion('单选二？', 'B'), group.group.id,
    );
    const c = await core.createQuestion(
      singleQuestion('单选三？', 'C'), group.group.id,
    );

    const first = await core.startRound(group.group.id);
    const second = await core.startRound(group.group.id);

    expect(first.map((item) => item.id)).toEqual([c.id, b.id, a.id]);
    expect(second.map((item) => item.id)).toEqual([b.id, c.id, a.id]);
    expect(first.find((item) => item.id === a.id)).toMatchObject({
      stem: '单选一？',
      options: a.options,
      answer: a.answer,
      explanation: a.explanation,
      favorite: false,
      correctCount: 0,
      wrongCount: 0,
      schedule: { stage: 0, dueDate: null },
    });
  });
});

describe('应用核心 · 作答判定', () => {
  it('单选与判断题精确匹配一个字母', async () => {
    const { core } = setup();
    const [group] = await core.listGroups();
    const single = await core.createQuestion(
      singleQuestion('单选一？', 'A'), group.group.id,
    );
    const judged = await core.createQuestion(trueFalseQuestion, group.group.id);

    expect(await core.submitAnswer(single.id, ['A'])).toMatchObject({
      questionId: single.id, correct: true, correctAnswer: ['A'],
    });
    expect(await core.submitAnswer(single.id, ['B'])).toMatchObject({
      correct: false, correctAnswer: ['A'],
    });
    expect(await core.submitAnswer(judged.id, ['×'])).toMatchObject({
      correct: false, correctAnswer: ['√'],
    });
    expect(await core.submitAnswer(judged.id, ['√'])).toMatchObject({
      correct: true,
    });
  });

  it('多选按字母集合精确判定：漏选、多选都算错，顺序无关', async () => {
    const { core } = setup();
    const [group] = await core.listGroups();
    const question = await core.createQuestion(multipleQuestion, group.group.id);

    expect((await core.submitAnswer(question.id, ['A', 'B'])).correct).toBe(true);
    expect((await core.submitAnswer(question.id, ['B', 'A'])).correct).toBe(true);
    expect((await core.submitAnswer(question.id, ['A'])).correct).toBe(false);
    expect((await core.submitAnswer(question.id, ['A', 'B', 'C'])).correct)
      .toBe(false);
    expect((await core.submitAnswer(question.id, ['C'])).correct).toBe(false);
  });

  it('每次提交追加一条作答：子题序号为空，时间取自注入的时钟', async () => {
    const { core, storage } = setup();
    const [group] = await core.listGroups();
    const question = await core.createQuestion(
      singleQuestion('单选一？', 'A'), group.group.id,
    );

    await core.submitAnswer(question.id, ['A']);
    await core.submitAnswer(question.id, ['B']);

    const attempts = (await storage.getAttempts()).filter(
      (a) => a.questionId === question.id,
    );
    expect(attempts).toHaveLength(2);
    expect(attempts.map((a) => a.subIndex)).toEqual([null, null]);
    expect(attempts.map((a) => a.correct)).toEqual([true, false]);
    for (const attempt of attempts) {
      expect(attempt.at).toBe(new Date('2026-01-10T09:00:00Z').toISOString());
    }
  });

  it('题目行与轮项的对错次数由作答实时算出', async () => {
    const { core } = setup();
    const [group] = await core.listGroups();
    const question = await core.createQuestion(
      singleQuestion('单选一？', 'A'), group.group.id,
    );

    await core.submitAnswer(question.id, ['A']);
    await core.submitAnswer(question.id, ['B']);
    await core.submitAnswer(question.id, ['B']);

    const [listed] = await core.listQuestions(group.group.id);
    expect([listed.correctCount, listed.wrongCount]).toEqual([1, 2]);
    const [item] = await core.startRound(group.group.id);
    expect([item.correctCount, item.wrongCount]).toEqual([1, 2]);
  });
});
