import * as XLSX from 'xlsx';
import type { DraftQuestion, QuestionType, ReviewDraft } from '../types';
import {
  answerKeyFor, buildWarnings, inferType, missingAnswer,
} from './parseText';

/** Private Excel parser: reuses the text parser's inference and warnings. */

const HEADER = ['题型', '题干', 'A', 'B', 'C', 'D', 'E', 'F', '答案', '解析'];
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const TYPES: Record<string, QuestionType> = {
  单选题: 'single', 多选题: 'multiple', 判断题: 'truefalse',
  单选: 'single', 多选: 'multiple', 判断: 'truefalse',
};

export function parseExcel(arrayBuffer: ArrayBuffer): ReviewDraft {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('Excel 文件没有可读取的工作表。');
  const rows = XLSX.utils.sheet_to_json<(string | number | undefined)[]>(
    sheet, { header: 1, defval: '', raw: false },
  );
  const first = rows[0]?.map((cell) => String(cell ?? '').trim()) ?? [];
  if (HEADER.some((label, index) => first[index] !== label)) {
    throw new Error(`Excel 表头必须是：${HEADER.join(' | ')}。`);
  }

  const questions: DraftQuestion[] = [];
  rows.slice(1).forEach((cells, index) => {
    const cell = (column: number) => String(cells[column] ?? '').trim();
    const declaredType = cell(0);
    const stem = cell(1);
    const answerText = cell(8);
    const explanation = cell(9);
    const options = LETTERS
      .map((letter, position) => ({ letter, text: cell(position + 2) }))
      .filter((option) => option.text !== '');
    const blank = [declaredType, stem, answerText, explanation].every(
      (value) => value === '',
    ) && options.length === 0;
    if (blank) return;

    // Keep the real spreadsheet row number: blank rows above still count.
    const rowNumber = index + 2;
    if (declaredType === '匹配题' || declaredType.toLowerCase() === 'matching') {
      throw new Error(`第 ${rowNumber} 行是「匹配题」；Excel 不承载匹配题，`
        + '请改用文本导入或录入。');
    }
    const type = declaredType
      ? TYPES[declaredType]
      : inferType(answerText, options);
    if (!type) {
      throw new Error(`第 ${rowNumber} 行的题型「${declaredType}」无法识别，`
        + '请填单选题、多选题或判断题。');
    }
    const question: DraftQuestion = {
      draftId: `draft-${questions.length + 1}`,
      sourceNo: rowNumber,
      type,
      stem,
      options,
      answerText: answerKeyFor(type, answerText, options),
      explanation,
      missingAnswer: false,
      sharedOptions: null,
      subQuestions: null,
    };
    questions.push({ ...question, missingAnswer: missingAnswer(question) });
  });

  return { questions, warnings: buildWarnings(questions) };
}
