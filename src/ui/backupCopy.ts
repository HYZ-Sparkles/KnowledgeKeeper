import { localDay } from '../core';
import type { LibraryMeta } from '../core/types';
import { calendarValue } from './dayValue';

/** Whole local-calendar-day gap; a clock in the future is never overdue. */
export function daysSinceLocal(iso: string, now: Date = new Date()): number {
  const diff = calendarValue(localDay(now))
    - calendarValue(localDay(new Date(iso)));
  return Math.max(0, Math.round(diff / 86_400_000));
}

export interface BackupBadge {
  text: string;
  stale: boolean;
}

/** Pill copy shared by home and backup; stale drives the orange treatment. */
export function backupBadge(
  meta: LibraryMeta | null, now: Date = new Date(),
): BackupBadge {
  if (!meta?.lastBackupAt) return { text: '尚未备份', stale: true };
  const days = daysSinceLocal(meta.lastBackupAt, now);
  return { text: `上次备份 ${days} 天前`, stale: days >= 7 };
}

/** Plain-text last-backup line for the right rail. */
export function backupRailText(
  meta: LibraryMeta | null, now: Date = new Date(),
): string {
  return meta?.lastBackupAt
    ? `上次备份：${daysSinceLocal(meta.lastBackupAt, now)} 天前`
    : '上次备份：尚未备份';
}
