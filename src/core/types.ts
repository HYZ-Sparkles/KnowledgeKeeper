/** Domain types for the application core. See GLOSSARY.md for vocabulary. */

export type QuestionType = 'single' | 'multiple' | 'truefalse' | 'matching';

export interface Option {
  letter: string;
  text: string;
}

export interface SubQuestion {
  stem: string;
  type: 'single' | 'multiple';
  answer: string[];
}

export interface Schedule {
  /** Interval stage: 0=unscheduled, 1..6=reviewing. */
  stage: number;
  /** Local calendar day (YYYY-MM-DD) when the question is due. */
  dueDate: string | null;
  /** Explicit terminal state after the sixth interval; never stage 7. */
  completed?: boolean;
}

export interface Question {
  id: string;
  groupId: string;
  type: QuestionType;
  stem: string;
  options: Option[];
  answer: string[];
  explanation: string;
  favorite: boolean;
  importOrder: number;
  sharedOptions: Option[] | null;
  subQuestions: SubQuestion[] | null;
}

/** Editable fields supplied by the UI when creating or editing a question. */
export interface QuestionInput {
  type: QuestionType;
  stem: string;
  options: Option[];
  answer: string[];
  explanation: string;
  /** Matching questions only; absent for the other question types. */
  sharedOptions?: Option[] | null;
  subQuestions?: SubQuestion[] | null;
}

/** Why a review draft needs attention before it can be written. */
export type ReviewWarningCode =
  | 'ANSWER_COUNT_MISMATCH' | 'MISSING_ANSWER' | 'NO_QUESTIONS';

export interface ReviewWarning {
  code: ReviewWarningCode;
  message: string;
  /** One-based review-row positions, so the UI can scroll to the red rows. */
  questionNumbers?: number[];
  severity: 'warn' | 'error';
}

/**
 * One import row. Editing (type change, answer fixes, later split/merge)
 * happens in the UI and never goes back through the parser.
 */
export interface DraftQuestion {
  draftId: string;
  /** Original number in the pasted text, used by range answer notation. */
  sourceNo: number;
  type: QuestionType;
  stem: string;
  options: Option[];
  /** UI-editable raw answer, e.g. "A", "ABC" or "√". */
  answerText: string;
  explanation: string;
  missingAnswer: boolean;
  /** Reserved for the matching-question importer (ticket 15). */
  sharedOptions?: Option[] | null;
  /** Reserved for the matching-question importer (ticket 15). */
  subQuestions?: SubQuestion[] | null;
}

export interface ReviewDraft {
  questions: DraftQuestion[];
  warnings: ReviewWarning[];
}

/** A question with its derived state; counts are computed from attempts. */
export interface QuestionView extends Question {
  schedule: Schedule;
  correctCount: number;
  wrongCount: number;
}

/** The group toolbar's 「只看收藏」 switch is a seam-level filter. */
export interface ListQuestionsOptions {
  favoriteOnly?: boolean;
}

/** One queue item: full question content, schedule, stats and favorite are all present. */
export type RoundItem = QuestionView;

/** Letters picked by the user; matching sends one array per sub-question. */
export type SubmittedAnswer = string[] | string[][];

/** One sub-question's verdict; correct answers live here for matching. */
export interface SubQuestionResult {
  subIndex: number;
  correct: boolean;
  submitted: string[];
  correctAnswer: string[];
}

/** The observable outcome of one submission; UI renders both schedule states. */
export interface SubmitResult {
  questionId: string;
  correct: boolean;
  /** Flat answer key; matching leaves this empty and uses subResults. */
  correctAnswer: string[];
  before: Schedule;
  after: Schedule;
  /** Present only for matching; one entry per sub-question, in order. */
  subResults?: SubQuestionResult[];
}

export interface Group {
  id: string;
  name: string;
  createdAt: string;
}

export interface Attempt {
  id: string;
  questionId: string;
  /** Sub-question index; null for non-matching questions. */
  subIndex: number | null;
  correct: boolean;
  at: string;
}

export interface LibraryMeta {
  lastBackupAt: string | null;
}

/** Per-type question counts shown as group-page pills. */
export interface GroupTypeCounts {
  single: number;
  multiple: number;
  truefalse: number;
  matching: number;
}

/** Eight ordered ticks: stages 1–6, review complete, unscheduled. */
export type GroupDistribution = readonly [
  number, number, number, number, number, number, number, number,
];

export interface GroupSummary {
  group: Group;
  questionCount: number;
  dueCount: number;
  inReviewCount: number;
  correctRate: number | null;
  typeCounts: GroupTypeCounts;
  distribution: GroupDistribution;
}

/** The single storage interface. Both IndexedDB and in-memory implement it. */
export interface StorageAdapter {
  getGroups(): Promise<Group[]>;
  getQuestions(): Promise<Question[]>;
  getSchedules(): Promise<Record<string, Schedule>>;
  getAttempts(): Promise<Attempt[]>;
  getMeta(): Promise<LibraryMeta>;
  putGroup(group: Group): Promise<void>;
  putQuestion(question: Question): Promise<void>;
  putSchedule(questionId: string, schedule: Schedule): Promise<void>;
  putAttempt(attempt: Attempt): Promise<void>;
  putMeta(meta: LibraryMeta): Promise<void>;
  deleteGroup(groupId: string): Promise<void>;
  deleteQuestion(questionId: string): Promise<void>;
  deleteSchedule(questionId: string): Promise<void>;
  clear(): Promise<void>;
}

export interface Clock {
  now(): Date;
}

export interface Random {
  /** Returns a float in [0, 1). */
  next(): number;
}
