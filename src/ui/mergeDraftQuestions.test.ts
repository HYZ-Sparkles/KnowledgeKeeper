import { describe, it, expect } from 'vitest';
import type { DraftQuestion, Option } from '../core/types';
import { mergeDraftQuestions } from './mergeDraftQuestions';

function options(labels: string[]): Option[] {
  return labels.map((text, index) => ({
    letter: String.fromCharCode(65 + index),
    text,
  }));
}

function row(overrides: Partial<DraftQuestion> = {}): DraftQuestion {
  return {
    draftId: 'draft-1',
    sourceNo: 1,
    type: 'single',
    stem: '第一题',
    options: options(['甲', '乙']),
    answerText: 'A',
    explanation: '',
    missingAnswer: false,
    sharedOptions: null,
    subQuestions: null,
    ...overrides,
  };
}

describe('校对合并 · 选项重排与答案跟随', () => {
  it('第二行答案按第一行选项数偏移，两个答案合成多选题', () => {
    const merged = mergeDraftQuestions(
      row({
        stem: '第一题',
        options: options(['甲', '乙', '丙', '丁']),
        answerText: 'A',
        explanation: '因一',
      }),
      row({
        draftId: 'draft-2',
        sourceNo: 2,
        stem: '第二题',
        options: options(['子', '丑', '寅', '卯']),
        answerText: 'B',
        explanation: '因二',
      }),
    );

    expect(merged.options.map((option) => option.letter)).toEqual([
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H',
    ]);
    expect(merged.options.map((option) => option.text)).toEqual([
      '甲', '乙', '丙', '丁', '子', '丑', '寅', '卯',
    ]);
    expect(merged.answerText).toBe('AF');
    expect(merged.type).toBe('multiple');
    expect(merged.stem).toBe('第一题\n第二题');
    expect(merged.explanation).toBe('因一\n因二');
  });

  it('只有一个答案时保持单选题', () => {
    const merged = mergeDraftQuestions(
      row(),
      row({ draftId: 'draft-2', sourceNo: 2, answerText: '' }),
    );

    expect(merged.options.map((option) => option.letter)).toEqual([
      'A', 'B', 'C', 'D',
    ]);
    expect(merged.answerText).toBe('A');
    expect(merged.type).toBe('single');
  });

  it('多选题答案跨行合并后仍精确跟随原选项', () => {
    const merged = mergeDraftQuestions(
      row({ answerText: 'AB' }),
      row({
        draftId: 'draft-2',
        sourceNo: 2,
        options: options(['甲', '乙', '丙']),
        answerText: 'ABC',
      }),
    );

    expect(merged.answerText).toBe('ABCDE');
    expect(merged.type).toBe('multiple');
  });
});
