export type Route =
  | { name: 'home' }
  | { name: 'group'; groupId: string }
  | { name: 'question'; questionId: string }
  | { name: 'practice'; groupId: string }
  | { name: 'import' }
  | { name: 'entry' };

/** Hash router: no hash (or #home) -> home; #group/<id> -> group;
 * #question/<id> -> question; #practice/<id> -> practice; #import -> import;
 * #entry -> entry. */
export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  if (raw.startsWith('group')) {
    const parts = raw.split('/');
    return { name: 'group', groupId: parts[1] ?? '' };
  }
  if (raw.startsWith('question/')) {
    const parts = raw.split('/');
    return { name: 'question', questionId: parts[1] ?? '' };
  }
  if (raw.startsWith('practice/')) {
    const parts = raw.split('/');
    return { name: 'practice', groupId: parts[1] ?? '' };
  }
  if (raw === 'import') return { name: 'import' };
  if (raw === 'entry') return { name: 'entry' };
  return { name: 'home' };
}

export function currentRoute(): Route {
  return parseHash(window.location.hash);
}

export function navigate(route: Route): void {
  if (route.name === 'home') {
    window.location.hash = '#home';
  } else if (route.name === 'entry') {
    window.location.hash = '#entry';
  } else if (route.name === 'import') {
    window.location.hash = '#import';
  } else if (route.name === 'question') {
    window.location.hash = `#question/${route.questionId}`;
  } else if (route.name === 'practice') {
    window.location.hash = `#practice/${route.groupId}`;
  } else {
    window.location.hash = `#group/${route.groupId}`;
  }
}
