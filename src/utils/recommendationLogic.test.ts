import assert from 'node:assert/strict';
import test from 'node:test';
import type { LibraryEntry, RecommendationItem } from '../types/reelist';
import {
  buildMatchReasonForSummary,
  buildTasteProfile,
  filterAndDeduplicateRecommendations,
  mapGenresToTmdbIds,
} from './recommendationLogic.ts';

function makeEntry(overrides: Partial<LibraryEntry>): LibraryEntry {
  return {
    id: '1_movie',
    tmdbId: 1,
    mediaType: 'movie',
    status: 'watched',
    title: 'Sample',
    posterPath: null,
    backdropPath: null,
    year: '2024',
    genres: [],
    addedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('buildTasteProfile weights genres by ratings and penalizes dropped/low-rated items', () => {
  const entries: LibraryEntry[] = [
    makeEntry({
      id: '10_tv',
      tmdbId: 10,
      mediaType: 'tv',
      title: 'Severance',
      status: 'watched',
      rating: 10,
      genres: ['Sci-Fi', 'Mystery'],
    }),
    makeEntry({
      id: '11_movie',
      tmdbId: 11,
      mediaType: 'movie',
      title: 'Interstellar',
      status: 'watched',
      rating: 9,
      genres: ['Sci-Fi', 'Drama'],
    }),
    makeEntry({
      id: '12_movie',
      tmdbId: 12,
      mediaType: 'movie',
      title: 'Dropped Comedy',
      status: 'dropped',
      rating: 2,
      genres: ['Comedy'],
    }),
  ];

  const profile = buildTasteProfile(entries);
  assert.equal(profile.topGenres[0], 'Sci-Fi');
  assert.ok(!profile.topGenres.includes('Comedy'));
  assert.equal(profile.favorites.length, 2);
  assert.equal(profile.disliked.length, 1);
  assert.equal(profile.disliked[0].title, 'Dropped Comedy');
  assert.deepEqual(profile.excludeKeys, ['10_tv', '11_movie', '12_movie']);
});

test('filterAndDeduplicateRecommendations removes library titles and duplicates', () => {
  const candidates: RecommendationItem[] = [
    {
      tmdbId: 10,
      mediaType: 'tv',
      title: 'Already Watched',
      posterPath: null,
      backdropPath: null,
      year: '2022',
      voteAverage: 8.5,
      overview: '',
      genres: ['Sci-Fi'],
      reason: 'Great show',
    },
    {
      tmdbId: 70523,
      mediaType: 'tv',
      title: 'Dark',
      posterPath: null,
      backdropPath: null,
      year: '2017',
      voteAverage: 8.4,
      overview: '',
      genres: ['Sci-Fi', 'Mystery'],
      reason: 'Time mystery',
    },
    {
      tmdbId: 70523,
      mediaType: 'tv',
      title: 'Dark Duplicate',
      posterPath: null,
      backdropPath: null,
      year: '2017',
      voteAverage: 8.4,
      overview: '',
      genres: ['Sci-Fi', 'Mystery'],
      reason: 'Dup',
    },
  ];

  const filtered = filterAndDeduplicateRecommendations(candidates, ['10_tv']);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].title, 'Dark');
});

test('mapGenresToTmdbIds and buildMatchReasonForSummary handle movie & TV genres', () => {
  assert.deepEqual(mapGenresToTmdbIds(['Sci-Fi', 'Mystery'], 'tv'), [10765, 9648]);
  assert.deepEqual(mapGenresToTmdbIds(['Sci-Fi', 'Drama'], 'movie'), [878, 18]);

  const reason = buildMatchReasonForSummary(
    {
      tmdbId: 70523,
      mediaType: 'tv',
      title: 'Dark',
      posterPath: null,
      backdropPath: null,
      year: '2017',
      voteAverage: 8.4,
      overview: '',
      genres: ['Sci-Fi', 'Mystery'],
    },
    ['Sci-Fi', 'Mystery'],
    [
      {
        title: 'Severance',
        mediaType: 'tv',
        year: '2022',
        genres: ['Sci-Fi', 'Mystery'],
        rating: 9,
        status: 'watched',
      },
    ]
  );
  assert.match(reason, /Severance \(9\/10\)/);
});
