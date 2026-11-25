/** Device-local UI state: never stored in the core or in backups. */
const ENTRY_GROUP_KEY = 'kk.entry.groupId';
const IMPORT_GROUP_KEY = 'kk.import.groupId';
const HOME_BANNER_KEY = 'kk.home.installBannerDismissed';

export function isStandaloneMode(): boolean {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(display-mode: standalone)').matches;
}

export function readHomeBannerDismissed(): boolean {
  try {
    return window.localStorage.getItem(HOME_BANNER_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeHomeBannerDismissed(): void {
  try {
    window.localStorage.setItem(HOME_BANNER_KEY, '1');
  } catch {
    // Storage can be unavailable in private mode; dismissal lasts this visit.
  }
}

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

export function readImportGroupId(): string | null {
  try {
    return window.localStorage.getItem(IMPORT_GROUP_KEY);
  } catch {
    return null;
  }
}

export function writeImportGroupId(groupId: string): void {
  try {
    window.localStorage.setItem(IMPORT_GROUP_KEY, groupId);
  } catch {
    // Storage can be unavailable in private mode; the form still works.
  }
}
