import type { Question } from '../types';

/** Exact set equality; order-independent, missing or extra letters are wrong. */
export function sameLetters(
  expected: readonly string[], given: readonly string[],
): boolean {
  const a = [...expected].sort();
  const b = [...given].sort();
  return a.length === b.length && a.every((letter, index) => letter === b[index]);
}

/**
 * Grade a non-matching question: one letter must match exactly, multiple
 * letters are compared as a set.
 */
export function grade(question: Question, answer: readonly string[]): boolean {
  return sameLetters(question.answer, answer);
}

/** One sub-question's verdict, preserving its position in the matching question. */
export interface GradedSub {
  subIndex: number;
  correct: boolean;
  submitted: string[];
  correctAnswer: string[];
}

/**
 * Grade every sub-question of one submission. The whole question is correct
 * only when all sub-questions are; scheduling still happens once, per question.
 */
export function gradeMatching(
  question: Question, answer: readonly string[][],
): { correct: boolean; subResults: GradedSub[] } {
  const subResults = (question.subQuestions ?? []).map((sub, subIndex) => {
    const submitted = [...(answer[subIndex] ?? [])];
    return {
      subIndex,
      correct: sameLetters(sub.answer, submitted),
      submitted,
      correctAnswer: [...sub.answer],
    };
  });
  return { correct: subResults.every((sub) => sub.correct), subResults };
}
