/** Device-local UI state: never stored in the core or in backups. */
const ENTRY_GROUP_KEY = 'kk.entry.groupId';
const IMPORT_GROUP_KEY = 'kk.import.groupId';
const HOME_BANNER_KEY = 'kk.home.installBannerDismissed';

function readValue(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeValue(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in private mode; the UI still works.
  }
}

export function isStandaloneMode(): boolean {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(display-mode: standalone)').matches;
}

export function readHomeBannerDismissed(): boolean {
  return readValue(HOME_BANNER_KEY) === '1';
}

export function writeHomeBannerDismissed(): void {
  writeValue(HOME_BANNER_KEY, '1');
}

export function readEntryGroupId(): string | null {
  return readValue(ENTRY_GROUP_KEY);
}

export function writeEntryGroupId(groupId: string): void {
  writeValue(ENTRY_GROUP_KEY, groupId);
}

export function readImportGroupId(): string | null {
  return readValue(IMPORT_GROUP_KEY);
}

export function writeImportGroupId(groupId: string): void {
  writeValue(IMPORT_GROUP_KEY, groupId);
}
