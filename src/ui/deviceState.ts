/** Device-local UI state: never stored in the core or in backups. */
const ENTRY_GROUP_KEY = 'kk.entry.groupId';

export function readEntryGroupId(): string | null {
  try {
    return window.localStorage.getItem(ENTRY_GROUP_KEY);
  } catch {
    return null;
  }
}

export function writeEntryGroupId(groupId: string): void {
  try {
    window.localStorage.setItem(ENTRY_GROUP_KEY, groupId);
  } catch {
    // Storage can be unavailable in private mode; the form still works.
  }
}
