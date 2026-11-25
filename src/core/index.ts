import type {
  Clock, Random, StorageAdapter, Group, GroupSummary, GroupTypeCounts,
  LibraryMeta, Question, QuestionInput, QuestionView, Schedule, Attempt,
  RoundItem, SubmittedAnswer, SubmitResult, SubQuestionResult,
  ListQuestionsOptions, ReviewDraft, FileLike, FileImportResult,
  LibraryCounts, BackupInfo, RestoreSummary,
} from './types';
import {
  draftAnswer, matchingDraftAnswer, parseText, trueFalseOptions,
} from './internal/parseText';
import { extractFile } from './internal/extractFile';
import { parseExcel } from './internal/parseExcel';
import { excelTemplate } from './internal/excelTemplate';
import { grade, gradeMatching } from './internal/grade';
import { buildRound } from './internal/round';
import { advance, localDay } from './internal/schedule';
import {
  BACKUP_SCHEMA_VERSION, serializeBackup, parseBackup,
  inspectBackup as inspectBackupJson, type BackupSnapshot,
} from './internal/backup';

export { INTERVALS } from './internal/schedule';

export interface CoreDeps {
  storage: StorageAdapter;
  clock: Clock;
  random: Random;
}

/** Generate an ID from the injected random source; the core creates no deps. */
function generateId(random: Random, prefix: string): string {
  const a = Math.floor(random.next() * 0xffffffff).toString(36);
  const b = Math.floor(random.next() * 0xffffffff).toString(36);
  return `${prefix}-${a}${b}`;
}

export interface Core {
  /** Parse pasted text into a review draft; zero questions throws. */
  importFromText(text: string): Promise<ReviewDraft>;
  /**
   * Extract a file's text privately, then parse it with the text parser.
   * Unsupported formats and extraction problems throw instead of yielding
   * a draft, so the UI never advances to review with a bad import.
   */
  importFromFile(file: FileLike): Promise<FileImportResult>;
  /** Runtime-generated .xlsx template for the fixed import columns. */
  excelTemplate(): Blob;
  /** Validate the whole draft, then write it in import order. */
  commitReview(draft: ReviewDraft, groupId: string): Promise<QuestionView[]>;
  listGroups(): Promise<GroupSummary[]>;
  getMeta(): Promise<LibraryMeta>;
  createQuestion(input: QuestionInput, groupId: string): Promise<QuestionView>;
  listQuestions(
    groupId: string, options?: ListQuestionsOptions,
  ): Promise<QuestionView[]>;
  getQuestion(questionId: string): Promise<QuestionView>;
  /** A pure marker: schedule, round and attempts are untouched. */
  setFavorite(questionId: string, favorite: boolean): Promise<QuestionView>;
  /** Rewrites only editable content; schedule, attempts and favorite stay put. */
  updateQuestion(questionId: string, input: QuestionInput): Promise<QuestionView>;
  /** Removes the question and cascades its attempts and schedule. */
  deleteQuestion(questionId: string): Promise<void>;
  createGroup(name: string): Promise<Group>;
  renameGroup(groupId: string, name: string): Promise<Group>;
  deleteGroup(groupId: string): Promise<void>;
  /** One shuffled pass over the group's practicable questions. */
  startRound(groupId: string): Promise<RoundItem[]>;
  /** Grade one answer, append its attempt and return the observable outcome. */
  submitAnswer(questionId: string, answer: SubmittedAnswer): Promise<SubmitResult>;
  /** Write the whole library as JSON and stamp 「上次备份」 with the clock. */
  backup(): Promise<string>;
  /** Download name, whose day comes from the injected clock. */
  backupFileName(): string;
  /** Read-only counts for the backup page pill; never parses a backup. */
  getLibraryCounts(): Promise<LibraryCounts>;
  /** Read-only counts from a backup file, for the confirmation dialog. */
  inspectBackup(json: string): BackupInfo;
  /** Validate first, then replace the whole library; lastBackupAt comes from the file. */
  restore(json: string): Promise<RestoreSummary>;
}

/**
 * The single application core seam. All UI code calls only this module.
 * Every external dependency (storage, clock, random) is injected, never created here.
 */
export function createCore(deps: CoreDeps): Core {
  const { storage, clock, random } = deps;
  let initialized: Promise<void> | null = null;

  function ensureInitialized(): Promise<void> {
    if (!initialized) {
      initialized = (async () => {
        const groups = await storage.getGroups();
        if (groups.length === 0) {
          const group: Group = {
            id: generateId(random, 'g'),
            name: '错题集',
            createdAt: clock.now().toISOString(),
          };
          await storage.putGroup(group);
        }
      })();
    }
    return initialized;
  }

  return {
    async importFromText(text: string): Promise<ReviewDraft> {
      return draftFromText(text);
    },
    async importFromFile(file: FileLike): Promise<FileImportResult> {
      const { text, spreadsheet } = await extractFile(file);
      if (spreadsheet) {
        return {
          fileName: file.name,
          text: '',
          draft: parseExcel(await file.arrayBuffer()),
          skipTextarea: true,
        };
      }
      return {
        fileName: file.name,
        text,
        draft: draftFromText(text),
        skipTextarea: false,
      };
    },
    excelTemplate(): Blob {
      return excelTemplate();
    },
    async commitReview(
      draft: ReviewDraft, groupId: string,
    ): Promise<QuestionView[]> {
      await ensureInitialized();
      if (!(await storage.getGroups()).some((g) => g.id === groupId)) {
        throw new Error('分组不存在');
      }
      if (draft.questions.length === 0) throw new Error('没有可写入的题目');
      // Validate everything first: one bad row must leave the library untouched.
      const inputs: QuestionInput[] = draft.questions.map((question, index) => {
        if (!question.stem.trim()) {
          throw new Error(`第 ${index + 1} 题题干不能为空`);
        }
        if (question.type === 'matching') {
          if (!matchingDraftAnswer(question)) {
            throw new Error(`第 ${index + 1} 题答案缺失或不在选项范围内`);
          }
          return {
            type: 'matching',
            stem: question.stem.trim(),
            options: [],
            answer: [],
            explanation: question.explanation,
            sharedOptions: (question.sharedOptions ?? [])
              .map((option) => ({ ...option })),
            subQuestions: (question.subQuestions ?? []).map((sub) => ({
              ...sub, answer: [...sub.answer],
            })),
          };
        }
        const { answer, valid } = draftAnswer(question);
        if (!valid) {
          throw new Error(`第 ${index + 1} 题答案缺失或不在选项范围内`);
        }
        return {
          type: question.type,
          stem: question.stem.trim(),
          options: question.type === 'truefalse'
            ? trueFalseOptions()
            : question.options.map((option) => ({ ...option })),
          answer,
          explanation: question.explanation,
          sharedOptions: null,
          subQuestions: null,
        };
      });
      let order = (await storage.getQuestions()).reduce(
        (max, q) => Math.max(max, q.importOrder), 0);
      const written: QuestionView[] = [];
      for (const input of inputs) {
        order += 1;
        const question: Question = {
          id: generateId(random, 'q'),
          groupId,
          ...editableFields(input),
          favorite: false,
          importOrder: order,
        };
        await storage.putQuestion(question);
        written.push(toQuestionView(question, {}, []));
      }
      return written;
    },
    async listGroups(): Promise<GroupSummary[]> {
      await ensureInitialized();
      const [groups, questions, schedules, attempts] = await Promise.all([
        storage.getGroups(),
        storage.getQuestions(),
        storage.getSchedules(),
        storage.getAttempts(),
      ]);

      return groups.map((group) => {
        const groupQuestions = questions.filter((q) => q.groupId === group.id);
        const typeCounts: GroupTypeCounts = {
          single: 0, multiple: 0, truefalse: 0, matching: 0,
        };
        const buckets = [0, 0, 0, 0, 0, 0, 0, 0];
        for (const question of groupQuestions) {
          typeCounts[question.type] += 1;
          const schedule = schedules[question.id];
          if (schedule?.completed) buckets[6] += 1;
          else if (schedule && schedule.stage >= 1 && schedule.stage <= 6) {
            buckets[schedule.stage - 1] += 1;
          } else buckets[7] += 1;
        }
        const dueCount = groupQuestions.filter((q) => {
          const s = schedules[q.id];
          if (!s || s.stage < 1 || s.stage > 6 || !s.dueDate) return false;
          const today = localDay(clock.now());
          return s.dueDate <= today;
        }).length;
        const inReviewCount = groupQuestions.filter((q) => {
          const stage = schedules[q.id]?.stage ?? 0;
          return stage >= 1 && stage <= 6;
        }).length;
        const groupAttempts = attempts.filter((a) =>
          groupQuestions.some((q) => q.id === a.questionId));
        const correctRate = groupAttempts.length === 0
          ? null
          : groupAttempts.filter((a) => a.correct).length / groupAttempts.length;

        return {
          group,
          questionCount: groupQuestions.length,
          dueCount,
          inReviewCount,
          correctRate,
          typeCounts,
          distribution: [
            buckets[0], buckets[1], buckets[2], buckets[3],
            buckets[4], buckets[5], buckets[6], buckets[7],
          ],
        };
      });
    },
    async getMeta(): Promise<LibraryMeta> {
      await ensureInitialized();
      return storage.getMeta();
    },
    async createGroup(name: string): Promise<Group> {
      await ensureInitialized();
      const trimmed = name.trim();
      if (!trimmed) throw new Error('分组名不能为空');
      const group: Group = {
        id: generateId(random, 'g'),
        name: trimmed,
        createdAt: clock.now().toISOString(),
      };
      await storage.putGroup(group);
      return group;
    },
    async renameGroup(groupId: string, name: string): Promise<Group> {
      await ensureInitialized();
      const trimmed = name.trim();
      if (!trimmed) throw new Error('分组名不能为空');
      const found = (await storage.getGroups()).find((g) => g.id === groupId);
      if (!found) throw new Error('分组不存在');
      const renamed = { ...found, name: trimmed };
      await storage.putGroup(renamed);
      return renamed;
    },
    async deleteGroup(groupId: string): Promise<void> {
      await ensureInitialized();
      const found = (await storage.getGroups()).find((g) => g.id === groupId);
      if (!found) throw new Error('分组不存在');
      // The storage adapter removes the group's questions, schedules and attempts.
      await storage.deleteGroup(groupId);
    },
    async createQuestion(input: QuestionInput, groupId: string): Promise<QuestionView> {
      await ensureInitialized();
      const groups = await storage.getGroups();
      if (!groups.some((g) => g.id === groupId)) {
        throw new Error('分组不存在');
      }
      const questions = await storage.getQuestions();
      const question: Question = {
        id: generateId(random, 'q'),
        groupId,
        ...editableFields(input),
        favorite: false,
        importOrder: questions.reduce(
          (max, q) => Math.max(max, q.importOrder), 0) + 1,
      };
      await storage.putQuestion(question);
      return toQuestionView(question, {}, []);
    },
    async listQuestions(
      groupId: string, options: ListQuestionsOptions = {},
    ): Promise<QuestionView[]> {
      await ensureInitialized();
      const [questions, schedules, attempts] = await Promise.all([
        storage.getQuestions(),
        storage.getSchedules(),
        storage.getAttempts(),
      ]);
      return questions
        .filter((q) => q.groupId === groupId
          && (!options.favoriteOnly || q.favorite))
        .sort((a, b) => a.importOrder - b.importOrder)
        .map((q) => toQuestionView(q, schedules, attempts));
    },
    async setFavorite(
      questionId: string, favorite: boolean,
    ): Promise<QuestionView> {
      await ensureInitialized();
      const found = (await storage.getQuestions())
        .find((q) => q.id === questionId);
      if (!found) throw new Error('题目不存在');
      const updated: Question = { ...found, favorite };
      await storage.putQuestion(updated);
      const [schedules, attempts] = await Promise.all([
        storage.getSchedules(), storage.getAttempts(),
      ]);
      return toQuestionView(updated, schedules, attempts);
    },
    async getQuestion(questionId: string): Promise<QuestionView> {
      await ensureInitialized();
      const [question, schedules, attempts] = await Promise.all([
        storage.getQuestions(),
        storage.getSchedules(),
        storage.getAttempts(),
      ]);
      const found = question.find((q) => q.id === questionId);
      if (!found) throw new Error('题目不存在');
      return toQuestionView(found, schedules, attempts);
    },
    async updateQuestion(
      questionId: string, input: QuestionInput,
    ): Promise<QuestionView> {
      await ensureInitialized();
      const found = (await storage.getQuestions())
        .find((q) => q.id === questionId);
      if (!found) throw new Error('题目不存在');
      const updated: Question = { ...found, ...editableFields(input) };
      await storage.putQuestion(updated);
      const [schedules, attempts] = await Promise.all([
        storage.getSchedules(), storage.getAttempts(),
      ]);
      return toQuestionView(updated, schedules, attempts);
    },
    async deleteQuestion(questionId: string): Promise<void> {
      await ensureInitialized();
      const found = (await storage.getQuestions())
        .some((q) => q.id === questionId);
      if (!found) throw new Error('题目不存在');
      // The storage adapter cascades schedules and attempts.
      await storage.deleteQuestion(questionId);
    },
    async startRound(groupId: string): Promise<RoundItem[]> {
      await ensureInitialized();
      const [groups, questions, schedules, attempts] = await Promise.all([
        storage.getGroups(), storage.getQuestions(),
        storage.getSchedules(), storage.getAttempts(),
      ]);
      if (!groups.some((g) => g.id === groupId)) throw new Error('分组不存在');
      return buildRound(
        questions.filter((q) => q.groupId === groupId),
        schedules, random, clock.now(),
      ).map((question) => toQuestionView(question, schedules, attempts));
    },
    async submitAnswer(
      questionId: string, answer: SubmittedAnswer,
    ): Promise<SubmitResult> {
      await ensureInitialized();
      const question = (await storage.getQuestions())
        .find((q) => q.id === questionId);
      if (!question) throw new Error('题目不存在');
      const before = (await storage.getSchedules())[questionId]
        ?? { stage: 0, dueDate: null };
      const now = clock.now();
      const at = now.toISOString();
      let correct: boolean;
      let correctAnswer: string[] = [];
      let subResults: SubQuestionResult[] | undefined;

      if (question.type === 'matching') {
        if (!Array.isArray(answer) || !Array.isArray(answer[0])) {
          throw new Error('匹配题答案格式不正确');
        }
        const perSub = answer as string[][];
        if (perSub.length !== (question.subQuestions?.length ?? 0)) {
          throw new Error('匹配题答案数量与子题数不符');
        }
        const graded = gradeMatching(question, perSub);
        correct = graded.correct;
        subResults = graded.subResults;
      } else {
        if (Array.isArray(answer[0])) throw new Error('答案格式不正确');
        correct = grade(question, answer as string[]);
        correctAnswer = [...question.answer];
      }

      const after = advance(before, correct, now);
      // Matching records one attempt per sub-question but schedules once.
      const records: Attempt[] = subResults
        ? subResults.map((sub) => ({
          id: generateId(random, 'a'), questionId,
          subIndex: sub.subIndex, correct: sub.correct, at,
        }))
        : [{
          id: generateId(random, 'a'), questionId,
          subIndex: null, correct, at,
        }];
      for (const record of records) await storage.putAttempt(record);
      if (after !== before) await storage.putSchedule(questionId, after);
      return { questionId, correct, correctAnswer, before, after, subResults };
    },
    async backup(): Promise<string> {
      await ensureInitialized();
      const [groups, questions, schedules, attempts] = await Promise.all([
        storage.getGroups(), storage.getQuestions(),
        storage.getSchedules(), storage.getAttempts(),
      ]);
      const meta = { lastBackupAt: clock.now().toISOString() };
      await storage.putMeta(meta);
      const snapshot: BackupSnapshot = {
        schemaVersion: BACKUP_SCHEMA_VERSION,
        groups, questions, schedules, attempts, meta,
      };
      return serializeBackup(snapshot);
    },
    backupFileName(): string {
      return `KnowledgeKeeper-${localDay(clock.now())}.json`;
    },
    async getLibraryCounts(): Promise<LibraryCounts> {
      await ensureInitialized();
      const [questions, attempts] = await Promise.all([
        storage.getQuestions(), storage.getAttempts(),
      ]);
      return { questions: questions.length, attempts: attempts.length };
    },
    inspectBackup(json: string): BackupInfo {
      return inspectBackupJson(json);
    },
    async restore(json: string): Promise<RestoreSummary> {
      // Validation happens before any write, so a bad file changes nothing.
      const snapshot = parseBackup(json);
      await ensureInitialized();
      await storage.clear();
      await storage.putMeta(snapshot.meta);
      for (const group of snapshot.groups) await storage.putGroup(group);
      for (const question of snapshot.questions) await storage.putQuestion(question);
      for (const [id, schedule] of Object.entries(snapshot.schedules)) {
        await storage.putSchedule(id, schedule);
      }
      for (const attempt of snapshot.attempts) await storage.putAttempt(attempt);
      return {
        groups: snapshot.groups.length,
        questions: snapshot.questions.length,
        lastBackupAt: snapshot.meta.lastBackupAt,
      };
    },
  };
}

/** One text parser for pasted text and for text extracted from files. */
function draftFromText(text: string): ReviewDraft {
  const draft = parseText(text);
  if (draft.questions.length === 0) {
    throw new Error('没有识别到题目，请粘贴带题号的文本，或到「录入」页手动添加。');
  }
  return draft;
}

/** Copy the UI-owned fields; id/group/favorite/importOrder are not editable. */
function editableFields(input: QuestionInput) {
  return {
    type: input.type,
    stem: input.stem,
    options: input.options.map((option) => ({ ...option })),
    answer: [...input.answer],
    explanation: input.explanation,
    sharedOptions: input.sharedOptions
      ? input.sharedOptions.map((option) => ({ ...option }))
      : null,
    subQuestions: input.subQuestions
      ? input.subQuestions.map((sub) => ({
        stem: sub.stem, type: sub.type, answer: [...sub.answer],
      }))
      : null,
  };
}

function toQuestionView(
  question: Question,
  schedules: Record<string, Schedule>,
  attempts: Attempt[],
): QuestionView {
  const own = attempts.filter((a) => a.questionId === question.id);
  return {
    ...question,
    schedule: schedules[question.id] ?? { stage: 0, dueDate: null },
    correctCount: own.filter((a) => a.correct).length,
    wrongCount: own.filter((a) => !a.correct).length,
  };
}

