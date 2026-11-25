import type { Schedule } from '../types';

/** Fixed forgetting-curve intervals, in days. */
export const INTERVALS = [1, 2, 4, 7, 15, 30] as const;

export type ScheduleState = 'unscheduled' | 'reviewing' | 'complete';

export function scheduleState(schedule: Schedule): ScheduleState {
  if (schedule.completed) return 'complete';
  if (schedule.stage >= 1 && schedule.stage <= 6 && schedule.dueDate) {
    return 'reviewing';
  }
  return 'unscheduled';
}

/** Local calendar day as YYYY-MM-DD; due moments are the start of that day. */
export function localDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(day: string, days: number): string {
  const [year, month, date] = day.split('-').map(Number);
  return localDay(new Date(year, month - 1, date + days));
}

export function isDue(schedule: Schedule | undefined, today: string): boolean {
  return !!schedule
    && scheduleState(schedule) === 'reviewing'
    && schedule.dueDate !== null
    && schedule.dueDate <= today;
}

/**
 * Advance one question's schedule from a submitted answer. Any wrong answer
 * restarts at interval one; an unscheduled question only ever starts on wrong.
 */
export function advance(
  schedule: Schedule, correct: boolean, now: Date,
): Schedule {
  if (!correct) {
    return { stage: 1, dueDate: addDays(localDay(now), INTERVALS[0]) };
  }
  const state = scheduleState(schedule);
  if (state !== 'reviewing') return schedule;
  if (schedule.stage >= INTERVALS.length) {
    return { stage: 0, dueDate: null, completed: true };
  }
  return {
    stage: schedule.stage + 1,
    dueDate: addDays(localDay(now), INTERVALS[schedule.stage]),
  };
}
