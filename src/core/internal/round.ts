import type { Question, Random, Schedule } from '../types';
import { isDue, localDay } from './schedule';

/** Fisher–Yates shuffle driven entirely by the injected random source. */
export function shuffle<T>(items: readonly T[], random: Random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random.next() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Build one round: due questions first, oldest due date first, then every
 * remaining question shuffled. Matching questions are ordinary round items
 * and use the whole question's schedule.
 */
export function buildRound(
  questions: readonly Question[],
  schedules: Record<string, Schedule>,
  random: Random,
  now: Date,
): Question[] {
  const today = localDay(now);
  const due = questions
    .filter((question) => isDue(schedules[question.id], today))
    .sort((a, b) => (schedules[a.id].dueDate ?? '')
      .localeCompare(schedules[b.id].dueDate ?? ''));
  const rest = shuffle(
    questions.filter((question) => !isDue(schedules[question.id], today)),
    random,
  );
  return [...due, ...rest];
}
