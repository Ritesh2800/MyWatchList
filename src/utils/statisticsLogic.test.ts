import test from 'node:test';
import assert from 'node:assert/strict';
import type { LibraryEntry } from '../types/reelist';
import {
  buildRecentMonthBuckets,
  computeLibraryStatistics,
  resolveActivityMonthKey,
} from './statisticsLogic';

function makeEntry(overrides: Partial<LibraryEntry>): LibraryEntry {
  return {
    id: '1_movie',
    tmdbId: 1,
    mediaType: 'movie',
    status: 'watched',
    title: 'Sample',
    posterPath: null,
    backdropPath: null,
    year: '2026',
    genres: [],
    addedAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
    ...overrides,
  };
}

test('buildRecentMonthBuckets builds chronological window ending at reference date', () => {
  const ref = new Date(2026, 10, 13); // Nov 13, 2026
  const buckets = buildRecentMonthBuckets(6, ref);
  assert.equal(buckets.length, 6);
  assert.deepEqual(
    buckets.map((b) => b.monthKey),
    ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']
  );
  assert.deepEqual(
    buckets.map((b) => b.label),
    ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov']
  );
});

test('resolveActivityMonthKey prioritizes finishedAt ISO date and respects year-only completion', () => {
  const withFullDate = makeEntry({ finishedAt: '2026-09-18', updatedAt: '2026-11-10T00:00:00Z' });
  assert.equal(resolveActivityMonthKey(withFullDate), '2026-09');

  const withSameYearOnly = makeEntry({ finishedAt: '2026', updatedAt: '2026-10-05T00:00:00Z' });
  assert.equal(resolveActivityMonthKey(withSameYearOnly), '2026-10');

  const withPastYearOnly = makeEntry({ finishedAt: '2022', updatedAt: '2026-11-10T00:00:00Z' });
  assert.equal(resolveActivityMonthKey(withPastYearOnly), null);

  const watchlistItem = makeEntry({ status: 'watchlist', finishedAt: undefined });
  assert.equal(resolveActivityMonthKey(watchlistItem), null);
});

test('computeLibraryStatistics aggregates monthly counts, genres, ratings, and status counts', () => {
  const ref = new Date(2026, 10, 13);
  const entries: LibraryEntry[] = [
    makeEntry({
      id: '10_movie',
      tmdbId: 10,
      mediaType: 'movie',
      status: 'watched',
      runtimeMinutes: 120,
      rating: 8,
      genres: ['Sci-Fi', 'Drama'],
      finishedAt: '2026-11-04',
    }),
    makeEntry({
      id: '11_movie',
      tmdbId: 11,
      mediaType: 'movie',
      status: 'watched',
      runtimeMinutes: 180,
      rating: 10,
      genres: ['Sci-Fi', 'Action'],
      finishedAt: '2026-10-12',
    }),
    makeEntry({
      id: '12_tv',
      tmdbId: 12,
      mediaType: 'tv',
      status: 'watching',
      runtimeMinutes: 45,
      watchedCount: 4,
      genres: ['Drama', 'Thriller'],
      lastWatchedAt: '2026-11-12T18:00:00Z',
    }),
    makeEntry({
      id: '13_movie',
      tmdbId: 13,
      mediaType: 'movie',
      status: 'watchlist',
      genres: ['Comedy'],
    }),
  ];

  const stats = computeLibraryStatistics(entries, { monthWindow: 6, now: ref });
  assert.equal(stats.totalTitles, 4);
  assert.equal(stats.moviesCount, 3);
  assert.equal(stats.seriesCount, 1);
  assert.equal(stats.completedCount, 2);
  assert.equal(stats.watchingCount, 1);
  assert.equal(stats.episodesWatched, 4);
  assert.equal(stats.estimatedHoursWatched, 8); // (120 + 180 + 4*45) / 60 = 480 / 60 = 8
  assert.equal(stats.averageRating, 9);
  assert.equal(stats.ratedCount, 2);
  assert.equal(stats.monthlyWatchTotal, 3);

  const oct = stats.monthlyActivity.find((m) => m.monthKey === '2026-10');
  const nov = stats.monthlyActivity.find((m) => m.monthKey === '2026-11');
  assert.deepEqual({ movies: oct?.movies, series: oct?.series }, { movies: 1, series: 0 });
  assert.deepEqual({ movies: nov?.movies, series: nov?.series }, { movies: 1, series: 1 });

  assert.equal(stats.genreDistribution[0].genre, 'Drama');
  assert.equal(stats.genreDistribution[0].count, 2);
  assert.equal(stats.genreDistribution[1].genre, 'Sci-Fi');
  assert.equal(stats.genreDistribution[1].count, 2);

  const completedStatus = stats.statusDistribution.find((s) => s.status === 'watched');
  assert.equal(completedStatus?.label, 'Completed');
  assert.equal(completedStatus?.count, 2);

  // Verify 'all' timeframe includes year-only completions from earlier years
  const allTimeEntries: LibraryEntry[] = [
    ...entries,
    makeEntry({
      id: '14_movie',
      tmdbId: 14,
      mediaType: 'movie',
      status: 'watched',
      finishedAt: '2022',
      updatedAt: '2026-11-10T00:00:00Z',
    }),
  ];
  const allStats = computeLibraryStatistics(allTimeEntries, { monthWindow: 'all', now: ref });
  assert.equal(allStats.monthlyWatchTotal, 4);
  const y2022 = allStats.monthlyActivity.find((m) => m.monthKey === '2022');
  const y2026 = allStats.monthlyActivity.find((m) => m.monthKey === '2026');
  assert.equal(y2022?.movies, 1);
  assert.equal(y2026?.total, 3);
});

