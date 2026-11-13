import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';
import type { LibraryEntry } from '../types/reelist';

const LEGACY_SEEDED_ADDED_AT: Record<string, string> = {
  '95396_tv': '2026-10-14T10:00:00.000Z',
  '136315_tv': '2026-09-20T10:00:00.000Z',
  '693134_movie': '2026-11-08T14:00:00.000Z',
  '872585_movie': '2026-11-05T14:00:00.000Z',
  '329865_movie': '2026-10-01T18:00:00.000Z',
  '666277_movie': '2026-09-12T18:00:00.000Z',
  '126308_tv': '2026-11-01T12:00:00.000Z',
  '106379_tv': '2026-08-05T12:00:00.000Z',
  '83867_tv': '2026-07-10T10:00:00.000Z',
  '70523_tv': '2026-05-01T10:00:00.000Z',
};

function isUntouchedLegacySeededEntry(entry: LibraryEntry): boolean {
  return LEGACY_SEEDED_ADDED_AT[entry.id] === entry.addedAt;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const ENTRIES_STORAGE_KEY = 'reelist_entries_v2';

export function sanitizeEntryForFirestore(uid: string, entry: LibraryEntry): LibraryEntry {
  const now = new Date().toISOString();
  const sanitized: Record<string, unknown> = {
    id: String(entry.id).slice(0, 128),
    userId: String(uid).slice(0, 128),
    tmdbId: Number(entry.tmdbId),
    mediaType: entry.mediaType === 'tv' ? 'tv' : 'movie',
    status: entry.status,
    title: String(entry.title || 'Untitled').slice(0, 300),
    posterPath: entry.posterPath ? String(entry.posterPath).slice(0, 256) : null,
    backdropPath: entry.backdropPath ? String(entry.backdropPath).slice(0, 256) : null,
    year: String(entry.year || '').slice(0, 16),
    genres: Array.isArray(entry.genres)
      ? entry.genres.slice(0, 15).map((g) => String(g).slice(0, 64))
      : [],
    addedAt: String(entry.addedAt || now).slice(0, 64),
    updatedAt: String(entry.updatedAt || now).slice(0, 64),
  };

  if (typeof entry.runtimeMinutes === 'number' && Number.isFinite(entry.runtimeMinutes)) {
    sanitized.runtimeMinutes = Math.max(0, Math.min(2000, Math.round(entry.runtimeMinutes)));
  }
  if (typeof entry.rating === 'number' && entry.rating >= 1 && entry.rating <= 10) {
    sanitized.rating = Math.round(entry.rating);
  }
  if (typeof entry.notes === 'string' && entry.notes.trim().length > 0) {
    sanitized.notes = entry.notes.slice(0, 2000);
  }
  if (typeof entry.currentSeason === 'number' && Number.isFinite(entry.currentSeason)) {
    sanitized.currentSeason = Math.max(0, Math.min(200, entry.currentSeason));
  }
  if (typeof entry.currentEpisode === 'number' && Number.isFinite(entry.currentEpisode)) {
    sanitized.currentEpisode = Math.max(0, Math.min(5000, entry.currentEpisode));
  }
  if (entry.watched && typeof entry.watched === 'object') {
    sanitized.watched = entry.watched;
  }
  if (entry.resumeSeason === null || typeof entry.resumeSeason === 'number') {
    sanitized.resumeSeason = entry.resumeSeason;
  }
  if (entry.resumeEpisode === null || typeof entry.resumeEpisode === 'number') {
    sanitized.resumeEpisode = entry.resumeEpisode;
  }
  if (typeof entry.totalEpisodes === 'number' && Number.isFinite(entry.totalEpisodes)) {
    sanitized.totalEpisodes = Math.max(0, Math.min(10000, entry.totalEpisodes));
  }
  if (typeof entry.watchedCount === 'number' && Number.isFinite(entry.watchedCount)) {
    sanitized.watchedCount = Math.max(0, Math.min(10000, entry.watchedCount));
  }
  if (typeof entry.hasNewEpisodes === 'boolean') {
    sanitized.hasNewEpisodes = entry.hasNewEpisodes;
  }
  if (typeof entry.lastWatchedAt === 'string' && entry.lastWatchedAt) {
    sanitized.lastWatchedAt = entry.lastWatchedAt.slice(0, 64);
  }
  if (typeof entry.startedAt === 'string' && entry.startedAt) {
    sanitized.startedAt = entry.startedAt.slice(0, 32);
  }
  if (typeof entry.finishedAt === 'string' && entry.finishedAt) {
    sanitized.finishedAt = entry.finishedAt.slice(0, 32);
  }
  if (Array.isArray(entry.accentGradient) && entry.accentGradient.length === 2) {
    sanitized.accentGradient = [
      String(entry.accentGradient[0]).slice(0, 32),
      String(entry.accentGradient[1]).slice(0, 32),
    ];
  }

  return sanitized as unknown as LibraryEntry;
}

export function loadLocalEntries(uid: string): LibraryEntry[] {
  try {
    const raw = localStorage.getItem(`${ENTRIES_STORAGE_KEY}_${uid}`);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const entries = parsed as LibraryEntry[];
    const cleaned = entries.filter((entry) => !isUntouchedLegacySeededEntry(entry));
    if (cleaned.length !== entries.length) {
      saveLocalEntries(uid, cleaned);
    }
    return cleaned;
  } catch {
    return [];
  }
}

export function saveLocalEntries(uid: string, entries: LibraryEntry[]): void {
  try {
    localStorage.setItem(`${ENTRIES_STORAGE_KEY}_${uid}`, JSON.stringify(entries));
  } catch {
    // Ignore storage quota errors
  }
}

async function ensureUserProfileDoc(uid: string): Promise<void> {
  if (!isFirebaseConfigured || !db || !auth.currentUser || auth.currentUser.uid !== uid) {
    return;
  }
  const userDocPath = `users/${uid}`;
  const userDocRef = doc(db, 'users', uid);
  try {
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      return;
    }
    await setDoc(userDocRef, {
      userId: uid,
      seeded: true,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userDocPath);
  }
}

async function purgeUntouchedLegacySeededDocs(uid: string, legacyIds: string[]): Promise<void> {
  if (legacyIds.length === 0 || !isFirebaseConfigured || !db) return;
  const batch = writeBatch(db);
  for (const id of legacyIds) {
    batch.delete(doc(db, 'users', uid, 'entries', id));
  }
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${uid}/entries`);
  }
}

export function subscribeEntries(
  uid: string,
  isLocalUser: boolean,
  onData: (entries: LibraryEntry[]) => void,
  onError: (message: string) => void
): Unsubscribe {
  if (isLocalUser || !isFirebaseConfigured || !db) {
    onData(loadLocalEntries(uid));
    return () => {};
  }

  const colPath = `users/${uid}/entries`;
  const colRef = collection(db, 'users', uid, 'entries');
  const entriesQuery = query(colRef, where('userId', '==', uid));

  void ensureUserProfileDoc(uid).catch((err) => {
    onError(err instanceof Error ? err.message : 'Unable to initialize user profile.');
  });

  return onSnapshot(
    entriesQuery,
    (snapshot) => {
      const list: LibraryEntry[] = [];
      const legacyIdsToPurge: string[] = [];
      snapshot.forEach((docSnap) => {
        const item = docSnap.data() as LibraryEntry;
        if (isUntouchedLegacySeededEntry(item)) {
          legacyIdsToPurge.push(item.id);
        } else {
          list.push(item);
        }
      });
      if (legacyIdsToPurge.length > 0) {
        void purgeUntouchedLegacySeededDocs(uid, legacyIdsToPurge).catch(() => {
          // Non-fatal background cleanup
        });
      }
      onData(list);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, colPath);
      } catch (formatted) {
        onError(
          formatted instanceof Error ? formatted.message : 'Unable to sync library with Firestore.'
        );
      }
    }
  );
}

export async function upsertEntry(
  uid: string,
  entry: LibraryEntry,
  isLocalUser: boolean = false
): Promise<void> {
  if (isLocalUser || !isFirebaseConfigured || !db) {
    const current = loadLocalEntries(uid);
    const idx = current.findIndex((e) => e.id === entry.id);
    const next = [...current];
    if (idx >= 0) {
      next[idx] = entry;
    } else {
      next.unshift(entry);
    }
    saveLocalEntries(uid, next);
    return;
  }

  const cleanEntry = sanitizeEntryForFirestore(uid, entry);
  const docPath = `users/${uid}/entries/${cleanEntry.id}`;
  const docRef = doc(db, 'users', uid, 'entries', cleanEntry.id);
  try {
    await setDoc(docRef, cleanEntry);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function removeEntry(
  uid: string,
  entryId: string,
  isLocalUser: boolean = false
): Promise<void> {
  if (isLocalUser || !isFirebaseConfigured || !db) {
    const current = loadLocalEntries(uid);
    saveLocalEntries(
      uid,
      current.filter((e) => e.id !== entryId)
    );
    return;
  }

  const docPath = `users/${uid}/entries/${entryId}`;
  const docRef = doc(db, 'users', uid, 'entries', entryId);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}
