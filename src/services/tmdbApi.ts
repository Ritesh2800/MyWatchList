import type {
  EpisodeItem,
  LibraryEntry,
  MediaDetails,
  MediaSummary,
  MediaType,
  RecommendationsResponse,
} from '../types/reelist';

const memoryCache = new Map<string, unknown>();

function readStorageCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`reelist_cache_v1_${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { expiresAt: number; value: T };
    if (parsed.expiresAt < Date.now()) return null;
    return parsed.value;
  } catch {
    return null;
  }
}

function writeStorageCache<T>(key: string, value: T, ttlMs: number = 1000 * 60 * 30): void {
  try {
    localStorage.setItem(
      `reelist_cache_v1_${key}`,
      JSON.stringify({ expiresAt: Date.now() + ttlMs, value })
    );
  } catch {
    // Ignore storage quota errors
  }
}

async function fetchJsonCached<T>(url: string, cacheKey: string, ttlMs?: number): Promise<T> {
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey) as T;
  }
  const stored = readStorageCache<T>(cacheKey);
  if (stored && navigator.onLine === false) {
    memoryCache.set(cacheKey, stored);
    return stored;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error((errBody as { error?: string }).error || `Request failed (${res.status})`);
    }
    const data = (await res.json()) as T;
    memoryCache.set(cacheKey, data);
    writeStorageCache(cacheKey, data, ttlMs);
    return data;
  } catch (err) {
    if (stored) {
      memoryCache.set(cacheKey, stored);
      return stored;
    }
    throw err;
  }
}

export async function getServerConfig(): Promise<{
  tmdbConfigured: boolean;
  geminiConfigured?: boolean;
}> {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) return { tmdbConfigured: false, geminiConfigured: false };
    return (await res.json()) as { tmdbConfigured: boolean; geminiConfigured?: boolean };
  } catch {
    return { tmdbConfigured: false, geminiConfigured: false };
  }
}

export async function fetchTrending(): Promise<{ source: string; results: MediaSummary[] }> {
  return fetchJsonCached('/api/tmdb/trending', 'trending_week');
}

export async function searchMedia(query: string): Promise<{ source: string; results: MediaSummary[] }> {
  const q = query.trim();
  if (!q) return { source: 'local', results: [] };
  return fetchJsonCached(
    `/api/tmdb/search?query=${encodeURIComponent(q)}`,
    `search_${q.toLowerCase()}`
  );
}

export async function fetchMediaDetails(
  mediaType: MediaType,
  tmdbId: number
): Promise<{ source: string; details: MediaDetails }> {
  return fetchJsonCached(
    `/api/tmdb/details/${mediaType}/${tmdbId}`,
    `details_${mediaType}_${tmdbId}`
  );
}

export async function fetchSeasonEpisodes(
  tmdbId: number,
  seasonNumber: number
): Promise<{ source: string; episodes: EpisodeItem[] }> {
  return fetchJsonCached(
    `/api/tmdb/tv/${tmdbId}/season/${seasonNumber}`,
    `season_${tmdbId}_${seasonNumber}`
  );
}

export async function fetchEpisodeStreamingUrl(params: {
  title: string;
  year?: string;
  season: number;
  episode: number;
  providerId?: number;
  providerName: string;
  justWatchNodeId?: string | null;
}): Promise<{ url: string; isEpisodeDirect: boolean }> {
  const query = new URLSearchParams({
    title: params.title,
    year: params.year || '',
    season: String(params.season),
    episode: String(params.episode),
    providerId: String(params.providerId || 0),
    providerName: params.providerName,
    justWatchNodeId: params.justWatchNodeId || '',
  });
  const cacheKey = `ep_stream_${params.title.toLowerCase()}_${params.season}_${params.episode}_${params.providerId || params.providerName.toLowerCase()}`;
  return fetchJsonCached(`/api/streaming/episode?${query.toString()}`, cacheKey, 1000 * 60 * 60);
}

export async function fetchRecommendations(
  entries: LibraryEntry[],
  fingerprint: string,
  forceRefresh = false
): Promise<RecommendationsResponse> {
  const cacheKey = `recs_v2_${fingerprint || 'empty'}`;
  if (!forceRefresh && memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey) as RecommendationsResponse;
  }
  const stored = !forceRefresh ? readStorageCache<RecommendationsResponse>(cacheKey) : null;
  if (stored && !forceRefresh && stored.source === 'gemini') {
    memoryCache.set(cacheKey, stored);
    return stored;
  }

  const compactEntries = entries.map((e) => ({
    id: e.id,
    tmdbId: e.tmdbId,
    mediaType: e.mediaType,
    status: e.status,
    title: e.title,
    year: e.year,
    genres: e.genres,
    rating: e.rating,
  }));

  const res = await fetch('/api/recommendations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries: compactEntries, forceRefresh }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error((errBody as { error?: string }).error || `Request failed (${res.status})`);
  }

  const data = (await res.json()) as RecommendationsResponse;
  memoryCache.set(cacheKey, data);
  if (data.source === 'gemini') {
    writeStorageCache(cacheKey, data, 1000 * 60 * 60 * 6);
  }
  return data;
}

export function getTmdbImageUrl(path: string | null | undefined, size: 'w500' | 'w1280' | 'w185' = 'w500'): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (!path.startsWith('/')) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function getTmdbImageProxyUrl(
  path: string | null | undefined,
  size: 'w185' | 'w300' = 'w185'
): string | null {
  if (!path) return null;
  const trimmed = path.trim();
  if (!/^\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/i.test(trimmed)) return null;
  return `/api/tmdb/image?path=${encodeURIComponent(trimmed)}&size=${size}`;
}
