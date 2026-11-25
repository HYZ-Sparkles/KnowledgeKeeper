import type { Question } from '../types';

/**
 * Exact-letter grading: a single letter must match one option; multiple
 * letters are compared as a set, so a missing or extra letter is wrong.
 */
export function grade(question: Question, answer: readonly string[]): boolean {
  if (question.type === 'matching') {
    throw new Error('匹配题暂不支持提交');
  }
  const expected = [...question.answer].sort();
  const given = [...answer].sort();
  return expected.length === given.length
    && expected.every((letter, index) => letter === given[index]);
}
