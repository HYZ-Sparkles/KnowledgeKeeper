import type {
  Group, Question, Schedule, Attempt, LibraryMeta, BackupInfo,
} from '../types';

/** The only backup format this version can write or read. */
export const BACKUP_SCHEMA_VERSION = 1;

/** One JSON file holds the whole library, including derived-free raw state. */
export interface BackupSnapshot {
  schemaVersion: number;
  groups: Group[];
  questions: Question[];
  /** Keyed by question id; keeps interval stage, due day and completion. */
  schedules: Record<string, Schedule>;
  attempts: Attempt[];
  meta: LibraryMeta;
}

/** Private serialization: the UI only ever sees the resulting string. */
export function serializeBackup(snapshot: BackupSnapshot): string {
  return JSON.stringify(snapshot);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validGroup(value: unknown): boolean {
  return isRecord(value) && typeof value.id === 'string'
    && typeof value.name === 'string' && typeof value.createdAt === 'string';
}

function validQuestion(value: unknown): boolean {
  return isRecord(value) && typeof value.id === 'string'
    && typeof value.groupId === 'string' && typeof value.type === 'string'
    && typeof value.stem === 'string' && typeof value.explanation === 'string'
    && typeof value.favorite === 'boolean' && typeof value.importOrder === 'number'
    && Array.isArray(value.options) && Array.isArray(value.answer);
}

function validAttempt(value: unknown): boolean {
  return isRecord(value) && typeof value.id === 'string'
    && typeof value.questionId === 'string' && typeof value.correct === 'boolean'
    && typeof value.at === 'string'
    && (value.subIndex === null || typeof value.subIndex === 'number');
}

function validSchedule(value: unknown): boolean {
  return isRecord(value) && typeof value.stage === 'number'
    && (value.dueDate === null || typeof value.dueDate === 'string')
    && (value.completed === undefined || typeof value.completed === 'boolean');
}

/**
 * Validate a whole backup before a single write: a corrupt or foreign file
 * must leave the library untouched. The UI never parses JSON itself.
 */
export function parseBackup(json: string): BackupSnapshot {
  let root: unknown;
  try {
    root = JSON.parse(json);
  } catch {
    throw new Error('备份文件不是有效的 JSON。');
  }
  if (!isRecord(root) || !Array.isArray(root.groups)
    || !Array.isArray(root.questions) || !Array.isArray(root.attempts)
    || !isRecord(root.schedules) || !isRecord(root.meta)) {
    throw new Error('这个文件不是 KnowledgeKeeper 备份，或备份已损坏。');
  }
  if (root.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error('备份版本不受支持。');
  }
  const meta = root.meta;
  if ((meta.lastBackupAt !== null && typeof meta.lastBackupAt !== 'string')
    || !root.groups.every(validGroup)
    || !root.questions.every(validQuestion)
    || !root.attempts.every(validAttempt)
    || !Object.values(root.schedules).every(validSchedule)) {
    throw new Error('备份内容不完整或已损坏。');
  }
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    groups: root.groups as Group[],
    questions: root.questions as Question[],
    schedules: root.schedules as Record<string, Schedule>,
    attempts: root.attempts as Attempt[],
    meta: { lastBackupAt: meta.lastBackupAt as string | null },
  };
}

/** Counts and timestamp for the confirmation dialog, from a validated file. */
export function inspectBackup(json: string): BackupInfo {
  const snapshot = parseBackup(json);
  return {
    schemaVersion: snapshot.schemaVersion,
    groups: snapshot.groups.length,
    questions: snapshot.questions.length,
    lastBackupAt: snapshot.meta.lastBackupAt,
  };
}
