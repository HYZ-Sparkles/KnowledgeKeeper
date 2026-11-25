import type {
  Attempt, Clock, Random, Schedule, StorageAdapter,
} from './types';

/** Reusable deterministic clock for tests. */
export function fixedClock(iso: string): Clock {
  const fixed = new Date(iso);
  return { now: () => new Date(fixed.getTime()) };
}

/** Reusable deterministic random for tests (LCG with a fixed seed). */
export function fixedRandom(seed = 1): Random {
  let state = seed >>> 0;
  return {
    next() {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x100000000;
    },
  };
}

/** Observe persisted state through the backup seam, not storage rows. */
export async function observeBackup(
  core: { backup(): Promise<string> },
): Promise<{
  schedules: Record<string, Schedule>;
  attempts: Attempt[];
}> {
  return JSON.parse(await core.backup());
}

/** In-memory storage adapter for tests. Mirrors the IndexedDB adapter interface. */
export function memoryAdapter(): StorageAdapter {
  const groups = new Map<string, import('./types').Group>();
  const questions = new Map<string, import('./types').Question>();
  const schedules = new Map<string, import('./types').Schedule>();
  const attempts = new Map<string, import('./types').Attempt>();
  let meta: import('./types').LibraryMeta = { lastBackupAt: null };

  return {
    async getGroups() { return [...groups.values()]; },
    async getQuestions() { return [...questions.values()]; },
    async getSchedules() { return Object.fromEntries(schedules); },
    async getAttempts() { return [...attempts.values()]; },
    async getMeta() { return { ...meta }; },
    async putGroup(g) { groups.set(g.id, { ...g }); },
    async putQuestion(q) { questions.set(q.id, { ...q }); },
    async putSchedule(id, s) { schedules.set(id, { ...s }); },
    async putAttempt(a) { attempts.set(a.id, { ...a }); },
    async putMeta(m) { meta = { ...m }; },
    // Mirror the IndexedDB adapter: deleting a question or group cascades.
    async deleteGroup(id) {
      groups.delete(id);
      for (const question of questions.values()) {
        if (question.groupId !== id) continue;
        schedules.delete(question.id);
        for (const [attemptId, attempt] of attempts) {
          if (attempt.questionId === question.id) attempts.delete(attemptId);
        }
        questions.delete(question.id);
      }
    },
    async deleteQuestion(id) {
      questions.delete(id);
      schedules.delete(id);
      for (const [attemptId, attempt] of attempts) {
        if (attempt.questionId === id) attempts.delete(attemptId);
      }
    },
    async deleteSchedule(id) { schedules.delete(id); },
    async clear() {
      groups.clear(); questions.clear(); schedules.clear(); attempts.clear();
      meta = { lastBackupAt: null };
    },
  };
}
