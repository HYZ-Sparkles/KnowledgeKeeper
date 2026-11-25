import Dexie, { type Table } from 'dexie';
import type {
  StorageAdapter, Group, Question, Schedule, Attempt, LibraryMeta,
} from './types';

interface MetaRow {
  key: string;
  value: LibraryMeta;
}

class KnowledgeKeeperDB extends Dexie {
  groups!: Table<Group, string>;
  questions!: Table<Question, string>;
  schedules!: Table<{ id: string } & Schedule, string>;
  attempts!: Table<Attempt, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super('KnowledgeKeeper');
    this.version(1).stores({
      groups: 'id, name, createdAt',
      questions: 'id, groupId, importOrder',
      schedules: 'id',
      attempts: 'id, questionId, at',
      meta: 'key',
    });
  }
}

/** Production storage adapter backed by IndexedDB via Dexie. */
export function indexedDbAdapter(): StorageAdapter {
  const db = new KnowledgeKeeperDB();

  return {
    async getGroups() { return db.groups.toArray(); },
    async getQuestions() { return db.questions.toArray(); },
    async getSchedules() {
      const rows = await db.schedules.toArray();
      const out: Record<string, Schedule> = {};
      for (const row of rows) {
        out[row.id] = { stage: row.stage, dueDate: row.dueDate };
      }
      return out;
    },
    async getAttempts() { return db.attempts.toArray(); },
    async getMeta() {
      const row = await db.meta.get('library');
      return row?.value ?? { lastBackupAt: null };
    },
    async putGroup(g) { await db.groups.put(g); },
    async putQuestion(q) { await db.questions.put(q); },
    async putSchedule(id, s) { await db.schedules.put({ id, ...s }); },
    async putAttempt(a) { await db.attempts.put(a); },
    async putMeta(m) { await db.meta.put({ key: 'library', value: m }); },
    async deleteGroup(id) {
      await db.groups.delete(id);
      const qs = await db.questions.where('groupId').equals(id).toArray();
      for (const q of qs) {
        await db.schedules.delete(q.id);
        await db.attempts.where('questionId').equals(q.id).delete();
      }
      await db.questions.where('groupId').equals(id).delete();
    },
    async deleteQuestion(id) {
      await db.questions.delete(id);
      await db.schedules.delete(id);
      await db.attempts.where('questionId').equals(id).delete();
    },
    async deleteSchedule(id) { await db.schedules.delete(id); },
    async clear() {
      await Promise.all([
        db.groups.clear(), db.questions.clear(), db.schedules.clear(),
        db.attempts.clear(), db.meta.clear(),
      ]);
    },
  };
}
