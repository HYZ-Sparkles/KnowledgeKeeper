import type {
  Group, Question, Schedule, Attempt, LibraryMeta,
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
