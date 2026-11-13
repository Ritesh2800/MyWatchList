import 'dotenv/config';
import { GoogleGenAI, Type } from '@google/genai';
import express, { type Express } from 'express';
import { CATALOG_DETAILS, toSummary } from '../src/data/catalog.ts';
import type {
  CastMember,
  EpisodeItem,
  LibraryEntry,
  MediaDetails,
  MediaSummary,
  RecommendationItem,
  RecommendationsResponse,
  SeasonSummary,
  WatchProvider,
} from '../src/types/reelist.ts';
import {
  buildMatchReasonForSummary,
  buildTasteProfile,
  filterAndDeduplicateRecommendations,
  mapGenresToTmdbIds,
  rankSeededRecommendations,
  type SeedCandidateBatch,
} from '../src/utils/recommendationLogic.ts';
import {
  buildProviderFallbackUrl,
  normalizeProviderKey,
} from '../src/utils/streamingLinks.ts';

const TMDB_BASE = 'https://api.themoviedb.org/3';

const DEFAULT_TMDB_READ_ACCESS_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI3MjhmMjdjZGI2ZmFiMGQ2ODY4NGQwNDZkZTZmMmVkMSIsIm5iZiI6MTc5NDU2ODE1OC4wMjU5OTk4LCJzdWIiOiI2YWY2ZWZkZWE4OGQ5YTc2N2JiMmNhNWEiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.ij_-mFzvf48DHn4uKhrtxnz86qIltltO9W369KlaHy8';
const DEFAULT_TMDB_API_KEY = '728f27cdb6fab0d68684d046de6f2ed1';

function getTmdbCredential(): { token: string; mode: 'bearer' | 'api_key' | 'none' } {
  const bearer = (process.env.TMDB_READ_ACCESS_TOKEN || DEFAULT_TMDB_READ_ACCESS_TOKEN).trim();
  if (bearer) {
    return {
      token: bearer,
      mode: bearer.length > 40 ? 'bearer' : 'api_key',
    };
  }
  const apiKey = (process.env.TMDB_API_KEY || DEFAULT_TMDB_API_KEY).trim();
  if (apiKey) {
    return {
      token: apiKey,
      mode: apiKey.length > 40 ? 'bearer' : 'api_key',
    };
  }
  return { token: '', mode: 'none' };
}

const GRADIENT_PALETTES: [string, string][] = [
  ['#d4884a', '#572d16'],
  ['#4f79d4', '#162552'],
  ['#aeb88f', '#3d4c37'],
  ['#cf728b', '#4d2236'],
  ['#7bb3b0', '#234a50'],
  ['#9e83d4', '#392869'],
];

function gradientForId(id: number): [string, string] {
  return GRADIENT_PALETTES[Math.abs(id) % GRADIENT_PALETTES.length];
}

// In-memory TTL cache for TMDB, JustWatch, and recommendations responses
const apiCache = new Map<string, { expiresAt: number; data: unknown }>();
const CACHE_TTL_MS = 1000 * 60 * 10;

async function fetchTmdbJson<T>(endpoint: string): Promise<T> {
  const cached = apiCache.get(endpoint);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data as T;
  }

  const cred = getTmdbCredential();
  if (cred.mode === 'none') {
    throw new Error('TMDB API credential not configured');
  }

  const separator = endpoint.includes('?') ? '&' : '?';
  const url =
    cred.mode === 'api_key'
      ? `${TMDB_BASE}${endpoint}${separator}api_key=${encodeURIComponent(cred.token)}`
      : `${TMDB_BASE}${endpoint}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (cred.mode === 'bearer') {
    headers.Authorization = `Bearer ${cred.token}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`TMDB request failed (${response.status})`);
  }
  const json = (await response.json()) as T;
  apiCache.set(endpoint, { expiresAt: Date.now() + CACHE_TTL_MS, data: json });
  return json;
}

const TMDB_GENRES: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
  10759: 'Action & Adventure',
  10762: 'Kids',
  10763: 'News',
  10764: 'Reality',
  10765: 'Sci-Fi & Fantasy',
  10766: 'Soap',
  10767: 'Talk',
  10768: 'War & Politics',
};

interface TmdbRawSummary {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  overview?: string;
  genre_ids?: number[];
}

function mapRawSummary(item: TmdbRawSummary, fallbackType?: 'movie' | 'tv'): MediaSummary | null {
  const mediaType =
    item.media_type === 'movie' || item.media_type === 'tv' ? item.media_type : fallbackType;
  if (!mediaType) return null;
  const rawDate = item.release_date || item.first_air_date || '';
  return {
    tmdbId: item.id,
    mediaType,
    title: item.title || item.name || 'Untitled',
    posterPath: item.poster_path ?? null,
    backdropPath: item.backdrop_path ?? null,
    year: rawDate ? rawDate.slice(0, 4) : '',
    voteAverage: Number((item.vote_average || 0).toFixed(1)),
    overview: item.overview || '',
    genres: (item.genre_ids || []).map((id) => TMDB_GENRES[id]).filter(Boolean),
    accentGradient: gradientForId(item.id),
  };
}

function getGeminiApiKey(): string {
  const raw = (process.env.GEMINI_API_KEY || '').trim();
  if (!raw || raw === 'MY_GEMINI_API_KEY') return '';
  return raw;
}

const JUSTWATCH_GRAPHQL = 'https://apis.justwatch.com/graphql';

interface JustWatchOffer {
  monetizationType?: string;
  standardWebURL?: string | null;
  package?: {
    packageId?: number;
    clearName?: string;
  };
}

interface JustWatchNodeResult {
  nodeId: string | null;
  offersByPackageId: Record<number, string>;
  offersByName: Record<string, string>;
}

function providerNameAliases(name: string): string[] {
  const norm = normalizeProviderKey(name);
  const aliases = new Set<string>([norm]);
  if (norm.includes('hotstar')) {
    aliases.add('jiohotstar');
    aliases.add('disneyhotstar');
    aliases.add('hotstar');
  }
  if (norm.includes('amazon') || norm.includes('primevideo')) {
    aliases.add('primevideo');
    aliases.add('amazonprimevideo');
    aliases.add('amazonprimevideowithads');
  }
  if (norm.includes('vimovies')) {
    aliases.add('vimoviesandtv');
    aliases.add('vimovies');
  }
  if (norm.includes('appletv')) {
    aliases.add('appletv');
    aliases.add('appletvplus');
  }
  if (norm.includes('netflix')) {
    aliases.add('netflix');
  }
  return Array.from(aliases);
}

function indexJustWatchOffers(offers: JustWatchOffer[]): {
  offersByPackageId: Record<number, string>;
  offersByName: Record<string, string>;
} {
  const offersByPackageId: Record<number, string> = {};
  const offersByName: Record<string, string> = {};

  for (const offer of offers || []) {
    const url = offer.standardWebURL?.trim();
    if (!url || !/^https?:\/\//i.test(url)) continue;
    const pkgId = offer.package?.packageId;
    const clearName = offer.package?.clearName || '';
    if (typeof pkgId === 'number' && !offersByPackageId[pkgId]) {
      offersByPackageId[pkgId] = url;
    }
    if (clearName) {
      for (const alias of providerNameAliases(clearName)) {
        if (!offersByName[alias]) {
          offersByName[alias] = url;
        }
      }
    }
  }
  return { offersByPackageId, offersByName };
}

function matchOfferUrl(
  indexed: { offersByPackageId: Record<number, string>; offersByName: Record<string, string> },
  providerId: number,
  providerName: string
): string | null {
  if (indexed.offersByPackageId[providerId]) {
    return indexed.offersByPackageId[providerId];
  }
  for (const alias of providerNameAliases(providerName)) {
    if (indexed.offersByName[alias]) {
      return indexed.offersByName[alias];
    }
  }
  return null;
}

async function resolveJustWatchTitleOffers(
  title: string,
  mediaType: 'movie' | 'tv',
  year: string
): Promise<JustWatchNodeResult> {
  const cacheKey = `jw_title_${mediaType}_${title.toLowerCase()}_${year}`;
  const cached = apiCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data as JustWatchNodeResult;
  }

  const empty: JustWatchNodeResult = { nodeId: null, offersByPackageId: {}, offersByName: {} };
  if (!title.trim()) return empty;

  try {
    const targetType = mediaType === 'tv' ? 'SHOW' : 'MOVIE';
    const targetYear = Number(year) || 0;
    const res = await fetch(JUSTWATCH_GRAPHQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
      body: JSON.stringify({
        variables: {
          country: 'IN',
          language: 'en',
          first: 5,
          filter: { searchQuery: title.trim() },
        },
        query: `query GetSearchTitles($country: Country!, $language: Language!, $first: Int!, $filter: TitleFilter) {
          popularTitles(country: $country, first: $first, filter: $filter) {
            edges {
              node {
                id
                objectType
                content(country: $country, language: $language) {
                  title
                  originalReleaseYear
                }
                offers(country: $country, platform: WEB) {
                  monetizationType
                  standardWebURL
                  package { packageId clearName }
                }
              }
            }
          }
        }`,
      }),
      signal: AbortSignal.timeout(2500),
    });

    if (!res.ok) return empty;
    const json = (await res.json()) as {
      data?: {
        popularTitles?: {
          edges?: Array<{
            node?: {
              id?: string;
              objectType?: string;
              content?: { title?: string; originalReleaseYear?: number };
              offers?: JustWatchOffer[];
            };
          }>;
        };
      };
    };

    const edges = json.data?.popularTitles?.edges || [];
    const normTarget = normalizeProviderKey(title);
    const matchingTypeEdges = edges
      .map((e) => e.node)
      .filter((n): n is NonNullable<typeof n> => Boolean(n && n.objectType === targetType));

    const best =
      matchingTypeEdges.find((n) => {
        const sameTitle = normalizeProviderKey(n.content?.title || '') === normTarget;
        const yearDiff =
          targetYear > 0 && n.content?.originalReleaseYear
            ? Math.abs(n.content.originalReleaseYear - targetYear)
            : 0;
        return sameTitle && yearDiff <= 1;
      }) ||
      matchingTypeEdges.find(
        (n) => normalizeProviderKey(n.content?.title || '') === normTarget
      ) ||
      matchingTypeEdges[0];

    if (!best) return empty;

    const indexed = indexJustWatchOffers(best.offers || []);
    const result: JustWatchNodeResult = {
      nodeId: best.id || null,
      ...indexed,
    };
    apiCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data: result });
    return result;
  } catch {
    return empty;
  }
}

async function resolveJustWatchEpisodeOffers(
  nodeId: string,
  seasonNumber: number,
  episodeNumber: number
): Promise<{ offersByPackageId: Record<number, string>; offersByName: Record<string, string> }> {
  const cacheKey = `jw_ep_${nodeId}_s${seasonNumber}_e${episodeNumber}`;
  const cached = apiCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data as {
      offersByPackageId: Record<number, string>;
      offersByName: Record<string, string>;
    };
  }

  const empty = { offersByPackageId: {}, offersByName: {} };
  try {
    const res = await fetch(JUSTWATCH_GRAPHQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
      body: JSON.stringify({
        variables: {
          nodeId,
          country: 'IN',
          language: 'en',
        },
        query: `query GetShowSeasons($nodeId: ID!, $country: Country!, $language: Language!) {
          node(id: $nodeId) {
            ... on Show {
              seasons {
                content(country: $country, language: $language) {
                  seasonNumber
                }
                episodes {
                  content(country: $country, language: $language) {
                    episodeNumber
                  }
                  offers(country: $country, platform: WEB) {
                    monetizationType
                    standardWebURL
                    package { packageId clearName }
                  }
                }
              }
            }
          }
        }`,
      }),
      signal: AbortSignal.timeout(2500),
    });

    if (!res.ok) return empty;
    const json = (await res.json()) as {
      data?: {
        node?: {
          seasons?: Array<{
            content?: { seasonNumber?: number };
            episodes?: Array<{
              content?: { episodeNumber?: number };
              offers?: JustWatchOffer[];
            }>;
          }>;
        };
      };
    };

    const seasons = json.data?.node?.seasons || [];
    for (const season of seasons) {
      const sNum = season.content?.seasonNumber;
      for (const ep of season.episodes || []) {
        const eNum = ep.content?.episodeNumber;
        if (typeof sNum === 'number' && typeof eNum === 'number') {
          const indexed = indexJustWatchOffers(ep.offers || []);
          apiCache.set(`jw_ep_${nodeId}_s${sNum}_e${eNum}`, {
            expiresAt: Date.now() + CACHE_TTL_MS,
            data: indexed,
          });
        }
      }
    }

    const updated = apiCache.get(cacheKey);
    return (
      (updated?.data as {
        offersByPackageId: Record<number, string>;
        offersByName: Record<string, string>;
      }) || empty
    );
  } catch {
    return empty;
  }
}

export function createApiApp(): Express {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/config', (_req, res) => {
    const cred = getTmdbCredential();
    res.json({
      tmdbConfigured: cred.mode !== 'none',
      geminiConfigured: Boolean(getGeminiApiKey()),
    });
  });

  app.get('/api/tmdb/trending', async (_req, res) => {
    const cred = getTmdbCredential();
    if (cred.mode === 'none') {
      res.json({
        source: 'catalog',
        results: CATALOG_DETAILS.map(toSummary),
      });
      return;
    }

    try {
      const data = await fetchTmdbJson<{ results: TmdbRawSummary[] }>(
        '/trending/all/week?language=en-US'
      );
      const results = (data.results || [])
        .map((item) => mapRawSummary(item))
        .filter((x): x is MediaSummary => x !== null)
        .slice(0, 18);
      res.json({ source: 'tmdb', results });
    } catch {
      res.json({
        source: 'catalog',
        results: CATALOG_DETAILS.map(toSummary),
      });
    }
  });

  app.get('/api/tmdb/search', async (req, res) => {
    const query = String(req.query.query || '').trim();
    const cred = getTmdbCredential();
    if (!query) {
      res.json({ source: cred.mode !== 'none' ? 'tmdb' : 'catalog', results: [] });
      return;
    }

    const searchLocal = () => {
      const q = query.toLowerCase();
      return CATALOG_DETAILS.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.genres.some((g) => g.toLowerCase().includes(q)) ||
          item.overview.toLowerCase().includes(q)
      ).map(toSummary);
    };

    if (cred.mode === 'none') {
      res.json({ source: 'catalog', results: searchLocal() });
      return;
    }

    try {
      const encoded = encodeURIComponent(query);
      const data = await fetchTmdbJson<{ results: TmdbRawSummary[] }>(
        `/search/multi?query=${encoded}&include_adult=false&language=en-US&page=1`
      );
      const results = (data.results || [])
        .map((item) => mapRawSummary(item))
        .filter((x): x is MediaSummary => x !== null)
        .slice(0, 24);
      res.json({ source: 'tmdb', results });
    } catch {
      res.json({ source: 'catalog', results: searchLocal() });
    }
  });

  app.get('/api/tmdb/details/:mediaType/:id', async (req, res) => {
    const mediaType = req.params.mediaType === 'tv' ? 'tv' : 'movie';
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'Invalid TMDB id' });
      return;
    }

    const localMatch = CATALOG_DETAILS.find(
      (item) => item.tmdbId === id && item.mediaType === mediaType
    );
    const cred = getTmdbCredential();
    if (cred.mode === 'none') {
      if (!localMatch) {
        res.status(404).json({ error: 'Title not found in catalog' });
        return;
      }
      res.json({ source: 'catalog', details: localMatch });
      return;
    }

    try {
      const raw = await fetchTmdbJson<Record<string, unknown>>(
        `/${mediaType}/${id}?append_to_response=credits,videos,watch/providers&language=en-US`
      );
      const credits = (raw.credits as { cast?: Array<Record<string, unknown>> }) || {};
      const cast: CastMember[] = (credits.cast || []).slice(0, 12).map((c) => ({
        id: Number(c.id),
        name: String(c.name || ''),
        character: String(c.character || ''),
        profilePath: (c.profile_path as string | null) ?? null,
      }));

      const videos = (raw.videos as { results?: Array<Record<string, unknown>> }) || {};
      const trailer = (videos.results || []).find(
        (v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
      );

      const providersRoot =
        (raw['watch/providers'] as {
          results?: Record<
            string,
            {
              link?: string;
              flatrate?: Array<Record<string, unknown>>;
              rent?: Array<Record<string, unknown>>;
              buy?: Array<Record<string, unknown>>;
            }
          >;
        }) || {};
      const inProviders = providersRoot.results?.IN || {};
      const rawDate = String(raw.release_date || raw.first_air_date || '');
      const yearStr = rawDate ? rawDate.slice(0, 4) : '';
      const titleStr = String(raw.title || raw.name || 'Untitled');

      const jwOffers = await resolveJustWatchTitleOffers(titleStr, mediaType, yearStr);

      const mapProvider = (
        p: Record<string, unknown>,
        type: WatchProvider['type']
      ): WatchProvider => {
        const providerId = Number(p.provider_id);
        const providerName = String(p.provider_name || '');
        const directUrl =
          matchOfferUrl(jwOffers, providerId, providerName) ||
          buildProviderFallbackUrl(providerName, titleStr, providerId);

        return {
          providerId,
          providerName,
          logoPath: (p.logo_path as string | null) ?? null,
          type,
          url: directUrl,
        };
      };

      const watchProvidersIN: WatchProvider[] = [
        ...(inProviders.flatrate || []).map((p) => mapProvider(p, 'flatrate')),
        ...(inProviders.rent || []).map((p) => mapProvider(p, 'rent')),
        ...(inProviders.buy || []).map((p) => mapProvider(p, 'buy')),
      ].slice(0, 8);

      const seasonsRaw = (raw.seasons as Array<Record<string, unknown>>) || [];
      const seasons: SeasonSummary[] = seasonsRaw.map((s) => ({
        seasonNumber: Number(s.season_number),
        name: String(s.name || `Season ${s.season_number}`),
        episodeCount: Number(s.episode_count || 0),
        airDate: (s.air_date as string | null) ?? null,
        overview: String(s.overview || ''),
      }));

      const genresRaw = (raw.genres as Array<{ name: string }>) || [];
      const epRuntimes = (raw.episode_run_time as number[]) || [];
      const runtimeMinutes =
        mediaType === 'movie'
          ? typeof raw.runtime === 'number'
            ? raw.runtime
            : null
          : (epRuntimes[0] ?? 45);

      const details: MediaDetails = {
        tmdbId: Number(raw.id),
        mediaType,
        title: titleStr,
        posterPath: (raw.poster_path as string | null) ?? null,
        backdropPath: (raw.backdrop_path as string | null) ?? null,
        year: yearStr,
        voteAverage: Number(Number(raw.vote_average || 0).toFixed(1)),
        overview: String(raw.overview || ''),
        genres: genresRaw.map((g) => g.name),
        runtimeMinutes,
        numberOfSeasons:
          typeof raw.number_of_seasons === 'number' ? raw.number_of_seasons : null,
        numberOfEpisodes:
          typeof raw.number_of_episodes === 'number' ? raw.number_of_episodes : null,
        tagline: String(raw.tagline || ''),
        statusText: String(raw.status || ''),
        seasons,
        cast,
        trailerKey: trailer ? String(trailer.key) : null,
        watchProvidersIN,
        watchLinkIN: inProviders.link ?? null,
        justWatchNodeId: jwOffers.nodeId,
        accentGradient: gradientForId(Number(raw.id)),
      };

      res.json({ source: 'tmdb', details });
    } catch {
      if (localMatch) {
        res.json({ source: 'catalog', details: localMatch });
        return;
      }
      res.status(502).json({ error: 'Unable to fetch details from TMDB' });
    }
  });

  app.get('/api/streaming/episode', async (req, res) => {
    const title = String(req.query.title || '').trim();
    const year = String(req.query.year || '').trim();
    const season = Number(req.query.season || 1);
    const episode = Number(req.query.episode || 1);
    const providerId = Number(req.query.providerId || 0);
    const providerName = String(req.query.providerName || '').trim();
    let justWatchNodeId = String(req.query.justWatchNodeId || '').trim() || null;

    if (!title || !providerName) {
      res.status(400).json({ error: 'Missing title or providerName' });
      return;
    }

    try {
      let showUrl: string | null = null;
      const titleOffers = await resolveJustWatchTitleOffers(title, 'tv', year);
      if (!justWatchNodeId) {
        justWatchNodeId = titleOffers.nodeId;
      }
      showUrl = matchOfferUrl(titleOffers, providerId, providerName);

      if (justWatchNodeId && Number.isFinite(season) && Number.isFinite(episode)) {
        const epOffers = await resolveJustWatchEpisodeOffers(justWatchNodeId, season, episode);
        const epUrl = matchOfferUrl(epOffers, providerId, providerName);
        if (epUrl) {
          res.json({ url: epUrl, isEpisodeDirect: true });
          return;
        }
      }

      if (showUrl) {
        res.json({ url: showUrl, isEpisodeDirect: false });
        return;
      }

      res.json({
        url: buildProviderFallbackUrl(providerName, title, providerId || undefined),
        isEpisodeDirect: false,
      });
    } catch {
      res.json({
        url: buildProviderFallbackUrl(providerName, title, providerId || undefined),
        isEpisodeDirect: false,
      });
    }
  });

  app.post('/api/recommendations', async (req, res) => {
    const entries = Array.isArray(req.body?.entries) ? (req.body.entries as LibraryEntry[]) : [];
    const forceRefresh = Boolean(req.body?.forceRefresh);
    const profile = buildTasteProfile(entries);
    const geminiKey = getGeminiApiKey();

    if (entries.length === 0) {
      res.json({
        source: geminiKey ? 'gemini' : 'taste-match',
        topGenres: [],
        recommendations: [],
      });
      return;
    }

    const serverCacheKey = `recs:${geminiKey ? 'gemini' : 'tmdb'}:${profile.fingerprint}`;
    if (!forceRefresh) {
      const cached = apiCache.get(serverCacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        res.json(cached.data as RecommendationsResponse);
        return;
      }
    }

    const resolveTmdbCandidate = async (
      title: string,
      mediaType: 'movie' | 'tv',
      year?: string
    ): Promise<MediaSummary | null> => {
      const cred = getTmdbCredential();
      if (cred.mode === 'none') {
        const local = CATALOG_DETAILS.find(
          (c) =>
            c.mediaType === mediaType &&
            normalizeProviderKey(c.title) === normalizeProviderKey(title)
        );
        return local ? toSummary(local) : null;
      }

      try {
        const data = await fetchTmdbJson<{ results: TmdbRawSummary[] }>(
          `/search/multi?query=${encodeURIComponent(title)}&include_adult=false&language=en-US&page=1`
        );
        const mapped = (data.results || [])
          .map((item) => mapRawSummary(item))
          .filter((x): x is MediaSummary => x !== null && x.mediaType === mediaType);
        const normTitle = normalizeProviderKey(title);
        const exact =
          mapped.find(
            (m) =>
              normalizeProviderKey(m.title) === normTitle &&
              (!year || !m.year || Math.abs(Number(m.year) - Number(year)) <= 1)
          ) ||
          mapped.find((m) => normalizeProviderKey(m.title) === normTitle) ||
          mapped[0];
        return exact || null;
      } catch {
        return null;
      }
    };

    if (geminiKey) {
      try {
        const ai = new GoogleGenAI({
          apiKey: geminiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        const favoritesText =
          profile.favorites.length > 0
            ? profile.favorites
                .map(
                  (f) =>
                    `- ${f.title} (${f.mediaType === 'tv' ? 'TV Series' : 'Movie'}, ${f.year || 'N/A'}) | Genres: ${f.genres.join(', ') || 'General'} | Status: ${f.status}${typeof f.rating === 'number' ? ` | User Rating: ${f.rating}/10` : ''}`
                )
                .join('\n')
            : 'None explicitly high-rated yet.';

        const activeText =
          profile.recentAndWatching.length > 0
            ? profile.recentAndWatching
                .map(
                  (f) =>
                    `- ${f.title} (${f.mediaType === 'tv' ? 'TV Series' : 'Movie'}) | Genres: ${f.genres.join(', ') || 'General'} | Status: ${f.status}${typeof f.rating === 'number' ? ` | User Rating: ${f.rating}/10` : ''}`
                )
                .join('\n')
            : 'None.';

        const dislikedText =
          profile.disliked.length > 0
            ? profile.disliked
                .map(
                  (f) =>
                    `- ${f.title} (${f.mediaType}) | Genres: ${f.genres.join(', ') || 'General'} | Status: ${f.status}${typeof f.rating === 'number' ? ` | User Rating: ${f.rating}/10` : ''}`
                )
                .join('\n')
            : 'None.';

        const excludeTitlesList = entries.map((e) => e.title).slice(0, 60).join(', ');

        const prompt = [
          'Analyze this user’s watch history, favorite genres, and 1-10 ratings to recommend 14 great movies and TV series they have NOT added yet.',
          `Top weighted genres: ${profile.topGenres.join(', ') || 'Varied'}.`,
          '',
          'Favorites & Watched:',
          favoritesText,
          '',
          'Currently Watching / Watchlist:',
          activeText,
          '',
          'Dropped or Low-Rated (avoid similar tone/genres):',
          dislikedText,
          '',
          `Do NOT recommend any of these titles already in their library: ${excludeTitlesList}`,
          '',
          'Return a balanced mix of movies and TV series with concise 1-sentence personalized reasons referencing their genres or rated titles.',
        ].join('\n');

        const aiResponse = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            systemInstruction:
              'You are a knowledgeable film and TV recommendation curator. Always recommend real, well-known movies and TV series matching the user taste profile.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: 'Exact official title on TMDB.' },
                  mediaType: {
                    type: Type.STRING,
                    description: 'Either "movie" or "tv".',
                  },
                  year: { type: Type.STRING, description: '4-digit release year.' },
                  reason: {
                    type: Type.STRING,
                    description:
                      'Short personalized 1-sentence reason referencing user genres or ratings.',
                  },
                },
                required: ['title', 'mediaType', 'reason'],
              },
            },
          },
        });

        const rawJson = (aiResponse.text ?? '[]').trim();
        const parsed = JSON.parse(rawJson) as Array<{
          title?: string;
          mediaType?: string;
          year?: string;
          reason?: string;
        }>;

        const resolved = await Promise.all(
          (Array.isArray(parsed) ? parsed.slice(0, 16) : []).map(async (pick) => {
            const mType: 'movie' | 'tv' = pick.mediaType === 'tv' ? 'tv' : 'movie';
            if (!pick.title) return null;
            const summary = await resolveTmdbCandidate(pick.title, mType, pick.year);
            if (!summary) return null;
            return {
              ...summary,
              reason:
                (pick.reason || '').trim() ||
                buildMatchReasonForSummary(summary, profile.topGenres, profile.favorites),
            } as RecommendationItem;
          })
        );

        const recommendations = filterAndDeduplicateRecommendations(
          resolved.filter((r): r is RecommendationItem => r !== null),
          profile.excludeKeys
        ).slice(0, 14);

        const payload: RecommendationsResponse = {
          source: 'gemini',
          model: 'gemini-4-hydrogen',
          topGenres: profile.topGenres,
          recommendations,
        };
        if (recommendations.length > 0) {
          apiCache.set(serverCacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data: payload });
        }
        res.json(payload);
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Gemini recommendation request failed.';
        if (message.includes('PERMISSION_DENIED') || message.includes('API_KEY_INVALID')) {
          res.status(403).json({
            error:
              'Gemini API key was rejected. Please verify GEMINI_API_KEY in Settings > Secrets.',
          });
          return;
        }
      }
    }

    // Built-in TMDB taste engine (works with zero Gemini env config required on Vercel)
    try {
      const cred = getTmdbCredential();
      const batches: SeedCandidateBatch[] = [];

      if (cred.mode !== 'none') {
        const seedCandidates = [...profile.favorites, ...profile.recentAndWatching]
          .filter((s) => typeof s.tmdbId === 'number' && s.tmdbId > 0)
          .slice(0, 4);

        const movieGenreIds = mapGenresToTmdbIds(profile.topGenres, 'movie').slice(0, 2);
        const tvGenreIds = mapGenresToTmdbIds(profile.topGenres, 'tv').slice(0, 2);

        const movieEndpoint =
          movieGenreIds.length > 0
            ? `/discover/movie?with_genres=${movieGenreIds.join('|')}&sort_by=vote_average.desc&vote_count.gte=250&language=en-US&page=1`
            : '/trending/movie/week?language=en-US';
        const tvEndpoint =
          tvGenreIds.length > 0
            ? `/discover/tv?with_genres=${tvGenreIds.join('|')}&sort_by=vote_average.desc&vote_count.gte=150&language=en-US&page=1`
            : '/trending/tv/week?language=en-US';

        const [seedResults, movieRes, tvRes] = await Promise.all([
          Promise.all(
            seedCandidates.map(async (seed) => {
              const recRes = await fetchTmdbJson<{ results: TmdbRawSummary[] }>(
                `/${seed.mediaType}/${seed.tmdbId}/recommendations?language=en-US&page=1`
              ).catch(() => ({ results: [] }));
              const items = (recRes.results || [])
                .map((r) => mapRawSummary(r, seed.mediaType))
                .filter((x): x is MediaSummary => x !== null)
                .slice(0, 10);
              return { seed, items };
            })
          ),
          fetchTmdbJson<{ results: TmdbRawSummary[] }>(movieEndpoint).catch(() => ({ results: [] })),
          fetchTmdbJson<{ results: TmdbRawSummary[] }>(tvEndpoint).catch(() => ({ results: [] })),
        ]);

        for (const batch of seedResults) {
          if (batch.items.length > 0) {
            batches.push(batch);
          }
        }

        const discoverPool: MediaSummary[] = [];
        const movies = (movieRes.results || [])
          .map((m) => mapRawSummary(m, 'movie'))
          .filter((x): x is MediaSummary => x !== null);
        const tv = (tvRes.results || [])
          .map((t) => mapRawSummary(t, 'tv'))
          .filter((x): x is MediaSummary => x !== null);
        const maxLen = Math.max(movies.length, tv.length);
        for (let i = 0; i < maxLen; i++) {
          if (tv[i]) discoverPool.push(tv[i]);
          if (movies[i]) discoverPool.push(movies[i]);
        }
        if (discoverPool.length > 0) {
          batches.push({ items: discoverPool });
        }
      } else {
        batches.push({ items: CATALOG_DETAILS.map(toSummary) });
      }

      const recommendations = rankSeededRecommendations(batches, profile, 14);
      const payload: RecommendationsResponse = {
        source: 'taste-match',
        topGenres: profile.topGenres,
        recommendations,
      };
      if (recommendations.length > 0) {
        apiCache.set(serverCacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data: payload });
      }
      res.json(payload);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Unable to generate recommendations.',
      });
    }
  });

  app.get('/api/tmdb/tv/:id/season/:seasonNumber', async (req, res) => {
    const id = Number(req.params.id);
    const seasonNumber = Number(req.params.seasonNumber);
    if (!Number.isFinite(id) || !Number.isFinite(seasonNumber)) {
      res.status(400).json({ error: 'Invalid season parameters' });
      return;
    }

    const localMatch = CATALOG_DETAILS.find(
      (item) => item.tmdbId === id && item.mediaType === 'tv'
    );
    const cred = getTmdbCredential();
    if (cred.mode === 'none') {
      const episodes = localMatch?.episodesBySeason?.[seasonNumber] || [];
      res.json({ source: 'catalog', episodes });
      return;
    }

    try {
      const raw = await fetchTmdbJson<{ episodes?: Array<Record<string, unknown>> }>(
        `/tv/${id}/season/${seasonNumber}?language=en-US`
      );
      const episodes: EpisodeItem[] = (raw.episodes || []).map((ep) => ({
        id: Number(ep.id),
        seasonNumber,
        episodeNumber: Number(ep.episode_number),
        name: String(ep.name || `Episode ${ep.episode_number}`),
        overview: String(ep.overview || ''),
        airDate: (ep.air_date as string | null) ?? null,
        runtime: typeof ep.runtime === 'number' ? ep.runtime : null,
        stillPath: (ep.still_path as string | null) ?? null,
      }));
      res.json({ source: 'tmdb', episodes });
    } catch {
      const episodes = localMatch?.episodesBySeason?.[seasonNumber] || [];
      res.json({ source: 'catalog', episodes });
    }
  });

  return app;
}
