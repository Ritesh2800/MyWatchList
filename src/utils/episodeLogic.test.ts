import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceOneEpisodeInMap,
  computeProfileStats,
  computeSeriesProgress,
  detectNewSeasonForCompletedSeries,
  getEntrySortYear,
  markAllAiredInMap,
  markAllPreviousAcrossSeasons,
  markSeasonWatchedInMap,
  resolveStatusAfterEpisodeUpdate,
  sortAndFilterEntries,
  toggleEpisodeInMap,
  unmarkSeasonInMap,
} from './episodeLogic';
import type { EpisodeItem, LibraryEntry } from '../types/reelist';

const TODAY = '2026-11-13';

const SAMPLE_EPISODES: Record<number, EpisodeItem[]> = {
  0: [
    { id: 99, seasonNumber: 0, episodeNumber: 1, name: 'Behind the Scenes', overview: '', airDate: '2022-02-01', runtime: 25, stillPath: null },
  ],
  1: [
    { id: 1, seasonNumber: 1, episodeNumber: 1, name: 'Good News About Hell', overview: '', airDate: '2022-02-18', runtime: 57, stillPath: null },
    { id: 2, seasonNumber: 1, episodeNumber: 2, name: 'Half Loop', overview: '', airDate: '2022-02-18', runtime: 47, stillPath: null },
    { id: 3, seasonNumber: 1, episodeNumber: 3, name: 'In Perpetuity', overview: '', airDate: '2022-02-25', runtime: 50, stillPath: null },
  ],
  2: [
    { id: 4, seasonNumber: 2, episodeNumber: 1, name: 'Hello, Ms. Cobel', overview: '', airDate: '2025-01-17', runtime: 50, stillPath: null },
    { id: 5, seasonNumber: 2, episodeNumber: 2, name: 'Goodbye, Mrs. Selvig', overview: '', airDate: '2025-01-24', runtime: 48, stillPath: null },
    { id: 6, seasonNumber: 2, episodeNumber: 3, name: 'Future Episode', overview: '', airDate: '2026-12-01', runtime: 50, stillPath: null },
  ],
};

test('empty watched map starts resume point at S1 E1 and ignores specials and unaired episodes', () => {
  const progress = computeSeriesProgress(SAMPLE_EPISODES, {}, 'watching', TODAY);
  assert.equal(progress.watchedCount, 0);
  assert.equal(progress.totalAiredEpisodes, 5); // 3 in S1 + 2 aired in S2 (1 unaired excluded, S0 excluded)
  assert.equal(progress.totalEpisodes, 6);
  assert.equal(progress.resumeSeason, 1);
  assert.equal(progress.resumeEpisode, 1);
  assert.equal(progress.isAllAiredWatched, false);
});

test('resume point picks first unwatched episode after last watched episode', () => {
  const watched = { '1': [1, 2, 3], '2': [1] };
  const progress = computeSeriesProgress(SAMPLE_EPISODES, watched, 'watching', TODAY);
  assert.equal(progress.watchedCount, 4);
  assert.equal(progress.resumeSeason, 2);
  assert.equal(progress.resumeEpisode, 2);
  assert.equal(progress.percent, 80);
});

test('marking all previous across seasons fills prior episodes up to tapped episode', () => {
  const next = markAllPreviousAcrossSeasons(SAMPLE_EPISODES, {}, 2, 1, TODAY);
  assert.deepEqual(next['1'], [1, 2, 3]);
  assert.deepEqual(next['2'], [1]);
});

test('unaired episodes cannot be toggled on', () => {
  const next = toggleEpisodeInMap(SAMPLE_EPISODES, { '1': [1, 2, 3] }, 2, 3, { todayStr: TODAY });
  assert.deepEqual(next['2'], undefined);
});

test('+1 episode advances resume point step by step and detects completion', () => {
  let map = { '1': [1, 2, 3] };
  const step1 = advanceOneEpisodeInMap(SAMPLE_EPISODES, map, TODAY);
  assert.equal(step1.markedSeason, 2);
  assert.equal(step1.markedEpisode, 1);
  assert.equal(step1.summary.resumeSeason, 2);
  assert.equal(step1.summary.resumeEpisode, 2);
  assert.equal(step1.summary.isAllAiredWatched, false);

  const step2 = advanceOneEpisodeInMap(SAMPLE_EPISODES, step1.watched, TODAY);
  assert.equal(step2.markedSeason, 2);
  assert.equal(step2.markedEpisode, 2);
  assert.equal(step2.summary.isAllAiredWatched, true);
  assert.equal(step2.summary.resumeSeason, null);
});

test('new episodes after Watched status trigger hasNewEpisodes and resume point', () => {
  const watched = { '1': [1, 2, 3], '2': [1] };
  const progress = computeSeriesProgress(SAMPLE_EPISODES, watched, 'watched', TODAY);
  assert.equal(progress.hasNewEpisodes, true);
  assert.equal(progress.resumeSeason, 2);
  assert.equal(progress.resumeEpisode, 2);
});

test('markSeasonWatched and unmarkSeason preserve other seasons', () => {
  let map = markSeasonWatchedInMap(SAMPLE_EPISODES, {}, 1, TODAY);
  map = markSeasonWatchedInMap(SAMPLE_EPISODES, map, 2, TODAY);
  assert.deepEqual(map['1'], [1, 2, 3]);
  assert.deepEqual(map['2'], [1, 2]);
  map = unmarkSeasonInMap(map, 1);
  assert.equal(map['1'], undefined);
  assert.deepEqual(map['2'], [1, 2]);
});

test('markAllAiredInMap marks every aired episode across regular seasons', () => {
  const all = markAllAiredInMap(SAMPLE_EPISODES, TODAY);
  assert.deepEqual(all['1'], [1, 2, 3]);
  assert.deepEqual(all['2'], [1, 2]);
});

test('computeProfileStats computes counts, hours watched, and top genres', () => {
  const entries: LibraryEntry[] = [
    {
      id: '1_tv',
      tmdbId: 1,
      mediaType: 'tv',
      status: 'watching',
      title: 'Severance',
      posterPath: null,
      backdropPath: null,
      year: '2022',
      genres: ['Sci-Fi', 'Thriller'],
      runtimeMinutes: 50,
      watchedCount: 12,
      addedAt: '2026-10-01',
      updatedAt: '2026-11-10',
    },
    {
      id: '2_movie',
      tmdbId: 2,
      mediaType: 'movie',
      status: 'watched',
      title: 'Dune: Part Two',
      posterPath: null,
      backdropPath: null,
      year: '2024',
      genres: ['Sci-Fi', 'Adventure'],
      runtimeMinutes: 166,
      rating: 9,
      addedAt: '2026-09-01',
      updatedAt: '2026-10-15',
    },
  ];
  const stats = computeProfileStats(entries);
  assert.equal(stats.totalTitles, 2);
  assert.equal(stats.moviesCount, 1);
  assert.equal(stats.seriesCount, 1);
  // (12 * 50 + 166) / 60 = 766 / 60 = 12.76 -> 13 hours
  assert.equal(stats.estimatedHoursWatched, 13);
  assert.equal(stats.topGenres[0].genre, 'Sci-Fi');
  assert.equal(stats.topGenres[0].count, 2);
  assert.equal(stats.statusCounts.watching, 1);
  assert.equal(stats.statusCounts.watched, 1);
});

test('sortAndFilterEntries filters by status and mediaType and sorts properly', () => {
  const entries: LibraryEntry[] = [
    {
      id: '1_movie', tmdbId: 1, mediaType: 'movie', status: 'watching', title: 'Zebra',
      posterPath: null, backdropPath: null, year: '2024', genres: [], rating: 7,
      addedAt: '2026-10-01', updatedAt: '2026-10-05',
    },
    {
      id: '2_tv', tmdbId: 2, mediaType: 'tv', status: 'watching', title: 'Alpha',
      posterPath: null, backdropPath: null, year: '2024', genres: [], rating: 9,
      addedAt: '2026-10-02', updatedAt: '2026-10-10',
    },
  ];
  assert.equal(sortAndFilterEntries(entries, 'watching', 'all', 'title')[0].title, 'Alpha');
  assert.equal(sortAndFilterEntries(entries, 'watching', 'all', 'rating')[0].title, 'Alpha');
  assert.equal(sortAndFilterEntries(entries, 'watching', 'movie', 'recent').length, 1);
});

test('resolveStatusAfterEpisodeUpdate removes from watchlist to watching when any episode is completed', () => {
  assert.equal(resolveStatusAfterEpisodeUpdate('watchlist', 1), 'watching');
  assert.equal(resolveStatusAfterEpisodeUpdate('watchlist', 2), 'watching');
  assert.equal(resolveStatusAfterEpisodeUpdate('watchlist', 0), 'watchlist');
  assert.equal(resolveStatusAfterEpisodeUpdate(undefined, 1), 'watching');
  assert.equal(resolveStatusAfterEpisodeUpdate(undefined, 0), 'watching');
  assert.equal(resolveStatusAfterEpisodeUpdate('onhold', 3), 'onhold');
  assert.equal(resolveStatusAfterEpisodeUpdate('watched', 5), 'watched');
});

test('sortAndFilterEntries supports all tab and sorts by completed/release year descending', () => {
  const entries: LibraryEntry[] = [
    {
      id: '1_movie', tmdbId: 1, mediaType: 'movie', status: 'watched', title: 'Old Release Completed Later',
      posterPath: null, backdropPath: null, year: '2014', finishedAt: '2026', genres: [],
      addedAt: '2026-10-01', updatedAt: '2026-10-05',
    },
    {
      id: '2_tv', tmdbId: 2, mediaType: 'tv', status: 'watching', title: 'Active 2024 Show',
      posterPath: null, backdropPath: null, year: '2024', genres: [],
      addedAt: '2026-10-02', updatedAt: '2026-10-10',
    },
    {
      id: '3_movie', tmdbId: 3, mediaType: 'movie', status: 'dropped', title: 'Dropped 2020',
      posterPath: null, backdropPath: null, year: '2020', genres: [],
      addedAt: '2026-10-03', updatedAt: '2026-10-11',
    },
  ];
  assert.equal(getEntrySortYear(entries[0]), 2026);
  assert.equal(getEntrySortYear(entries[1]), 2024);
  const newestFirst = sortAndFilterEntries(entries, 'all', 'all', 'year_desc');
  assert.deepEqual(newestFirst.map((e) => e.id), ['1_movie', '2_tv', '3_movie']);
  const oldestFirst = sortAndFilterEntries(entries, 'all', 'all', 'year_asc');
  assert.deepEqual(oldestFirst.map((e) => e.id), ['3_movie', '2_tv', '1_movie']);
});

test('detectNewSeasonForCompletedSeries triggers move to watching when a new season releases', () => {
  const completedSeason1: LibraryEntry = {
    id: '1_tv',
    tmdbId: 1,
    mediaType: 'tv',
    status: 'watched',
    title: 'Severance',
    posterPath: null,
    backdropPath: null,
    year: '2022',
    genres: [],
    watched: { '1': [1, 2, 3] },
    watchedCount: 3,
    totalEpisodes: 3,
    addedAt: '2026-10-01',
    updatedAt: '2026-10-05',
  };

  // Season 2 has now aired in SAMPLE_EPISODES
  const detection = detectNewSeasonForCompletedSeries(completedSeason1, SAMPLE_EPISODES, TODAY);
  assert.equal(detection.shouldMoveToWatching, true);
  assert.equal(detection.summary.resumeSeason, 2);
  assert.equal(detection.summary.resumeEpisode, 1);

  // If user completed a series without checking episodes manually and totalEpisodes hasn't increased, do not bounce
  const manualNoEpisodes: LibraryEntry = {
    ...completedSeason1,
    watched: {},
    watchedCount: 0,
    totalEpisodes: 5,
  };
  const sameCount = detectNewSeasonForCompletedSeries(manualNoEpisodes, SAMPLE_EPISODES, TODAY);
  assert.equal(sameCount.shouldMoveToWatching, false);
});
