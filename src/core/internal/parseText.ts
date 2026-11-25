import type {
  DraftQuestion, Option, QuestionType, ReviewDraft, ReviewWarning,
} from '../types';

/** Private text parser: only the application core may call this module. */

const TRUE_FALSE: Record<string, '√' | '×'> = {
  '√': '√', '对': '√', '正确': '√', 'T': '√',
  '×': '×', '错': '×', '错误': '×', 'F': '×',
};

const TRUE_FALSE_OPTIONS: Option[] = [
  { letter: '√', text: '正确' },
  { letter: '×', text: '错误' },
];

// 1. / 1、/ (1) / 01 — all four pasted-number styles.
const QUESTION_LINE = /^\s*(?:\((\d+)\)|(\d+)\s*[.、．]|(\d{2,})\s+)\s*(.*)$/;
const OPTION_TOKEN = /([A-Za-z])\s*[.、．]\s*/g;
const ANSWER_PREFIX = /^\s*答案\s*[:：]\s*(.*)$/;
const EXPLANATION_PREFIX = /^\s*解析\s*[:：]\s*(.*)$/;
const RANGE_TOKEN = /^(\d+)\s*-\s*(\d+)$/;
const NUMBERED_TOKEN = /^(\d+)([A-Za-z√×对错]{1,24})$/;
const LETTERS_ONLY = /^[A-Za-z√×对错]{1,24}$/;

interface Block {
  no: number;
  lines: string[];
}

/** Split a pasted answer notation into per-question tokens and plain answers. */
function splitNotation(raw: string): { plain: string; numbered: string[] } {
  const tokens = raw.split(/[\s　]+/).filter(Boolean);
  const numbered: string[] = [];
  let plain = '';
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (RANGE_TOKEN.test(token)) {
      numbered.push(token);
      const letters = tokens[i + 1];
      if (letters && LETTERS_ONLY.test(letters) && !RANGE_TOKEN.test(letters)) {
        numbered.push(letters);
        i += 1;
      }
    } else if (NUMBERED_TOKEN.test(token)) {
      numbered.push(token);
    } else if (LETTERS_ONLY.test(token)) {
      plain += token.toUpperCase();
    }
  }
  return { plain, numbered };
}

/** Expand `1-5 ABCDA`; a length mismatch leaves every number in the range blank. */
function applyNumbered(tokens: string[], answers: Map<number, string>): void {
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const range = RANGE_TOKEN.exec(token);
    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      const letters = tokens[i + 1] && LETTERS_ONLY.test(tokens[i + 1])
        ? tokens[i + 1].toUpperCase()
        : '';
      i += 1;
      const numbers: number[] = [];
      for (let no = from; no <= to; no += 1) numbers.push(no);
      if (letters.length === numbers.length) {
        numbers.forEach((no, index) => answers.set(no, letters[index]));
      } else {
        numbers.forEach((no) => answers.set(no, ''));
      }
      continue;
    }
    const numbered = NUMBERED_TOKEN.exec(token);
    if (numbered) answers.set(Number(numbered[1]), numbered[2].toUpperCase());
  }
}

/** Read every `A.` / `A、` / `A．` marker on one (possibly multi-option) line. */
function parseOptionLine(line: string): Option[] {
  const matches = [...line.matchAll(OPTION_TOKEN)];
  if (matches.length === 0) return [];
  return matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? line.length;
    return {
      letter: match[1].toUpperCase(),
      text: line.slice(start, end).replace(/[　\s]+/g, ' ').trim(),
    };
  });
}

function looksLikeTrueFalseOptions(options: Option[]): boolean {
  return options.length > 0 && options.every((option) =>
    ['正确', '错误', '√', '×', '对', '错'].includes(option.text.trim()));
}

function answerKeyFor(
  type: QuestionType, raw: string, options: Option[],
): string {
  const answer = raw.replace(/[\s　]+/g, '').toUpperCase();
  const symbol = TRUE_FALSE[answer];
  if (type === 'truefalse') {
    if (symbol) return symbol;
    const picked = options.find((option) => option.letter === answer);
    if (picked && /正确|对|√/.test(picked.text)) return '√';
    if (picked && /错误|错|×/.test(picked.text)) return '×';
    return '';
  }
  return answer;
}

function inferType(raw: string, options: Option[]): QuestionType {
  const answer = raw.replace(/[\s　]+/g, '').toUpperCase();
  const symbol = TRUE_FALSE[answer];
  const tfOptions = looksLikeTrueFalseOptions(options);
  if (tfOptions || (symbol && options.length === 0)) return 'truefalse';
  if (answer.replace(/[^A-Z]/g, '').length >= 2) return 'multiple';
  return 'single';
}

function missingAnswer(question: DraftQuestion): boolean {
  const answer = answerKeyFor(
    question.type, question.answerText, question.options,
  );
  if (!answer) return true;
  if (question.type === 'truefalse') return answer !== '√' && answer !== '×';
  const allowed = new Set(question.options.map((option) => option.letter));
  return [...answer].some((letter) => !allowed.has(letter));
}

function joinNumbers(numbers: number[]): string {
  return numbers.join('、');
}

/**
 * Parse pasted plain text into a review draft. Returns an empty draft for
 * text with no questions; the core turns that into the explicit 0-question
 * error so no draft ever reaches the UI.
 */
export function parseText(text: string): ReviewDraft {
  const blocks: Block[] = [];
  let current: Block | null = null;
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const match = QUESTION_LINE.exec(line);
    if (match) {
      current = {
        no: Number(match[1] ?? match[2] ?? match[3]),
        lines: match[4].trim() ? [match[4]] : [],
      };
      blocks.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }

  const numberedTokens: string[] = [];
  const questions: DraftQuestion[] = blocks.map((block, index) => {
    const stem: string[] = [];
    const options: Option[] = [];
    const explanation: string[] = [];
    let plainAnswer = '';
    let section: 'stem' | 'options' | 'answer' | 'explanation' = 'stem';

    for (const line of block.lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const explanationMatch = EXPLANATION_PREFIX.exec(trimmed);
      if (explanationMatch) {
        section = 'explanation';
        explanation.push(explanationMatch[1].trim());
        continue;
      }
      const answerMatch = ANSWER_PREFIX.exec(trimmed);
      if (answerMatch) {
        section = 'answer';
        const notation = splitNotation(answerMatch[1]);
        if (notation.plain) plainAnswer = notation.plain;
        numberedTokens.push(...notation.numbered);
        continue;
      }
      const onLine = parseOptionLine(trimmed);
      if (onLine.length > 0) {
        section = 'options';
        options.push(...onLine);
        continue;
      }
      if (splitNotation(trimmed).numbered.length > 0) {
        section = 'answer';
        numberedTokens.push(...splitNotation(trimmed).numbered);
        continue;
      }
      if (section === 'explanation') explanation.push(trimmed);
      else if (section === 'stem' || section === 'options') stem.push(trimmed);
    }

    const type = inferType(plainAnswer, options);
    const question: DraftQuestion = {
      draftId: `draft-${index + 1}`,
      sourceNo: block.no,
      type,
      stem: stem.join('\n').trim(),
      options,
      answerText: answerKeyFor(type, plainAnswer, options),
      explanation: explanation.join('\n').trim(),
      missingAnswer: true,
      sharedOptions: null,
      subQuestions: null,
    };
    return question;
  });

  const byNumber = new Map<number, string>();
  applyNumbered(numberedTokens, byNumber);
  for (const question of questions) {
    if (byNumber.has(question.sourceNo)) {
      question.answerText = answerKeyFor(
        question.type, byNumber.get(question.sourceNo) ?? '', question.options,
      );
    }
  }
  for (const question of questions) {
    question.missingAnswer = missingAnswer(question);
  }

  const warnings: ReviewWarning[] = [];
  const missingNumbers = questions.flatMap((question, index) =>
    question.missingAnswer ? [index + 1] : []);
  if (missingNumbers.length > 0) {
    const answered = questions.length - missingNumbers.length;
    warnings.push({
      code: 'ANSWER_COUNT_MISMATCH',
      severity: 'warn',
      questionNumbers: missingNumbers,
      message: `识别到 ${questions.length} 道题，答案 ${answered} 个。`
        + `第 ${joinNumbers(missingNumbers)} 题缺答案，标红了。`,
    });
  }
  return { questions, warnings };
}

/** Re-check a UI-edited draft; the core never trusts the UI's red markers. */
export function draftAnswer(
  question: DraftQuestion,
): { answer: string[]; valid: boolean } {
  const key = answerKeyFor(question.type, question.answerText, question.options);
  if (!key) return { answer: [], valid: false };
  if (question.type === 'truefalse') {
    return { answer: [key], valid: key === '√' || key === '×' };
  }
  const allowed = new Set(question.options.map((option) => option.letter));
  const letters = [...key];
  return {
    answer: letters,
    valid: letters.length > 0 && letters.every((letter) => allowed.has(letter)),
  };
}

export function trueFalseOptions(): Option[] {
  return TRUE_FALSE_OPTIONS.map((option) => ({ ...option }));
}
