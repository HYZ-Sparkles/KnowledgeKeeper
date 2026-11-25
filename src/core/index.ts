import type {
  Clock, Random, StorageAdapter, Group, GroupSummary, LibraryMeta,
  Question, QuestionInput, QuestionView, Schedule, Attempt,
} from './types';

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
        type: input.type,
        stem: input.stem,
        options: input.options.map((option) => ({ ...option })),
        answer: [...input.answer],
        explanation: input.explanation,
        favorite: false,
        importOrder: questions.reduce(
          (max, q) => Math.max(max, q.importOrder), 0) + 1,
        sharedOptions: null,
        subQuestions: null,
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

/** Local calendar day as YYYY-MM-DD, per spec「排期与轮」. */
function localDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
