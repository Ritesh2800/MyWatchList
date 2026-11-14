import type { LibraryEntry, WatchStatus } from '../types/reelist';

export type StatisticsTimeframe = 6 | 12 | 'all';

export interface MonthlyActivityPoint {
  monthKey: string; // YYYY-MM or YYYY in 'all' mode
  label: string; // e.g. "Nov" or "2026"
  fullLabel: string; // e.g. "Nov 2026" or "2026"
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

export function resolveActivityYear(entry: LibraryEntry): number | null {
  const yearPrefixRegex = /^(\d{4})/;

  if (entry.finishedAt) {
    const match = entry.finishedAt.trim().match(yearPrefixRegex);
    if (match) {
      const y = Number(match[1]);
      if (y >= 1900 && y <= 2100) return y;
    }
  }

  if (entry.status === 'watching') {
    const activeIso = entry.lastWatchedAt || entry.startedAt || entry.updatedAt || entry.addedAt;
    const match = activeIso?.trim().match(yearPrefixRegex);
    if (match) {
      const y = Number(match[1]);
      if (y >= 1900 && y <= 2100) return y;
    }
  }

  if (entry.status === 'watched') {
    const completedIso = entry.lastWatchedAt || entry.updatedAt || entry.addedAt || entry.year;
    const match = completedIso?.trim().match(yearPrefixRegex);
    if (match) {
      const y = Number(match[1]);
      if (y >= 1900 && y <= 2100) return y;
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

export function buildAllTimeYearBuckets(
  entries: LibraryEntry[],
  now: Date = new Date()
): MonthlyActivityPoint[] {
  const currentYear = now.getFullYear();
  const activeYears: number[] = [];

  for (const entry of entries) {
    const y = resolveActivityYear(entry);
    if (y !== null) {
      activeYears.push(y);
    }
  }

  const defaultStartYear = currentYear - 4;
  const minYear = activeYears.length > 0 ? Math.min(...activeYears, defaultStartYear) : defaultStartYear;
  const maxYear = activeYears.length > 0 ? Math.max(...activeYears, currentYear) : currentYear;

  const yearSet = new Set<number>();
  if (maxYear - minYear <= 12) {
    for (let y = minYear; y <= maxYear; y += 1) {
      yearSet.add(y);
    }
  } else {
    for (const y of activeYears) {
      yearSet.add(y);
    }
    for (let y = defaultStartYear; y <= currentYear; y += 1) {
      yearSet.add(y);
    }
  }

  return Array.from(yearSet)
    .sort((a, b) => a - b)
    .map((y) => ({
      monthKey: String(y),
      label: String(y),
      fullLabel: String(y),
      movies: 0,
      series: 0,
      total: 0,
    }));
}

export function computeLibraryStatistics(
  entries: LibraryEntry[],
  options: { monthWindow?: number | 'all'; now?: Date } = {}
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

  const isAllTime = monthWindow === 'all';
  const monthlyActivity = isAllTime
    ? buildAllTimeYearBuckets(entries, now)
    : buildRecentMonthBuckets(monthWindow, now);
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

    const bucketKey = isAllTime
      ? (() => {
          const y = resolveActivityYear(entry);
          return y !== null ? String(y) : null;
        })()
      : resolveActivityMonthKey(entry);
    if (bucketKey) {
      const idx = monthIndexByKey.get(bucketKey);
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
