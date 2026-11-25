import { describe, it, expect } from 'vitest';
import type { Schedule, SubmitResult } from '../core/types';
import {
  rulerCells, rulerNote, scheduleConsequence, scheduleLabel, scheduleText,
} from './scheduleCopy';

const unscheduled: Schedule = { stage: 0, dueDate: null };
const complete: Schedule = { stage: 0, dueDate: null, completed: true };

function outcome(
  before: Schedule, after: Schedule, correct: boolean,
): SubmitResult {
  return {
    questionId: 'q', correct, correctAnswer: ['A'], before, after,
  };
}

describe('练习反馈 · 排期后果七行文案', () => {
  it('未排期：答对不排期，答错进入第 1 个间隔', () => {
    expect(scheduleConsequence(outcome(unscheduled, unscheduled, true)))
      .toBe('从没做错过，不排期，只跟着轮次出现。');
    expect(scheduleConsequence(outcome(
      unscheduled, { stage: 1, dueDate: '2026-10-14' }, false,
    ))).toBe('进入第 1 个间隔，明天再出现。');
  });

  it('复习中答对：进入下一间隔并写出天数与到期日', () => {
    const result = outcome(
      { stage: 3, dueDate: '2026-10-12' },
      { stage: 4, dueDate: '2026-10-21' }, true,
    );
    expect(scheduleConsequence(result))
      .toBe('进入第 4 个间隔，7 天后（10 月 21 日）再出现。');
  });

  it('第 6 个间隔答对完成复习；复习中答错回到第 1 个间隔', () => {
    expect(scheduleConsequence(outcome(
      { stage: 6, dueDate: '2026-10-12' }, complete, true,
    ))).toBe('通过最后一个间隔，完成复习，不再排期。');
    expect(scheduleConsequence(outcome(
      { stage: 3, dueDate: '2026-10-12' },
      { stage: 1, dueDate: '2026-10-14' }, false,
    ))).toBe('回到第 1 个间隔，明天再出现。');
  });

  it('完成复习：答对不再排期，答错重新成为错题', () => {
    expect(scheduleConsequence(outcome(complete, complete, true)))
      .toBe('已完成复习，不再排期。');
    expect(scheduleConsequence(outcome(
      complete, { stage: 1, dueDate: '2026-10-14' }, false,
    ))).toBe('完成复习后再答错，重新成为错题，回到第 1 个间隔，明天再出现。');
  });
});

describe('练习标签行与右轨', () => {
  it('标签行区分复习中、未排期、完成复习与逾期', () => {
    expect(scheduleLabel(
      { stage: 3, dueDate: '2026-10-12' }, 5, 2, '2026-10-12',
    )).toBe('第 3 个间隔 · 今天到期 · 5 对 2 错');
    expect(scheduleLabel(
      { stage: 3, dueDate: '2026-10-12' }, 5, 2, '2026-10-10',
    )).toBe('第 3 个间隔 · 10 月 12 日到期 · 5 对 2 错');
    expect(scheduleLabel(
      { stage: 3, dueDate: '2026-10-12' }, 5, 2, '2026-10-14',
    )).toBe('第 3 个间隔 · 逾期 2 天 · 5 对 2 错');
    expect(scheduleLabel(unscheduled, 6, 0, '2026-10-14'))
      .toBe('从没做错过 · 6 对 0 错');
    expect(scheduleLabel(complete, 9, 4, '2026-10-14'))
      .toBe('完成复习 · 9 对 4 错');
  });

  it('列表行不重复显示对错次数', () => {
    expect(scheduleText({ stage: 3, dueDate: '2026-10-12' }, '2026-10-14'))
      .toBe('第 3 个间隔 · 逾期 2 天');
  });

  it('六格刻度按已通过的间隔填充，各状态有对应说明', () => {
    expect(rulerCells({ stage: 3, dueDate: '2026-10-12' }))
      .toEqual([true, true, true, false, false, false]);
    expect(rulerCells(unscheduled)).toEqual(Array(6).fill(false));
    expect(rulerCells(complete)).toEqual(Array(6).fill(false));
    expect(rulerNote({ stage: 3, dueDate: '2026-10-12' }))
      .toBe('这次答对进第 4 个间隔（7 天），答错回到第 1 个间隔');
    expect(rulerNote({ stage: 6, dueDate: '2026-10-12' }))
      .toBe('这次答对完成复习，答错回到第 1 个间隔');
    expect(rulerNote(unscheduled))
      .toBe('从没做错过，只有答错才会进入第 1 个间隔。');
    expect(rulerNote(complete))
      .toBe('已完成复习，不再排期；再答错会回到第 1 个间隔。');
  });
});
