import type { DraftQuestion, Option, QuestionType } from '../core/types';

const TRUE_FALSE: Record<string, '√' | '×'> = {
  '√': '√', '对': '√', '正确': '√', 'T': '√',
  '×': '×', '错': '×', '错误': '×', 'F': '×',
};

/** Option letters re-flow after a merge, beyond Z if needed. */
export function letterAt(index: number): string {
  let rest = index;
  let letters = '';
  do {
    letters = String.fromCharCode(65 + (rest % 26)) + letters;
    rest = Math.floor(rest / 26) - 1;
  } while (rest >= 0);
  return letters;
}

/** Same normalization the core applies before writing: uppercase, no spaces. */
export function normalizeAnswer(raw: string, type: QuestionType): string {
  const answer = raw.replace(/[\s　]+/g, '').toUpperCase();
  if (type === 'truefalse') return TRUE_FALSE[answer] ?? answer;
  return answer;
}

/**
 * Merge two non-matching review rows. Options keep their order and are
 * re-lettered; each answer follows its option to the new letter. The caller
 * recomputes `missingAnswer` from the merged row.
 */
export function mergeDraftQuestions(
  first: DraftQuestion, second: DraftQuestion,
): DraftQuestion {
  const offset = first.options.length;
  const options: Option[] = [
    ...first.options.map((option) => option.text),
    ...second.options.map((option) => option.text),
  ].map((text, position) => ({ letter: letterAt(position), text }));

  const remap = (row: DraftQuestion, letterOffset: number): string[] => {
    const key = normalizeAnswer(row.answerText, row.type);
    return [...key].flatMap((letter) => {
      const position = row.options.findIndex(
        (option) => option.letter === letter,
      );
      return position < 0 ? [] : [letterAt(letterOffset + position)];
    });
  };
  const answerText = [...remap(first, 0), ...remap(second, offset)].join('');

  return {
    ...first,
    type: answerText.length >= 2 ? 'multiple' : first.type,
    stem: `${first.stem}\n${second.stem}`,
    options,
    answerText,
    explanation: [first.explanation, second.explanation]
      .filter(Boolean).join('\n'),
    missingAnswer: false,
  };
}
