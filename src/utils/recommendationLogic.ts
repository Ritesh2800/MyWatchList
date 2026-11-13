import type { LibraryEntry, MediaSummary, RecommendationItem } from '../types/reelist';

export interface TasteTitleSummary {
  tmdbId?: number;
  title: string;
  mediaType: 'movie' | 'tv';
  year: string;
  genres: string[];
  rating?: number;
  status: LibraryEntry['status'];
}

export interface TasteProfile {
  topGenres: string[];
  genreScores: Record<string, number>;
  favorites: TasteTitleSummary[];
  disliked: TasteTitleSummary[];
  recentAndWatching: TasteTitleSummary[];
  excludeKeys: string[];
  fingerprint: string;
}

const MOVIE_GENRE_TO_TMDB: Record<string, number> = {
  action: 28,
  adventure: 12,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  fantasy: 14,
  history: 36,
  horror: 27,
  music: 10402,
  mystery: 9648,
  romance: 10749,
  'sci-fi': 878,
  'science fiction': 878,
  thriller: 53,
  war: 10752,
  western: 37,
  'action & adventure': 28,
  'sci-fi & fantasy': 878,
};

const TV_GENRE_TO_TMDB: Record<string, number> = {
  'action & adventure': 10759,
  action: 10759,
  adventure: 10759,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  'sci-fi & fantasy': 10765,
  'sci-fi': 10765,
  'science fiction': 10765,
  fantasy: 10765,
  mystery: 9648,
  war: 10768,
  'war & politics': 10768,
  western: 37,
};

function scoreEntryWeight(entry: LibraryEntry): number {
  const hasRating = typeof entry.rating === 'number' && entry.rating > 0;
  if (entry.status === 'dropped') {
    return hasRating ? Math.min(-1, (entry.rating as number) - 6) : -2.5;
  }
  if (hasRating) {
    const r = entry.rating as number;
    if (r >= 8) return 4 + (r - 8); // 8->4, 9->5, 10->6
    if (r >= 6) return 1.5 + (r - 6) * 0.5;
    if (r === 5) return 0.5;
    return -(6 - r); // 1..4 -> negative signal
  }
  if (entry.status === 'watched') return 2.5;
  if (entry.status === 'watching') return 2;
  if (entry.status === 'onhold') return 0.5;
  return 1; // watchlist
}

export function buildTasteProfile(entries: LibraryEntry[]): TasteProfile {
  const genreScores: Record<string, number> = {};
  const favorites: TasteTitleSummary[] = [];
  const disliked: TasteTitleSummary[] = [];
  const recentAndWatching: TasteTitleSummary[] = [];
  const excludeKeys: string[] = [];

  for (const entry of entries) {
    excludeKeys.push(`${entry.tmdbId}_${entry.mediaType}`);
    const weight = scoreEntryWeight(entry);

    for (const rawGenre of entry.genres || []) {
      const genre = rawGenre.trim();
      if (!genre) continue;
      genreScores[genre] = Number(((genreScores[genre] || 0) + weight).toFixed(2));
    }

    const summary: TasteTitleSummary = {
      tmdbId: entry.tmdbId,
      title: entry.title,
      mediaType: entry.mediaType,
      year: entry.year,
      genres: entry.genres || [],
      rating: entry.rating,
      status: entry.status,
    };

    if (
      entry.status === 'dropped' ||
      (typeof entry.rating === 'number' && entry.rating > 0 && entry.rating <= 4)
    ) {
      disliked.push(summary);
    } else if (
      (typeof entry.rating === 'number' && entry.rating >= 7) ||
      entry.status === 'watched'
    ) {
      favorites.push(summary);
    } else {
      recentAndWatching.push(summary);
    }
  }

  favorites.sort((a, b) => (b.rating ?? 6) - (a.rating ?? 6));

  const topGenres = Object.entries(genreScores)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([genre]) => genre);

  const fingerprintParts = [...entries]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((e) => `${e.id}:${e.status}:${e.rating ?? ''}`);

  return {
    topGenres,
    genreScores,
    favorites: favorites.slice(0, 15),
    disliked: disliked.slice(0, 8),
    recentAndWatching: recentAndWatching.slice(0, 10),
    excludeKeys,
    fingerprint: fingerprintParts.join('|'),
  };
}

export function mapGenresToTmdbIds(
  genres: string[],
  mediaType: 'movie' | 'tv'
): number[] {
  const dict = mediaType === 'tv' ? TV_GENRE_TO_TMDB : MOVIE_GENRE_TO_TMDB;
  const ids = new Set<number>();
  for (const g of genres) {
    const id = dict[g.trim().toLowerCase()];
    if (id) ids.add(id);
  }
  return Array.from(ids);
}

export function filterAndDeduplicateRecommendations(
  items: RecommendationItem[],
  excludeKeys: Iterable<string>
): RecommendationItem[] {
  const excluded = new Set(excludeKeys);
  const seen = new Set<string>();
  const out: RecommendationItem[] = [];

  for (const item of items) {
    const key = `${item.tmdbId}_${item.mediaType}`;
    if (excluded.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function buildMatchReasonForSummary(
  item: MediaSummary,
  topGenres: string[],
  favorites: TasteTitleSummary[]
): string {
  const matchingGenres = (item.genres || []).filter((g) =>
    topGenres.some((tg) => tg.toLowerCase() === g.toLowerCase())
  );
  const similarFav = favorites.find((fav) =>
    (fav.genres || []).some((fg) =>
      (item.genres || []).some((ig) => ig.toLowerCase() === fg.toLowerCase())
    )
  );

  if (similarFav && matchingGenres.length > 0) {
    const ratingBit = typeof similarFav.rating === 'number' ? ` (${similarFav.rating}/10)` : '';
    return `Matches your ${matchingGenres.slice(0, 2).join(' & ')} taste from ${similarFav.title}${ratingBit}`;
  }
  if (matchingGenres.length > 0) {
    return `Top match for your favorite ${matchingGenres.slice(0, 2).join(' & ')} picks`;
  }
  if (item.voteAverage > 0) {
    return `Critically acclaimed ${item.mediaType === 'tv' ? 'series' : 'movie'} (${item.voteAverage}/10)`;
  }
  return 'Picked based on your library activity';
}

export interface SeedCandidateBatch {
  seed?: TasteTitleSummary;
  items: MediaSummary[];
}

export function rankSeededRecommendations(
  batches: SeedCandidateBatch[],
  profile: TasteProfile,
  limit: number = 14
): RecommendationItem[] {
  const excluded = new Set(profile.excludeKeys);
  const scored = new Map<
    string,
    { item: MediaSummary; score: number; matchedSeeds: TasteTitleSummary[] }
  >();

  for (const batch of batches) {
    const seedWeight = batch.seed
      ? typeof batch.seed.rating === 'number' && batch.seed.rating > 0
        ? batch.seed.rating / 2
        : batch.seed.status === 'watched'
          ? 3.5
          : 2.5
      : 1.2;

    batch.items.forEach((item, idx) => {
      const key = `${item.tmdbId}_${item.mediaType}`;
      if (excluded.has(key)) return;

      const positionScore = Math.max(0.2, 2.2 - idx * 0.12);
      const genreBonus = (item.genres || []).reduce((acc, g) => {
        const s = profile.genreScores[g] || 0;
        return acc + Math.max(-2, Math.min(3, s * 0.35));
      }, 0);
      const qualityBonus = item.voteAverage > 0 ? (item.voteAverage - 6) * 0.25 : 0;

      const existing = scored.get(key);
      if (existing) {
        existing.score += seedWeight + positionScore;
        if (batch.seed && !existing.matchedSeeds.some((s) => s.title === batch.seed!.title)) {
          existing.matchedSeeds.push(batch.seed);
        }
      } else {
        scored.set(key, {
          item,
          score: seedWeight + positionScore + genreBonus + qualityBonus,
          matchedSeeds: batch.seed ? [batch.seed] : [],
        });
      }
    });
  }

  return Array.from(scored.values())
    .sort((a, b) => b.score - a.score || b.item.voteAverage - a.item.voteAverage)
    .slice(0, limit)
    .map(({ item, matchedSeeds }) => {
      let reason: string;
      if (matchedSeeds.length >= 2) {
        reason = `Recommended because you enjoyed ${matchedSeeds[0].title} & ${matchedSeeds[1].title}`;
      } else if (matchedSeeds.length === 1) {
        const s = matchedSeeds[0];
        const ratingBit = typeof s.rating === 'number' && s.rating > 0 ? ` (${s.rating}/10)` : '';
        reason = `Because you ${s.status === 'watching' ? 'are watching' : 'watched'} ${s.title}${ratingBit}`;
      } else {
        reason = buildMatchReasonForSummary(item, profile.topGenres, profile.favorites);
      }
      return {
        ...item,
        reason,
      };
    });
}

