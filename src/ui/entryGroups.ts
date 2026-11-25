import type { GroupSummary } from '../core/types';

/** Default group rule shared by entry and import views. */
export function defaultGroupId(groups: GroupSummary[]): string {
  const named = groups.find((g) => g.group.name === '错题集');
  return (named ?? groups[0])?.group.id ?? '';
}
