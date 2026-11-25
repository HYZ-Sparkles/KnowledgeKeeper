import type {
  DraftQuestion, Option, QuestionType, ReviewDraft, ReviewWarning, SubQuestion,
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
const NUMBERED_TOKEN = /^(\d+)([A-Za-z√×对错正确误]{1,24})$/;
const LETTERS_ONLY = /^[A-Za-z√×对错正确误]{1,24}$/;
const MATCH_HEADER = /^\s*共用选项\s*[:：]\s*(.*)$/;
const SUB_TYPE_MARK = /[（(]\s*(单选|多选)\s*[）)]/;
const SHARED_OPTION_LINE = /^\s*[A-Ja-j]\s*[.、．]\s*/;
const MATCH_ANSWER = /(\d+)\s*[:：.、]?\s*([A-Ja-j]+)/g;
const MATCH_ANSWER_LINE = /^\d+\s*[:：.、]?\s*[A-Ja-j]+(?:\s+\d+\s*[:：.、]?\s*[A-Ja-j]+)*$/;

interface Block {
  no: number;
  lines: string[];
  /** Set when the block is one matching question, not a numbered ordinary one. */
  matching?: DraftQuestion;
}

/** Separate plain answers from the numbered token stream of one line. */
function splitNotation(raw: string): { plain: string; tokens: string[] } {
  const tokens = raw.split(/[\s　]+/).filter(Boolean);
  let plain = '';
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!RANGE_TOKEN.test(token) && !NUMBERED_TOKEN.test(token)
      && LETTERS_ONLY.test(token)) {
      plain += token.toUpperCase();
    }
  }
  // Keep the whole token stream: a range header and its letters may be on
  // different lines, and applyNumbered pairs them after all lines are read.
  return { plain, tokens };
}

/** Expand `1-5 ABCDA` by number; unmatched numbers stay blank. */
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
      // Map letters to question numbers 1:1; unmatched numbers stay missing.
      numbers.forEach((no, index) => answers.set(no, letters[index] ?? ''));
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

interface ParsedMatching {
  question: DraftQuestion;
  nextIndex: number;
}

/**
 * Read one `共用选项：` section as a single matching question: A–J shared
 * options, sequential sub-questions, then `1 AB　2 C`-style answers.
 */
function parseMatchingQuestion(
  lines: string[], start: number, stemLine: string, no: number, draftId: string,
): ParsedMatching {
  const header = MATCH_HEADER.exec(lines[start]);
  let stem = stemLine.trim();
  const onHeader = header?.[1].trim() ?? '';
  if (onHeader) stem = stem ? `${stem}\n${onHeader}` : onHeader;

  let i = start + 1;
  const sharedOptions: Option[] = [];
  while (i < lines.length) {
    const onLine = parseOptionLine(lines[i]);
    if (onLine.length === 0
      || onLine.some((option) => !/^[A-J]$/.test(option.letter))) break;
    sharedOptions.push(...onLine);
    i += 1;
  }

  const subs: { stem: string; marked: 'single' | 'multiple' | null }[] = [];
  const answerLines: string[] = [];
  const explanation: string[] = [];
  let inAnswer = false;
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) { i += 1; continue; }

    const explanationMatch = EXPLANATION_PREFIX.exec(trimmed);
    if (explanationMatch) {
      explanation.push(explanationMatch[1].trim());
      i += 1;
      continue;
    }
    const answerMatch = ANSWER_PREFIX.exec(trimmed);
    if (answerMatch) {
      inAnswer = true;
      answerLines.push(answerMatch[1]);
      i += 1;
      continue;
    }

    const questionMatch = QUESTION_LINE.exec(trimmed);
    if (questionMatch) {
      const num = Number(questionMatch[1] ?? questionMatch[2] ?? questionMatch[3]);
      const body = questionMatch[4].trim();
      if (!inAnswer && num === subs.length + 1) {
        const nextMeaningful = lines.slice(i + 1).find((line) => line.trim());
        const hasOwnOptions = Boolean(nextMeaningful
          && SHARED_OPTION_LINE.test(nextMeaningful));
        const mark = SUB_TYPE_MARK.exec(body);
        if (!hasOwnOptions) {
          subs.push({
            stem: mark ? body.replace(mark[0], '').trim() : body,
            marked: mark ? (mark[1] === '单选' ? 'single' : 'multiple') : null,
          });
          i += 1;
          continue;
        }
      }
      break; // A numbered line outside the sub-question sequence.
    }

    if (inAnswer || MATCH_ANSWER_LINE.test(trimmed)) {
      inAnswer = true;
      answerLines.push(trimmed);
      i += 1;
      continue;
    }
    if (subs.length > 0 && !SHARED_OPTION_LINE.test(trimmed)) {
      subs[subs.length - 1].stem += `\n${trimmed}`;
      i += 1;
      continue;
    }
    break;
  }

  const bySub = new Map<number, string>();
  for (const line of answerLines) {
    for (const match of line.matchAll(MATCH_ANSWER)) {
      bySub.set(Number(match[1]), match[2].toUpperCase());
    }
  }
  const allowed = new Set(sharedOptions.map((option) => option.letter));
  const subQuestions: SubQuestion[] = subs.map((sub, index) => {
    const raw = bySub.get(index + 1) ?? '';
    const letters = [...raw].filter((letter) => allowed.has(letter));
    return {
      stem: sub.stem.trim(),
      type: sub.marked ?? (letters.length >= 2 ? 'multiple' : 'single'),
      answer: letters,
    };
  });
  const answerText = [...bySub.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([num, raw]) => `${num} ${raw}`)
    .join('　');
  const missingAnswer = sharedOptions.length < 2 || subQuestions.length === 0
    || subQuestions.some((sub, index) => {
      const raw = bySub.get(index + 1) ?? '';
      return !raw
        || [...raw].some((letter) => !allowed.has(letter))
        || (sub.type === 'single' && sub.answer.length !== 1)
        || (sub.type === 'multiple' && sub.answer.length < 2);
    });

  return {
    question: {
      draftId, sourceNo: no, type: 'matching', stem, options: [], answerText,
      explanation: explanation.join('\n').trim(), missingAnswer,
      sharedOptions, subQuestions,
    },
    nextIndex: i,
  };
}

/**
 * Parse pasted plain text into a review draft. Returns an empty draft for
 * text with no questions; the core turns that into the explicit 0-question
 * error so no draft ever reaches the UI.
 */
export function parseText(text: string): ReviewDraft {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let current: Block | null = null;
  let looseStem = '';
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (MATCH_HEADER.test(line)) {
      // A numbered (or bare) line just above the header is the matching stem.
      let stemLine = '';
      const meaningful = current?.lines.filter((item) => item.trim()) ?? [];
      if (meaningful.length === 1) {
        stemLine = meaningful[0];
        blocks.pop();
      } else if (!current) {
        stemLine = looseStem;
      }
      const parsed = parseMatchingQuestion(
        lines, i, stemLine, current?.no ?? blocks.length + 1,
        `draft-${blocks.length + 1}`,
      );
      blocks.push({
        no: current?.no ?? blocks.length + 1, lines: [], matching: parsed.question,
      });
      i = parsed.nextIndex - 1;
      current = null;
      continue;
    }
    const match = QUESTION_LINE.exec(line);
    if (match) {
      looseStem = '';
      current = {
        no: Number(match[1] ?? match[2] ?? match[3]),
        lines: match[4].trim() ? [match[4]] : [],
      };
      blocks.push(current);
    } else if (current) {
      current.lines.push(line);
    } else if (line.trim()) {
      looseStem = line.trim();
    }
  }

  const numberedTokens: string[] = [];
  const rawAnswers: string[] = [];
  const questions: DraftQuestion[] = blocks.map((block, index) => {
    if (block.matching) {
      rawAnswers.push('');
      return {
        ...block.matching,
        draftId: `draft-${index + 1}`,
        sourceNo: block.no,
      };
    }
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
        numberedTokens.push(...notation.tokens);
        continue;
      }
      const onLine = parseOptionLine(trimmed);
      if (onLine.length > 0) {
        section = 'options';
        options.push(...onLine);
        continue;
      }
      const notation = splitNotation(trimmed);
      if (notation.tokens.some((token) => RANGE_TOKEN.test(token)
        || NUMBERED_TOKEN.test(token))) {
        section = 'answer';
        numberedTokens.push(...notation.tokens);
        continue;
      }
      if (section === 'answer' && notation.tokens.length > 0) {
        numberedTokens.push(...notation.tokens);
        continue;
      }
      if (section === 'explanation') explanation.push(trimmed);
      else if (section === 'stem' || section === 'options') stem.push(trimmed);
    }

    rawAnswers.push(plainAnswer);
    return {
      draftId: `draft-${index + 1}`,
      sourceNo: block.no,
      type: 'single',
      stem: stem.join('\n').trim(),
      options,
      answerText: '',
      explanation: explanation.join('\n').trim(),
      missingAnswer: true,
      sharedOptions: null,
      subQuestions: null,
    };
  });

  const byNumber = new Map<number, string>();
  applyNumbered(numberedTokens, byNumber);
  questions.forEach((question, index) => {
    if (question.type === 'matching') return;
    // A trailing answer block decides the type just as an inline one does.
    const raw = byNumber.has(question.sourceNo)
      ? byNumber.get(question.sourceNo) ?? ''
      : rawAnswers[index];
    question.type = inferType(raw, question.options);
    question.answerText = answerKeyFor(question.type, raw, question.options);
    question.missingAnswer = missingAnswer(question);
  });

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

/** Validate a matching draft; its answers live in subQuestions, not answerText. */
export function matchingDraftAnswer(question: DraftQuestion): boolean {
  const shared = question.sharedOptions ?? [];
  const subs = question.subQuestions ?? [];
  if (shared.length < 2 || subs.length === 0) return false;
  const allowed = new Set(shared.map((option) => option.letter));
  return subs.every((sub) => sub.stem.trim() !== ''
    && sub.answer.length > 0
    && sub.answer.every((letter) => allowed.has(letter))
    && (sub.type === 'multiple' ? sub.answer.length >= 2 : sub.answer.length === 1));
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
