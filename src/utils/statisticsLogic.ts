import type { LibraryEntry, WatchStatus } from '../types/reelist';

export interface MonthlyActivityPoint {
  monthKey: string; // YYYY-MM
  label: string; // e.g. "Nov"
  fullLabel: string; // e.g. "Nov 2026"
  movies: number;
  series: number;
  total: number;
}

export interface GenreStat {
  genre: string;
  count: number;
  movies: number;
  series: number;
}

export interface StatusStat {
  status: WatchStatus;
  label: string;
  count: number;
}

export interface RatingStat {
  score: string;
  count: number;
}

export interface LibraryStatistics {
  totalTitles: number;
  moviesCount: number;
  seriesCount: number;
  completedCount: number;
  watchingCount: number;
  episodesWatched: number;
  estimatedHoursWatched: number;
  averageRating: number | null;
  ratedCount: number;
  monthlyActivity: MonthlyActivityPoint[];
  monthlyWatchTotal: number;
  genreDistribution: GenreStat[];
  statusDistribution: StatusStat[];
  ratingDistribution: RatingStat[];
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STATUS_DISPLAY: { id: WatchStatus; label: string }[] = [
  { id: 'watching', label: 'Watching' },
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'watched', label: 'Completed' },
  { id: 'onhold', label: 'On hold' },
  { id: 'dropped', label: 'Dropped' },
];

export function resolveActivityMonthKey(entry: LibraryEntry): string | null {
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}/;

  if (entry.finishedAt && isoDateRegex.test(entry.finishedAt)) {
    return entry.finishedAt.slice(0, 7);
  }

  if (entry.finishedAt && /^\d{4}$/.test(entry.finishedAt.trim())) {
    const finishedYear = entry.finishedAt.trim();
    const fallbackIso = entry.lastWatchedAt || entry.updatedAt || entry.addedAt;
    if (fallbackIso && fallbackIso.startsWith(finishedYear) && isoDateRegex.test(fallbackIso)) {
      return fallbackIso.slice(0, 7);
    }
    return null;
  }

  if (entry.status === 'watching') {
    const activeIso = entry.lastWatchedAt || entry.startedAt || entry.updatedAt || entry.addedAt;
    if (activeIso && isoDateRegex.test(activeIso)) {
      return activeIso.slice(0, 7);
    }
  }

  if (entry.status === 'watched') {
    const completedIso = entry.lastWatchedAt || entry.updatedAt || entry.addedAt;
    if (completedIso && isoDateRegex.test(completedIso)) {
      return completedIso.slice(0, 7);
    }
  }

  return null;
}

export function buildRecentMonthBuckets(monthCount: number, now: Date = new Date()): MonthlyActivityPoint[] {
  const count = Math.max(1, Math.min(24, monthCount));
  const buckets: MonthlyActivityPoint[] = [];
  const baseYear = now.getFullYear();
  const baseMonth = now.getMonth(); // 0-indexed

  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(baseYear, baseMonth - i, 1);
    const y = d.getFullYear();
    const mIdx = d.getMonth();
    const monthKey = `${y}-${String(mIdx + 1).padStart(2, '0')}`;
    const label = MONTH_NAMES[mIdx];
    buckets.push({
      monthKey,
      label,
      fullLabel: `${label} ${y}`,
      movies: 0,
      series: 0,
      total: 0,
    });
  }
  return buckets;
}

export function computeLibraryStatistics(
  entries: LibraryEntry[],
  options: { monthWindow?: number; now?: Date } = {}
): LibraryStatistics {
  const { monthWindow = 6, now = new Date() } = options;

  const statusCounts: Record<WatchStatus, number> = {
    watching: 0,
    watchlist: 0,
    watched: 0,
    dropped: 0,
    onhold: 0,
  };

  let moviesCount = 0;
  let seriesCount = 0;
  let episodesWatched = 0;
  let totalMinutes = 0;
  let ratingSum = 0;
  let ratedCount = 0;

  const monthlyActivity = buildRecentMonthBuckets(monthWindow, now);
  const monthIndexByKey = new Map<string, number>();
  monthlyActivity.forEach((b, idx) => monthIndexByKey.set(b.monthKey, idx));

  const genreMap = new Map<string, GenreStat>();
  const ratingCounts = new Map<number, number>();
  for (let s = 1; s <= 10; s += 1) {
    ratingCounts.set(s, 0);
  }

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
      episodesWatched += watchedEps;
      totalMinutes += watchedEps * (entry.runtimeMinutes || 45);
    }

    if (typeof entry.rating === 'number' && entry.rating >= 1 && entry.rating <= 10) {
      const rounded = Math.round(entry.rating);
      ratingSum += entry.rating;
      ratedCount += 1;
      ratingCounts.set(rounded, (ratingCounts.get(rounded) || 0) + 1);
    }

    const monthKey = resolveActivityMonthKey(entry);
    if (monthKey) {
      const idx = monthIndexByKey.get(monthKey);
      if (idx !== undefined) {
        if (entry.mediaType === 'movie') {
          monthlyActivity[idx].movies += 1;
        } else {
          monthlyActivity[idx].series += 1;
        }
        monthlyActivity[idx].total += 1;
      }
    }

    const seenGenres = new Set<string>();
    for (const rawGenre of entry.genres || []) {
      const g = rawGenre.trim();
      if (!g || seenGenres.has(g)) continue;
      seenGenres.add(g);
      const existing = genreMap.get(g) || { genre: g, count: 0, movies: 0, series: 0 };
      existing.count += 1;
      if (entry.mediaType === 'movie') existing.movies += 1;
      else existing.series += 1;
      genreMap.set(g, existing);
    }
  }

  const genreDistribution = Array.from(genreMap.values())
    .sort((a, b) => b.count - a.count || a.genre.localeCompare(b.genre))
    .slice(0, 8);

  const statusDistribution: StatusStat[] = STATUS_DISPLAY.map((s) => ({
    status: s.id,
    label: s.label,
    count: statusCounts[s.id] || 0,
  }));

  const ratingDistribution: RatingStat[] = Array.from(ratingCounts.entries()).map(([score, count]) => ({
    score: String(score),
    count,
  }));

  const monthlyWatchTotal = monthlyActivity.reduce((sum, item) => sum + item.total, 0);

  return {
    totalTitles: entries.length,
    moviesCount,
    seriesCount,
    completedCount: statusCounts.watched,
    watchingCount: statusCounts.watching,
    episodesWatched,
    estimatedHoursWatched: Math.round(totalMinutes / 60),
    averageRating: ratedCount > 0 ? Math.round((ratingSum / ratedCount) * 10) / 10 : null,
    ratedCount,
    monthlyActivity,
    monthlyWatchTotal,
    genreDistribution,
    statusDistribution,
    ratingDistribution,
  };
}
