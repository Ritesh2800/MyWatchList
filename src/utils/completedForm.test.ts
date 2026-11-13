import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCompletedPatch,
  extractCompletedYear,
  isFullIsoDate,
  isValidCompletedYear,
  normalizeRating,
} from './completedForm';

test('isValidCompletedYear validates 4-digit years between 1900 and 2100', () => {
  assert.equal(isValidCompletedYear('2026'), true);
  assert.equal(isValidCompletedYear(' 1999 '), true);
  assert.equal(isValidCompletedYear(''), false);
  assert.equal(isValidCompletedYear('26'), false);
  assert.equal(isValidCompletedYear('1899'), false);
  assert.equal(isValidCompletedYear('2101'), false);
  assert.equal(isValidCompletedYear('abcd'), false);
});

test('isFullIsoDate and extractCompletedYear parse dates and year-only strings safely', () => {
  assert.equal(isFullIsoDate('2026-11-10'), true);
  assert.equal(isFullIsoDate('2026'), false);
  assert.equal(isFullIsoDate(undefined), false);

  assert.equal(extractCompletedYear('2026'), '2026');
  assert.equal(extractCompletedYear('2025-04-18'), '2025');
  assert.equal(extractCompletedYear(''), '');
  assert.equal(extractCompletedYear(null), '');
});

test('buildCompletedPatch enforces compulsory year and preserves 1-10 rating scale', () => {
  const invalid = buildCompletedPatch({
    year: '',
    startDate: '2026-01-01',
    endDate: '2026-01-10',
    rating: 9,
    review: 'Great',
  });
  assert.equal(invalid.valid, false);

  const yearOnly = buildCompletedPatch({
    year: '2026',
    startDate: '',
    endDate: '',
    rating: 0,
    review: '   ',
  });
  assert.equal(yearOnly.valid, true);
  if (yearOnly.valid) {
    assert.deepEqual(yearOnly.patch, {
      finishedAt: '2026',
      startedAt: undefined,
      rating: undefined,
      notes: undefined,
    });
  }

  const full = buildCompletedPatch({
    year: '2026',
    startDate: '2026-10-01',
    endDate: '2026-11-10',
    rating: 9,
    review: 'Loved the finale.',
  });
  assert.equal(full.valid, true);
  if (full.valid) {
    assert.deepEqual(full.patch, {
      finishedAt: '2026-11-10',
      startedAt: '2026-10-01',
      rating: 9,
      notes: 'Loved the finale.',
    });
  }
});

test('normalizeRating clamps valid 1..10 scores and treats 0 or undefined as unset', () => {
  assert.equal(normalizeRating(undefined), 0);
  assert.equal(normalizeRating(0), 0);
  assert.equal(normalizeRating(1), 1);
  assert.equal(normalizeRating(7), 7);
  assert.equal(normalizeRating(10), 10);
  assert.equal(normalizeRating(12), 10);
});
