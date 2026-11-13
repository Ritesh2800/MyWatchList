export type MediaType = 'movie' | 'tv';

export type WatchStatus = 'watching' | 'watchlist' | 'watched' | 'dropped' | 'onhold';

export type ThemePreference = 'system' | 'light' | 'dark';

export type ActiveTab =
  | 'home'
  | 'library'
  | 'search'
  | 'profile'
  | 'details'
  | 'statistics'
  | 'recommendations';

export type LibrarySortOption = 'year_desc' | 'year_asc' | 'recent' | 'title' | 'rating';

export type LibraryStatusFilter = 'all' | WatchStatus;

export type MediaFilterOption = 'all' | MediaType;

export type WatchedEpisodesMap = Record<string, number[]>;

export interface LibraryEntry {
  id: string; // `${tmdbId}_${mediaType}`
  userId?: string;
  tmdbId: number;
  mediaType: MediaType;
  status: WatchStatus;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  year: string;
  genres: string[];
  runtimeMinutes?: number;
  rating?: number;
  notes?: string;
  currentSeason?: number;
  currentEpisode?: number;
  watched?: WatchedEpisodesMap;
  resumeSeason?: number | null;
  resumeEpisode?: number | null;
  totalEpisodes?: number;
  watchedCount?: number;
  hasNewEpisodes?: boolean;
  lastWatchedAt?: string;
  startedAt?: string;
  finishedAt?: string;
  addedAt: string;
  updatedAt: string;
  accentGradient?: [string, string];
}

export interface MediaSummary {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  year: string;
  voteAverage: number;
  overview: string;
  genres: string[];
  accentGradient?: [string, string];
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
}

export interface WatchProvider {
  providerId: number;
  providerName: string;
  logoPath: string | null;
  type: 'flatrate' | 'rent' | 'buy';
  url?: string | null;
}

export interface SeasonSummary {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airDate: string | null;
  overview: string;
}

export interface EpisodeItem {
  id: number;
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  overview: string;
  airDate: string | null;
  runtime: number | null;
  stillPath: string | null;
}

export interface MediaDetails extends MediaSummary {
  runtimeMinutes: number | null;
  numberOfSeasons: number | null;
  numberOfEpisodes: number | null;
  tagline: string;
  statusText: string;
  seasons: SeasonSummary[];
  episodesBySeason?: Record<number, EpisodeItem[]>;
  cast: CastMember[];
  trailerKey: string | null;
  watchProvidersIN: WatchProvider[];
  watchLinkIN?: string | null;
  justWatchNodeId?: string | null;
}

export interface RecommendationItem extends MediaSummary {
  reason: string;
}

export interface RecommendationsResponse {
  source: 'gemini' | 'taste-match';
  model?: string;
  topGenres: string[];
  recommendations: RecommendationItem[];
  notice?: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  isLocal: boolean;
}
