import assert from 'node:assert/strict';
import test from 'node:test';
import {
  areNavStatesEqual,
  isValidHistoryPayload,
  navStateToPath,
  pathToNavState,
  pushNavStack,
  type NavState,
} from './navigationLogic.ts';

test('navStateToPath maps tabs and details cleanly', () => {
  assert.equal(navStateToPath({ tab: 'home' }), '/');
  assert.equal(navStateToPath({ tab: 'library' }), '/library');
  assert.equal(navStateToPath({ tab: 'search' }), '/search');
  assert.equal(navStateToPath({ tab: 'profile' }), '/profile');
  assert.equal(navStateToPath({ tab: 'statistics' }), '/statistics');
  assert.equal(navStateToPath({ tab: 'recommendations' }), '/recommendations');
  assert.equal(
    navStateToPath({ tab: 'details', detailTarget: { mediaType: 'tv', tmdbId: 5920 } }),
    '/title/tv/5920'
  );
});

test('pathToNavState parses routes and falls back to home for unknown paths', () => {
  assert.deepEqual(pathToNavState('/'), { tab: 'home' });
  assert.deepEqual(pathToNavState('/library/'), { tab: 'library' });
  assert.deepEqual(pathToNavState('/profile'), { tab: 'profile' });
  assert.deepEqual(pathToNavState('/statistics'), { tab: 'statistics' });
  assert.deepEqual(pathToNavState('/title/movie/550'), {
    tab: 'details',
    detailTarget: { mediaType: 'movie', tmdbId: 550 },
  });
  assert.deepEqual(pathToNavState('/non-existent-route'), { tab: 'home' });
});

test('pushNavStack avoids duplicate consecutive entries and preserves full trail', () => {
  const s1: NavState[] = [{ tab: 'home' }];
  const s2 = pushNavStack(s1, { tab: 'home' });
  assert.equal(s2, s1);

  const s3 = pushNavStack(s1, { tab: 'library' });
  const s4 = pushNavStack(s3, { tab: 'profile' });
  const s5 = pushNavStack(s4, { tab: 'statistics' });
  assert.deepEqual(
    s5.map((x) => x.tab),
    ['home', 'library', 'profile', 'statistics']
  );

  const d1 = pushNavStack(s5, { tab: 'details', detailTarget: { mediaType: 'movie', tmdbId: 10 } });
  const d2 = pushNavStack(d1, { tab: 'details', detailTarget: { mediaType: 'movie', tmdbId: 10 } });
  assert.equal(d2, d1);
  assert.equal(
    areNavStatesEqual(
      { tab: 'details', detailTarget: { mediaType: 'movie', tmdbId: 10 } },
      { tab: 'details', detailTarget: { mediaType: 'tv', tmdbId: 10 } }
    ),
    false
  );
});

test('isValidHistoryPayload validates serialized browser history objects', () => {
  assert.equal(isValidHistoryPayload({ navIdx: 1, stack: [{ tab: 'home' }, { tab: 'library' }] }), true);
  assert.equal(isValidHistoryPayload({ navIdx: 0, stack: [] }), false);
  assert.equal(isValidHistoryPayload(null), false);
});
