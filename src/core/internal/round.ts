import type { Question, Random } from '../types';

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
 * Build one round: every practicable question of the group, in random order.
 * Matching questions stay out until the dedicated ticket adds them.
 */
export function buildRound(
  questions: readonly Question[], random: Random,
): Question[] {
  return shuffle(
    questions.filter((question) => question.type !== 'matching'),
    random,
  );
}
