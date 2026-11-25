import { INTERVALS, scheduleState } from '../core';
import type { Schedule, SubmitResult } from '../core/types';
import { calendarValue } from './dayValue';

function friendlyDate(day: string): string {
  const [, month, date] = day.split('-');
  return `${Number(month)} 月 ${Number(date)} 日`;
}

function dueText(schedule: Schedule, today: string): string {
  const due = schedule.dueDate ?? '';
  const overdue = Math.round(
    (calendarValue(today) - calendarValue(due)) / 86_400_000,
  );
  if (overdue > 0) return `逾期 ${overdue} 天`;
  if (overdue === 0) return '今天到期';
  return `${friendlyDate(due)}到期`;
}

/** Schedule-only text for group list rows. */
export function scheduleText(schedule: Schedule, today: string): string {
  const state = scheduleState(schedule);
  if (state === 'unscheduled') return '未排期';
  if (state === 'complete') return '完成复习';
  return `第 ${schedule.stage} 个间隔 · ${dueText(schedule, today)}`;
}

/** Compact group-row copy; the practice label keeps the long form. */
export function scheduleRowText(schedule: Schedule, today: string): string {
  const state = scheduleState(schedule);
  if (state === 'unscheduled') return '未排期';
  if (state === 'complete') return '完成复习';
  return `第 ${schedule.stage}/6 · ${dueText(schedule, today)}`;
}

/** The full label row: schedule plus live attempt counts. */
export function scheduleLabel(
  schedule: Schedule, correctCount: number, wrongCount: number, today: string,
): string {
  const stats = `${correctCount} 对 ${wrongCount} 错`;
  const state = scheduleState(schedule);
  if (state === 'unscheduled') return `从没做错过 · ${stats}`;
  if (state === 'complete') return `完成复习 · ${stats}`;
  return `${scheduleText(schedule, today)} · ${stats}`;
}

/** The seven-row consequence table, read only from before/after states. */
export function scheduleConsequence(result: SubmitResult): string {
  const before = scheduleState(result.before);
  if (before === 'unscheduled') {
    return result.correct
      ? '从没做错过，不排期，只跟着轮次出现。'
      : '进入第 1 个间隔，明天再出现。';
  }
  if (before === 'complete') {
    return result.correct
      ? '已完成复习，不再排期。'
      : '完成复习后再答错，重新成为错题，回到第 1 个间隔，明天再出现。';
  }
  if (!result.correct) return '回到第 1 个间隔，明天再出现。';
  if (result.before.stage === INTERVALS.length) {
    return '通过最后一个间隔，完成复习，不再排期。';
  }
  const stage = result.after.stage;
  return `进入第 ${stage} 个间隔，${INTERVALS[stage - 1]} 天后（${
    friendlyDate(result.after.dueDate ?? '')
  }）再出现。`;
}

/** Six cells; the intervals already passed are solid. */
export function rulerCells(schedule: Schedule): boolean[] {
  const passed = scheduleState(schedule) === 'reviewing' ? schedule.stage : 0;
  return Array.from({ length: INTERVALS.length }, (_, index) => index < passed);
}

export function rulerNote(schedule: Schedule): string {
  const state = scheduleState(schedule);
  if (state === 'unscheduled') {
    return '从没做错过，只有答错才会进入第 1 个间隔。';
  }
  if (state === 'complete') {
    return '已完成复习，不再排期；再答错会回到第 1 个间隔。';
  }
  if (schedule.stage === INTERVALS.length) {
    return '这次答对完成复习，答错回到第 1 个间隔';
  }
  return `这次答对进第 ${schedule.stage + 1} 个间隔（${
    INTERVALS[schedule.stage]
  } 天），答错回到第 1 个间隔`;
}
