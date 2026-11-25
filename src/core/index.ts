import type {
  Clock, Random, StorageAdapter, Group, GroupSummary, LibraryMeta,
  Question, QuestionInput, QuestionView, Schedule, Attempt,
  RoundItem, SubmittedAnswer, SubmitResult,
} from './types';
import { grade } from './internal/grade';
import { buildRound } from './internal/round';
import { advance, localDay } from './internal/schedule';

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
  listGroups(): Promise<GroupSummary[]>;
  getMeta(): Promise<LibraryMeta>;
  createQuestion(input: QuestionInput, groupId: string): Promise<QuestionView>;
  listQuestions(groupId: string): Promise<QuestionView[]>;
  getQuestion(questionId: string): Promise<QuestionView>;
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
    async listQuestions(groupId: string): Promise<QuestionView[]> {
      await ensureInitialized();
      const [questions, schedules, attempts] = await Promise.all([
        storage.getQuestions(),
        storage.getSchedules(),
        storage.getAttempts(),
      ]);
      return questions
        .filter((q) => q.groupId === groupId)
        .sort((a, b) => a.importOrder - b.importOrder)
        .map((q) => toQuestionView(q, schedules, attempts));
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
      const correct = grade(question, answer);
      const before = (await storage.getSchedules())[questionId]
        ?? { stage: 0, dueDate: null };
      const after = advance(before, correct, clock.now());
      await storage.putAttempt({
        id: generateId(random, 'a'),
        questionId,
        subIndex: null,
        correct,
        at: clock.now().toISOString(),
      });
      if (after !== before) await storage.putSchedule(questionId, after);
      return {
        questionId,
        correct,
        correctAnswer: [...question.answer],
        before,
        after,
      };
    },
  };
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

