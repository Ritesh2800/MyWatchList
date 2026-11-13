import type {
  EpisodeItem,
  LibraryEntry,
  LibrarySortOption,
  LibraryStatusFilter,
  MediaFilterOption,
  WatchStatus,
  WatchedEpisodesMap,
} from '../types/reelist';
import { extractCompletedYear } from './completedForm';

export interface SeasonProgress {
  seasonNumber: number;
  watchedCount: number;
  airedCount: number;
  totalCount: number;
}

export interface SeriesProgressSummary {
  watchedCount: number;
  totalAiredEpisodes: number;
  totalEpisodes: number;
  percent: number;
  resumeSeason: number | null;
  resumeEpisode: number | null;
  lastWatchedSeason: number | null;
  lastWatchedEpisode: number | null;
  isAllAiredWatched: boolean;
  hasNewEpisodes: boolean;
  seasonProgress: Record<number, SeasonProgress>;
}

export function getTodayDateString(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isEpisodeAired(airDate: string | null | undefined, todayStr: string = getTodayDateString()): boolean {
  if (!airDate) return false;
  return airDate <= todayStr;
}

function getSortedRegularSeasonNumbers(episodesBySeason: Record<number, EpisodeItem[]>): number[] {
  return Object.keys(episodesBySeason)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n >= 1)
    .sort((a, b) => a - b);
}

export function computeSeriesProgress(
  episodesBySeason: Record<number, EpisodeItem[]>,
  watchedMap: WatchedEpisodesMap = {},
  status?: WatchStatus,
  todayStr: string = getTodayDateString()
): SeriesProgressSummary {
  const seasonNums = getSortedRegularSeasonNumbers(episodesBySeason);
  const seasonProgress: Record<number, SeasonProgress> = {};

  let watchedCount = 0;
  let totalAiredEpisodes = 0;
  let totalEpisodes = 0;

  interface FlatEp {
    seasonNumber: number;
    episodeNumber: number;
    aired: boolean;
    watched: boolean;
  }

  const flatAired: FlatEp[] = [];
  let lastWatchedIdx = -1;

  for (const sNum of seasonNums) {
    const eps = [...(episodesBySeason[sNum] || [])].sort((a, b) => a.episodeNumber - b.episodeNumber);
    const watchedSet = new Set(watchedMap[String(sNum)] || []);

    let sWatched = 0;
    let sAired = 0;

    for (const ep of eps) {
      totalEpisodes += 1;
      const aired = isEpisodeAired(ep.airDate, todayStr);
      const isWatched = watchedSet.has(ep.episodeNumber);

      if (aired) {
        sAired += 1;
        totalAiredEpisodes += 1;
        if (isWatched) {
          sWatched += 1;
          watchedCount += 1;
        }
        const idx = flatAired.length;
        flatAired.push({
          seasonNumber: sNum,
          episodeNumber: ep.episodeNumber,
          aired: true,
          watched: isWatched,
        });
        if (isWatched) {
          lastWatchedIdx = idx;
        }
      }
    }

    seasonProgress[sNum] = {
      seasonNumber: sNum,
      watchedCount: sWatched,
      airedCount: sAired,
      totalCount: eps.length,
    };
  }

  let resumeSeason: number | null = null;
  let resumeEpisode: number | null = null;

  if (flatAired.length > 0) {
    if (lastWatchedIdx === -1) {
      // Nothing watched yet -> start at first aired episode (typically S1 E1)
      resumeSeason = flatAired[0].seasonNumber;
      resumeEpisode = flatAired[0].episodeNumber;
    } else {
      // Find first unwatched aired episode AFTER the last watched one
      const after = flatAired.slice(lastWatchedIdx + 1).find((e) => !e.watched);
      if (after) {
        resumeSeason = after.seasonNumber;
        resumeEpisode = after.episodeNumber;
      } else {
        // Fallback: any earlier unwatched aired episode
        const earlier = flatAired.find((e) => !e.watched);
        if (earlier) {
          resumeSeason = earlier.seasonNumber;
          resumeEpisode = earlier.episodeNumber;
        }
      }
    }
  }

  const lastWatched = lastWatchedIdx >= 0 ? flatAired[lastWatchedIdx] : null;
  const isAllAiredWatched = totalAiredEpisodes > 0 && watchedCount >= totalAiredEpisodes;
  const hasNewEpisodes = status === 'watched' && totalAiredEpisodes > watchedCount && resumeSeason !== null;
  const percent = totalAiredEpisodes > 0 ? Math.min(100, Math.round((watchedCount / totalAiredEpisodes) * 100)) : 0;

  return {
    watchedCount,
    totalAiredEpisodes,
    totalEpisodes,
    percent,
    resumeSeason,
    resumeEpisode,
    lastWatchedSeason: lastWatched ? lastWatched.seasonNumber : null,
    lastWatchedEpisode: lastWatched ? lastWatched.episodeNumber : null,
    isAllAiredWatched,
    hasNewEpisodes,
    seasonProgress,
  };
}

export function toggleEpisodeInMap(
  episodesBySeason: Record<number, EpisodeItem[]>,
  currentMap: WatchedEpisodesMap,
  seasonNumber: number,
  episodeNumber: number,
  options: { markPrevious?: boolean; todayStr?: string } = {}
): WatchedEpisodesMap {
  const { markPrevious = false, todayStr = getTodayDateString() } = options;
  const next: WatchedEpisodesMap = {};
  for (const [k, arr] of Object.entries(currentMap)) {
    next[k] = [...arr];
  }

  const seasonEps = (episodesBySeason[seasonNumber] || []).filter((e) =>
    isEpisodeAired(e.airDate, todayStr)
  );
  const targetEp = seasonEps.find((e) => e.episodeNumber === episodeNumber);
  if (!targetEp && seasonNumber >= 1) {
    return next;
  }

  const key = String(seasonNumber);
  const currentSet = new Set(next[key] || []);
  const wasWatched = currentSet.has(episodeNumber);

  if (wasWatched) {
    currentSet.delete(episodeNumber);
  } else {
    currentSet.add(episodeNumber);
    if (markPrevious && seasonNumber >= 1) {
      for (const ep of seasonEps) {
        if (ep.episodeNumber <= episodeNumber) {
          currentSet.add(ep.episodeNumber);
        }
      }
    }
  }

  if (currentSet.size === 0) {
    delete next[key];
  } else {
    next[key] = Array.from(currentSet).sort((a, b) => a - b);
  }

  return next;
}

export function markAllPreviousAcrossSeasons(
  episodesBySeason: Record<number, EpisodeItem[]>,
  currentMap: WatchedEpisodesMap,
  seasonNumber: number,
  episodeNumber: number,
  todayStr: string = getTodayDateString()
): WatchedEpisodesMap {
  const next: WatchedEpisodesMap = {};
  for (const [k, arr] of Object.entries(currentMap)) {
    next[k] = [...arr];
  }

  const seasonNums = getSortedRegularSeasonNumbers(episodesBySeason);
  for (const sNum of seasonNums) {
    if (sNum > seasonNumber) continue;
    const eps = (episodesBySeason[sNum] || []).filter((e) => isEpisodeAired(e.airDate, todayStr));
    const key = String(sNum);
    const set = new Set(next[key] || []);
    for (const ep of eps) {
      if (sNum < seasonNumber || ep.episodeNumber <= episodeNumber) {
        set.add(ep.episodeNumber);
      }
    }
    if (set.size > 0) {
      next[key] = Array.from(set).sort((a, b) => a - b);
    }
  }
  return next;
}

export function markSeasonWatchedInMap(
  episodesBySeason: Record<number, EpisodeItem[]>,
  currentMap: WatchedEpisodesMap,
  seasonNumber: number,
  todayStr: string = getTodayDateString()
): WatchedEpisodesMap {
  const next: WatchedEpisodesMap = { ...currentMap };
  const airedNums = (episodesBySeason[seasonNumber] || [])
    .filter((e) => isEpisodeAired(e.airDate, todayStr))
    .map((e) => e.episodeNumber)
    .sort((a, b) => a - b);

  if (airedNums.length > 0) {
    next[String(seasonNumber)] = airedNums;
  }
  return next;
}

export function unmarkSeasonInMap(
  currentMap: WatchedEpisodesMap,
  seasonNumber: number
): WatchedEpisodesMap {
  const next: WatchedEpisodesMap = { ...currentMap };
  delete next[String(seasonNumber)];
  return next;
}

export function markAllAiredInMap(
  episodesBySeason: Record<number, EpisodeItem[]>,
  todayStr: string = getTodayDateString()
): WatchedEpisodesMap {
  const next: WatchedEpisodesMap = {};
  for (const sNum of getSortedRegularSeasonNumbers(episodesBySeason)) {
    const airedNums = (episodesBySeason[sNum] || [])
      .filter((e) => isEpisodeAired(e.airDate, todayStr))
      .map((e) => e.episodeNumber)
      .sort((a, b) => a - b);
    if (airedNums.length > 0) {
      next[String(sNum)] = airedNums;
    }
  }
  return next;
}

export function advanceOneEpisodeInMap(
  episodesBySeason: Record<number, EpisodeItem[]>,
  currentMap: WatchedEpisodesMap,
  todayStr: string = getTodayDateString()
): { watched: WatchedEpisodesMap; summary: SeriesProgressSummary; markedSeason: number | null; markedEpisode: number | null } {
  const before = computeSeriesProgress(episodesBySeason, currentMap, undefined, todayStr);
  if (before.resumeSeason === null || before.resumeEpisode === null) {
    return { watched: currentMap, summary: before, markedSeason: null, markedEpisode: null };
  }

  const next = toggleEpisodeInMap(
    episodesBySeason,
    currentMap,
    before.resumeSeason,
    before.resumeEpisode,
    { markPrevious: false, todayStr }
  );
  const summary = computeSeriesProgress(episodesBySeason, next, undefined, todayStr);
  return {
    watched: next,
    summary,
    markedSeason: before.resumeSeason,
    markedEpisode: before.resumeEpisode,
  };
}

export interface ProfileStats {
  totalTitles: number;
  moviesCount: number;
  seriesCount: number;
  estimatedHoursWatched: number;
  topGenres: { genre: string; count: number }[];
  statusCounts: Record<WatchStatus, number>;
}

export function computeProfileStats(entries: LibraryEntry[]): ProfileStats {
  const statusCounts: Record<WatchStatus, number> = {
    watching: 0,
    watchlist: 0,
    watched: 0,
    dropped: 0,
    onhold: 0,
  };

  let moviesCount = 0;
  let seriesCount = 0;
  let totalMinutes = 0;
  const genreMap = new Map<string, number>();

  for (const entry of entries) {
    statusCounts[entry.status] = (statusCounts[entry.status] || 0) + 1;

    if (entry.mediaType === 'movie') {
      moviesCount += 1;
      if (entry.status === 'watched') {
        totalMinutes += entry.runtimeMinutes || 120;
      } else if (entry.status === 'watching') {
        totalMinutes += Math.round((entry.runtimeMinutes || 120) * 0.45);
      }
    } else {
      seriesCount += 1;
      const watchedEps = entry.watchedCount ?? 0;
      const avgEpRuntime = entry.runtimeMinutes || 45;
      totalMinutes += watchedEps * avgEpRuntime;
    }

    for (const g of entry.genres || []) {
      genreMap.set(g, (genreMap.get(g) || 0) + 1);
    }
  }

  const topGenres = Array.from(genreMap.entries())
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count || a.genre.localeCompare(b.genre))
    .slice(0, 5);

  return {
    totalTitles: entries.length,
    moviesCount,
    seriesCount,
    estimatedHoursWatched: Math.round(totalMinutes / 60),
    topGenres,
    statusCounts,
  };
}

export function getEntrySortYear(entry: LibraryEntry): number {
  const completedYear = extractCompletedYear(entry.finishedAt);
  if (entry.status === 'watched' && completedYear) {
    return Number(completedYear);
  }
  const releaseMatch = (entry.year || '').trim().match(/^(\d{4})/);
  if (releaseMatch) {
    const num = Number(releaseMatch[1]);
    if (num >= 1900 && num <= 2100) return num;
  }
  if (completedYear) {
    return Number(completedYear);
  }
  return 0;
}

export function sortAndFilterEntries(
  entries: LibraryEntry[],
  statusTab: LibraryStatusFilter,
  mediaFilter: MediaFilterOption,
  sortBy: LibrarySortOption
): LibraryEntry[] {
  const filtered = entries.filter((item) => {
    if (statusTab !== 'all' && item.status !== statusTab) return false;
    if (mediaFilter !== 'all' && item.mediaType !== mediaFilter) return false;
    return true;
  });

  return [...filtered].sort((a, b) => {
    if (sortBy === 'year_desc') {
      const ya = getEntrySortYear(a);
      const yb = getEntrySortYear(b);
      if (yb !== ya) return yb - ya;
      return (b.updatedAt || b.addedAt).localeCompare(a.updatedAt || a.addedAt);
    }
    if (sortBy === 'year_asc') {
      const ya = getEntrySortYear(a);
      const yb = getEntrySortYear(b);
      if (ya === 0 && yb !== 0) return 1;
      if (yb === 0 && ya !== 0) return -1;
      if (ya !== yb) return ya - yb;
      return (a.updatedAt || a.addedAt).localeCompare(b.updatedAt || b.addedAt);
    }
    if (sortBy === 'title') {
      return a.title.localeCompare(b.title);
    }
    if (sortBy === 'rating') {
      const ra = a.rating ?? -1;
      const rb = b.rating ?? -1;
      if (rb !== ra) return rb - ra;
      return (b.updatedAt || b.addedAt).localeCompare(a.updatedAt || a.addedAt);
    }
    // recent
    return (b.updatedAt || b.addedAt).localeCompare(a.updatedAt || a.addedAt);
  });
}

export function formatEpisodeCode(season?: number | null, episode?: number | null): string {
  if (!season || !episode) return '';
  return `S${season} · E${episode}`;
}

export function resolveStatusAfterEpisodeUpdate(
  currentStatus: WatchStatus | undefined,
  watchedCount: number
): WatchStatus {
  if ((!currentStatus || currentStatus === 'watchlist') && watchedCount > 0) {
    return 'watching';
  }
  return currentStatus || 'watching';
}

export function detectNewSeasonForCompletedSeries(
  entry: LibraryEntry,
  episodesBySeason: Record<number, EpisodeItem[]>,
  todayStr: string = getTodayDateString()
): { shouldMoveToWatching: boolean; summary: SeriesProgressSummary } {
  const summary = computeSeriesProgress(episodesBySeason, entry.watched || {}, entry.status, todayStr);
  if (
    entry.mediaType !== 'tv' ||
    entry.status !== 'watched' ||
    !summary.hasNewEpisodes ||
    summary.resumeSeason === null
  ) {
    return { shouldMoveToWatching: false, summary };
  }

  const recordedTotal = typeof entry.totalEpisodes === 'number' ? entry.totalEpisodes : 0;
  const hasMoreAiredThanRecorded = recordedTotal > 0 && summary.totalAiredEpisodes > recordedTotal;

  const watchedSeasonNums = Object.keys(entry.watched || {})
    .map(Number)
    .filter((n) => n >= 1 && (entry.watched?.[String(n)]?.length || 0) > 0);
  const maxWatchedSeason = watchedSeasonNums.length > 0 ? Math.max(...watchedSeasonNums) : 0;
  const hasNewLaterSeason = maxWatchedSeason > 0 && summary.resumeSeason > maxWatchedSeason;

  return {
    shouldMoveToWatching: hasMoreAiredThanRecorded || hasNewLaterSeason,
    summary,
  };
}
