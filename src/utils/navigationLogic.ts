import type { ActiveTab, MediaType } from '../types/reelist';

export interface NavState {
  tab: ActiveTab;
  detailTarget?: {
    mediaType: MediaType;
    tmdbId: number;
  };
}

export interface BrowserNavHistoryPayload {
  navIdx: number;
  stack: NavState[];
}

export function navStateToPath(state: NavState): string {
  switch (state.tab) {
    case 'home':
      return '/';
    case 'library':
      return '/library';
    case 'search':
      return '/search';
    case 'profile':
      return '/profile';
    case 'statistics':
      return '/statistics';
    case 'recommendations':
      return '/recommendations';
    case 'details':
      if (state.detailTarget) {
        return `/title/${state.detailTarget.mediaType}/${state.detailTarget.tmdbId}`;
      }
      return '/';
    default:
      return '/';
  }
}

export function pathToNavState(pathname: string): NavState {
  const normalized = pathname.replace(/\/+$/, '') || '/';

  switch (normalized) {
    case '/':
      return { tab: 'home' };
    case '/library':
      return { tab: 'library' };
    case '/search':
      return { tab: 'search' };
    case '/profile':
      return { tab: 'profile' };
    case '/statistics':
      return { tab: 'statistics' };
    case '/recommendations':
      return { tab: 'recommendations' };
    default: {
      const match = /^\/title\/(movie|tv)\/(\d+)$/.exec(normalized);
      if (match) {
        const mediaType = match[1] as MediaType;
        const tmdbId = Number(match[2]);
        if (Number.isFinite(tmdbId) && tmdbId > 0) {
          return {
            tab: 'details',
            detailTarget: { mediaType, tmdbId },
          };
        }
      }
      return { tab: 'home' };
    }
  }
}

export function areNavStatesEqual(a?: NavState | null, b?: NavState | null): boolean {
  if (!a || !b) return false;
  if (a.tab !== b.tab) return false;
  if (a.tab !== 'details') return true;
  return (
    a.detailTarget?.mediaType === b.detailTarget?.mediaType &&
    a.detailTarget?.tmdbId === b.detailTarget?.tmdbId
  );
}

const MAX_NAV_STACK_LENGTH = 50;

export function pushNavStack(currentStack: NavState[], next: NavState): NavState[] {
  const top = currentStack[currentStack.length - 1];
  if (areNavStatesEqual(top, next)) {
    return currentStack;
  }
  const appended = [...currentStack, next];
  if (appended.length > MAX_NAV_STACK_LENGTH) {
    return appended.slice(appended.length - MAX_NAV_STACK_LENGTH);
  }
  return appended;
}

export function isValidHistoryPayload(raw: unknown): raw is BrowserNavHistoryPayload {
  if (!raw || typeof raw !== 'object') return false;
  const candidate = raw as Partial<BrowserNavHistoryPayload>;
  return (
    typeof candidate.navIdx === 'number' &&
    Array.isArray(candidate.stack) &&
    candidate.stack.length > 0 &&
    typeof candidate.stack[candidate.stack.length - 1]?.tab === 'string'
  );
}
