import type { QuestionType } from '../core/types';

/** The one Chinese label per question type, shared by all UI views. */
export const TYPE_LABELS: Record<QuestionType, string> = {
  single: '单选题',
  multiple: '多选题',
  truefalse: '判断题',
  matching: '匹配题',
};
