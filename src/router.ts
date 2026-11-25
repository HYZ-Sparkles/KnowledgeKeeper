export type Route =
  | { name: 'home' }
  | { name: 'group'; groupId: string };

/** Hash router: no hash (or #home) -> home; #group/<id> -> group. */
export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  if (raw.startsWith('group')) {
    const parts = raw.split('/');
    return { name: 'group', groupId: parts[1] ?? '' };
  }
  return { name: 'home' };
}

export function currentRoute(): Route {
  return parseHash(window.location.hash);
}

export function navigate(route: Route): void {
  window.location.hash = route.name === 'home'
    ? '#home'
    : `#group/${route.groupId}`;
}
