import test from 'node:test';
import assert from 'node:assert/strict';

interface AuthContext {
  uid: string;
  email_verified: boolean;
}

const ALLOWED_KEYS = new Set([
  'id',
  'userId',
  'tmdbId',
  'mediaType',
  'status',
  'title',
  'posterPath',
  'backdropPath',
  'year',
  'genres',
  'runtimeMinutes',
  'rating',
  'notes',
  'currentSeason',
  'currentEpisode',
  'watched',
  'resumeSeason',
  'resumeEpisode',
  'totalEpisodes',
  'watchedCount',
  'hasNewEpisodes',
  'lastWatchedAt',
  'startedAt',
  'finishedAt',
  'addedAt',
  'updatedAt',
  'accentGradient',
]);

const REQUIRED_KEYS = [
  'id',
  'userId',
  'tmdbId',
  'mediaType',
  'status',
  'title',
  'year',
  'genres',
  'addedAt',
  'updatedAt',
];

function evaluateEntryWrite(
  auth: AuthContext | null,
  pathUserId: string,
  pathEntryId: string,
  payload: Record<string, unknown>,
  existing?: Record<string, unknown>
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!auth || !auth.email_verified) return 'PERMISSION_DENIED';
  if (auth.uid !== pathUserId) return 'PERMISSION_DENIED';
  const idRegex = /^[a-zA-Z0-9_\-]+$/;
  if (!pathUserId || pathUserId.length > 128 || !idRegex.test(pathUserId)) return 'PERMISSION_DENIED';
  if (!pathEntryId || pathEntryId.length > 128 || !idRegex.test(pathEntryId)) return 'PERMISSION_DENIED';

  const keys = Object.keys(payload);
  for (const req of REQUIRED_KEYS) {
    if (!(req in payload)) return 'PERMISSION_DENIED';
  }
  for (const k of keys) {
    if (!ALLOWED_KEYS.has(k)) return 'PERMISSION_DENIED';
  }

  if (payload.id !== pathEntryId || payload.userId !== pathUserId) return 'PERMISSION_DENIED';
  if (typeof payload.tmdbId !== 'number' || payload.tmdbId <= 0) return 'PERMISSION_DENIED';
  if (payload.mediaType !== 'movie' && payload.mediaType !== 'tv') return 'PERMISSION_DENIED';
  if (!['watching', 'watchlist', 'watched', 'dropped', 'onhold'].includes(String(payload.status))) {
    return 'PERMISSION_DENIED';
  }
  if (typeof payload.title !== 'string' || payload.title.length < 1 || payload.title.length > 300) {
    return 'PERMISSION_DENIED';
  }
  if (typeof payload.year !== 'string' || payload.year.length > 16) return 'PERMISSION_DENIED';
  if (!Array.isArray(payload.genres) || payload.genres.length > 15) return 'PERMISSION_DENIED';
  if (typeof payload.addedAt !== 'string' || payload.addedAt.length < 1 || payload.addedAt.length > 64) {
    return 'PERMISSION_DENIED';
  }
  if (typeof payload.updatedAt !== 'string' || payload.updatedAt.length < 1 || payload.updatedAt.length > 64) {
    return 'PERMISSION_DENIED';
  }
  if ('notes' in payload && payload.notes !== null && (typeof payload.notes !== 'string' || payload.notes.length > 2000)) {
    return 'PERMISSION_DENIED';
  }
  if ('rating' in payload && (typeof payload.rating !== 'number' || payload.rating < 1 || payload.rating > 10)) {
    return 'PERMISSION_DENIED';
  }

  if (existing) {
    if (
      payload.id !== existing.id ||
      payload.userId !== existing.userId ||
      payload.tmdbId !== existing.tmdbId ||
      payload.mediaType !== existing.mediaType ||
      payload.addedAt !== existing.addedAt
    ) {
      return 'PERMISSION_DENIED';
    }
  }

  return 'ALLOW';
}

const VALID_PAYLOAD: Record<string, unknown> = {
  id: '95396_tv',
  userId: 'user_1',
  tmdbId: 95396,
  mediaType: 'tv',
  status: 'watching',
  title: 'Severance',
  year: '2022',
  genres: ['Drama', 'Sci-Fi'],
  addedAt: '2026-11-13T00:00:00.000Z',
  updatedAt: '2026-11-13T00:00:00.000Z',
};

const VALID_AUTH: AuthContext = { uid: 'user_1', email_verified: true };

test('Valid owner payload is allowed', () => {
  assert.equal(evaluateEntryWrite(VALID_AUTH, 'user_1', '95396_tv', VALID_PAYLOAD), 'ALLOW');
});

test('Dirty Dozen #1: Unauthenticated write is denied', () => {
  assert.equal(evaluateEntryWrite(null, 'user_1', '95396_tv', VALID_PAYLOAD), 'PERMISSION_DENIED');
});

test('Dirty Dozen #2: Unverified email write is denied', () => {
  assert.equal(
    evaluateEntryWrite({ uid: 'user_1', email_verified: false }, 'user_1', '95396_tv', VALID_PAYLOAD),
    'PERMISSION_DENIED'
  );
});

test('Dirty Dozen #3: Cross-tenant write is denied', () => {
  assert.equal(
    evaluateEntryWrite({ uid: 'attacker', email_verified: true }, 'user_1', '95396_tv', VALID_PAYLOAD),
    'PERMISSION_DENIED'
  );
});

test('Dirty Dozen #4: Payload ownerId spoofing is denied', () => {
  assert.equal(
    evaluateEntryWrite(VALID_AUTH, 'user_1', '95396_tv', { ...VALID_PAYLOAD, userId: 'user_2' }),
    'PERMISSION_DENIED'
  );
});

test('Dirty Dozen #5: Entry ID mismatch is denied', () => {
  assert.equal(
    evaluateEntryWrite(VALID_AUTH, 'user_1', '95396_tv', { ...VALID_PAYLOAD, id: '693134_movie' }),
    'PERMISSION_DENIED'
  );
});

test('Dirty Dozen #6: Path ID poisoning is denied', () => {
  assert.equal(
    evaluateEntryWrite(VALID_AUTH, 'user_1', 'bad id with spaces!', {
      ...VALID_PAYLOAD,
      id: 'bad id with spaces!',
    }),
    'PERMISSION_DENIED'
  );
});

test('Dirty Dozen #7: Shadow / Ghost field injection is denied', () => {
  assert.equal(
    evaluateEntryWrite(VALID_AUTH, 'user_1', '95396_tv', { ...VALID_PAYLOAD, isAdmin: true }),
    'PERMISSION_DENIED'
  );
});

test('Dirty Dozen #8: Invalid status enum is denied', () => {
  assert.equal(
    evaluateEntryWrite(VALID_AUTH, 'user_1', '95396_tv', { ...VALID_PAYLOAD, status: 'pirated' }),
    'PERMISSION_DENIED'
  );
});

test('Dirty Dozen #9: Title string overflow is denied', () => {
  assert.equal(
    evaluateEntryWrite(VALID_AUTH, 'user_1', '95396_tv', { ...VALID_PAYLOAD, title: 'A'.repeat(301) }),
    'PERMISSION_DENIED'
  );
});

test('Dirty Dozen #10: Genres array overflow is denied', () => {
  assert.equal(
    evaluateEntryWrite(VALID_AUTH, 'user_1', '95396_tv', {
      ...VALID_PAYLOAD,
      genres: Array.from({ length: 16 }, (_, i) => `G${i}`),
    }),
    'PERMISSION_DENIED'
  );
});

test('Dirty Dozen #11: Immutable addedAt mutation on update is denied', () => {
  assert.equal(
    evaluateEntryWrite(
      VALID_AUTH,
      'user_1',
      '95396_tv',
      { ...VALID_PAYLOAD, addedAt: '2029-01-01T00:00:00.000Z' },
      VALID_PAYLOAD
    ),
    'PERMISSION_DENIED'
  );
});

test('Dirty Dozen #12: Out-of-bounds rating is denied', () => {
  assert.equal(
    evaluateEntryWrite(VALID_AUTH, 'user_1', '95396_tv', { ...VALID_PAYLOAD, rating: 99 }),
    'PERMISSION_DENIED'
  );
});
