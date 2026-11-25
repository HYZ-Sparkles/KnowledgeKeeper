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

/** A question with its derived state; counts are computed from attempts. */
export interface QuestionView extends Question {
  schedule: Schedule;
  correctCount: number;
  wrongCount: number;
}

/** One queue item: full question content, schedule, stats and favorite are all present. */
export type RoundItem = QuestionView;

/** Letters picked by the user; matching questions send one array per sub-question. */
export type SubmittedAnswer = string[];

/** The observable outcome of one submission; UI renders both schedule states. */
export interface SubmitResult {
  questionId: string;
  correct: boolean;
  correctAnswer: string[];
  before: Schedule;
  after: Schedule;
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
