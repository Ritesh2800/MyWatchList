import React, { useState } from 'react';
import type {
  LibraryEntry,
  MediaSummary,
  MediaType,
  RecommendationItem,
} from '../types/reelist';
import { formatEpisodeCode } from '../utils/episodeLogic';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlayIcon,
  SparklesIcon,
  StarIcon,
} from './Icons';
import { MediaArt } from './MediaArt';
import { ContinueWatchingSkeleton, TrendingGridSkeleton } from './SkeletonScreens';
import { Statistics } from './Statistics';

interface HomeViewProps {
  entries: LibraryEntry[];
  watchingEntries: LibraryEntry[];
  entriesLoading: boolean;
  trending: MediaSummary[];
  trendingLoading: boolean;
  trendingError: string | null;
  onRetryTrending: () => void;
  recommendations: RecommendationItem[];
  recommendationsLoading: boolean;
  recommendationsSource: 'gemini' | 'taste-match';
  recommendationsError: string | null;
  onRetryRecommendations: () => void;
  onOpenRecommendations: () => void;
  onOpenDetails: (mediaType: MediaType, tmdbId: number) => void;
  onOpenStatistics: () => void;
}

function getEntryProgressPercent(entry: LibraryEntry): number {
  if (entry.mediaType === 'tv') {
    const total = entry.totalEpisodes || 0;
    const watched = entry.watchedCount || 0;
    if (total > 0) return Math.min(100, Math.max(8, Math.round((watched / total) * 100)));
    return 18;
  }
  return 45;
}

function getShortProgressLabel(entry: LibraryEntry): string {
  if (entry.mediaType === 'tv') {
    return formatEpisodeCode(entry.resumeSeason || entry.currentSeason || 1, entry.resumeEpisode || entry.currentEpisode || 1);
  }
  return 'In progress';
}

function getLongProgressLabel(entry: LibraryEntry): string {
  if (entry.mediaType === 'tv') {
    const s = entry.resumeSeason || entry.currentSeason || 1;
    const e = entry.resumeEpisode || entry.currentEpisode || 1;
    return `Season ${s} · Episode ${e}`;
  }
  return entry.runtimeMinutes ? `Movie · ${entry.runtimeMinutes}m` : 'Movie';
}

export const HomeView: React.FC<HomeViewProps> = ({
  entries,
  watchingEntries,
  entriesLoading,
  trending,
  trendingLoading,
  trendingError,
  onRetryTrending,
  recommendations,
  recommendationsLoading,
  recommendationsSource,
  recommendationsError,
  onRetryRecommendations,
  onOpenRecommendations,
  onOpenDetails,
  onOpenStatistics,
}) => {
  const [continueIndex, setContinueIndex] = useState(0);
  const safeContinueIndex =
    watchingEntries.length > 0
      ? Math.min(continueIndex, watchingEntries.length - 1)
      : 0;
  const featured = watchingEntries[safeContinueIndex] || null;
  const showContinueSkeleton = entriesLoading && watchingEntries.length === 0;

  return (
    <div className="space-y-8 md:space-y-10">
      {showContinueSkeleton && <ContinueWatchingSkeleton />}

      {/* Desktop Featured Continue Watching Banner */}
      {featured && (
        <section className="hidden md:block" aria-label="Featured continue watching">
          <div className="relative h-[290px] w-full overflow-hidden rounded-[24px] lg:h-[320px]">
            <MediaArt
              title={featured.title}
              path={featured.backdropPath || featured.posterPath}
              size="w1280"
              variant="backdrop"
              accentGradient={featured.accentGradient}
              className="h-full w-full"
            />
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.55) 65%, rgba(0,0,0,0.82) 100%)',
              }}
            />

            {/* Desktop-only circular navigation arrows to cycle through all Continue Watching titles */}
            <div className="absolute top-6 right-6 z-10 hidden items-center gap-2 md:flex">
              {watchingEntries.length > 1 && (
                <span className="rounded-full border border-white/20 bg-black/45 px-3 py-1.5 text-[12px] font-semibold text-white/90 tabular-nums backdrop-blur-md">
                  {safeContinueIndex + 1} / {watchingEntries.length}
                </span>
              )}
              <button
                type="button"
                aria-label="Previous continue watching title"
                disabled={watchingEntries.length <= 1}
                onClick={() =>
                  setContinueIndex(
                    (safeContinueIndex - 1 + watchingEntries.length) % watchingEntries.length
                  )
                }
                className="tap-press inline-flex h-[44px] w-[44px] items-center justify-center rounded-full border border-white/25 bg-black/45 text-white backdrop-blur-md transition hover:bg-black/65 disabled:cursor-default disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <ChevronLeftIcon size={18} />
              </button>
              <button
                type="button"
                aria-label="Next continue watching title"
                disabled={watchingEntries.length <= 1}
                onClick={() =>
                  setContinueIndex((safeContinueIndex + 1) % watchingEntries.length)
                }
                className="tap-press inline-flex h-[44px] w-[44px] items-center justify-center rounded-full border border-white/25 bg-black/45 text-white backdrop-blur-md transition hover:bg-black/65 disabled:cursor-default disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <ChevronRightIcon size={18} />
              </button>
            </div>

            <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-4 p-8">
              <div className="min-w-0 max-w-xl">
                <p className="text-[11px] font-semibold tracking-[0.12em] text-white/75 uppercase">
                  CONTINUE WATCHING
                </p>
                <h1 className="mt-1.5 font-display text-[36px] leading-[1.08] font-bold text-white">
                  {featured.title}
                </h1>
                <p className="mt-1.5 text-[15px] text-white/80">
                  {getLongProgressLabel(featured)}
                </p>
                <div className="mt-4 h-[4px] w-[240px] overflow-hidden rounded-full bg-white/25">
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
                    style={{ width: `${getEntryProgressPercent(featured)}%` }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => onOpenDetails(featured.mediaType, featured.tmdbId)}
                className="tap-press inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-[#141413] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <PlayIcon size={15} />
                <span>Resume</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Mobile Continue Watching Horizontal Row (also shown on desktop if there are multiple) */}
      {watchingEntries.length > 0 && (
        <section className={featured ? 'md:hidden' : ''} aria-label="Continue watching">
          <h2 className="font-display text-[20px] font-bold tracking-[-0.01em] text-[var(--ink)]">
            Continue watching
          </h2>
          <div className="no-scrollbar mt-3.5 flex gap-3.5 overflow-x-auto pb-1">
            {watchingEntries.map((entry) => {
              const pct = getEntryProgressPercent(entry);
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onOpenDetails(entry.mediaType, entry.tmdbId)}
                  className="tap-press group w-[236px] shrink-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] sm:w-[262px]"
                >
                  <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[18px]">
                    <MediaArt
                      title={entry.title}
                      path={entry.backdropPath || entry.posterPath}
                      size="w500"
                      variant="backdrop"
                      accentGradient={entry.accentGradient}
                      className="h-full w-full transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
                    />
                    <div
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-14"
                      style={{
                        background:
                          'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.45) 100%)',
                      }}
                    />
                    <div className="absolute right-3 bottom-3 left-3 h-[3.5px] overflow-hidden rounded-full bg-white/30">
                      <div
                        className="h-full rounded-full bg-[var(--accent)]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <p className="mt-2 truncate text-[15px] font-semibold text-[var(--ink)]">
                    {entry.title}
                  </p>
                  <p className="text-[13px] text-[var(--muted)] tabular-nums">
                    {getShortProgressLabel(entry)}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Activity Statistics Preview */}
      <Statistics
        entries={entries}
        loading={entriesLoading}
        variant="preview"
        onViewAll={onOpenStatistics}
      />

      {/* Recommended For You (Single-row horizontal scroll so Trending stays visible above the fold) */}
      <section aria-label="Recommended for you">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            <h2 className="font-display text-[19px] font-bold tracking-[-0.01em] text-[var(--ink)] sm:text-[20px]">
              Recommended for you
            </h2>
            {entries.length > 0 && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--accent)]">
                <SparklesIcon size={11} />
                <span>{recommendationsSource === 'gemini' ? 'Gemini AI' : 'Taste match'}</span>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenRecommendations}
            className="tap-press inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-full px-3 text-[13px] font-semibold text-[var(--accent)] hover:bg-[var(--surface-subtle)]"
          >
            <span>View all</span>
            <ChevronRightIcon size={15} />
          </button>
        </div>

        {entries.length === 0 ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5">
            <p className="text-[13px] text-[var(--muted)]">
              Rate or add titles to your library to unlock personalized AI recommendations.
            </p>
            <button
              type="button"
              onClick={onOpenRecommendations}
              className="tap-press text-[13px] font-semibold text-[var(--accent)] hover:underline"
            >
              Learn more
            </button>
          </div>
        ) : recommendationsError ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5">
            <p className="text-[13px] text-[var(--muted)]">{recommendationsError}</p>
            <button
              type="button"
              onClick={onRetryRecommendations}
              className="tap-press min-h-[36px] rounded-full bg-[var(--inverse-bg)] px-4 text-[12px] font-semibold text-[var(--inverse-ink)]"
            >
              Retry
            </button>
          </div>
        ) : recommendationsLoading && recommendations.length === 0 ? (
          <div
            className="no-scrollbar mt-3.5 flex gap-3.5 overflow-x-auto pb-1"
            aria-busy="true"
            aria-label="Loading recommendations"
          >
            {Array.from({ length: 7 }).map((_, idx) => (
              <div key={idx} className="w-[144px] shrink-0 md:w-[164px]">
                <div className="skeleton-shimmer aspect-[2/3] w-full rounded-[16px]" />
                <div className="skeleton-shimmer mt-2 h-4 w-3/4 rounded-[6px]" />
                <div className="skeleton-shimmer mt-1.5 h-3 w-1/2 rounded-[6px]" />
              </div>
            ))}
          </div>
        ) : recommendations.length === 0 ? (
          <div className="mt-3 rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 text-[13px] text-[var(--muted)]">
            No new recommendations found right now.
          </div>
        ) : (
          <div className="no-scrollbar mt-3.5 flex gap-3.5 overflow-x-auto pb-1">
            {recommendations.map((item) => (
              <button
                key={`rec_${item.mediaType}_${item.tmdbId}`}
                type="button"
                onClick={() => onOpenDetails(item.mediaType, item.tmdbId)}
                className="tap-press group flex w-[144px] shrink-0 flex-col text-left transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] md:w-[164px]"
              >
                <div className="relative aspect-[2/3] w-full overflow-hidden rounded-[16px] transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.025]">
                  <MediaArt
                    title={item.title}
                    path={item.posterPath}
                    size="w500"
                    accentGradient={item.accentGradient}
                    className="h-full w-full"
                  />
                  {item.voteAverage > 0 && (
                    <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-md">
                      <StarIcon size={10} filled className="text-[var(--accent)]" />
                      {item.voteAverage}
                    </span>
                  )}
                </div>
                <p className="mt-2 truncate text-[14px] leading-snug font-semibold text-[var(--ink)]">
                  {item.title}
                </p>
                <p className="truncate text-[12px] text-[var(--muted)]">
                  {item.mediaType === 'tv' ? 'Series' : 'Movie'}
                  {item.genres[0] ? ` · ${item.genres[0]}` : ''}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Trending This Week */}
      <section aria-label="Trending this week">
        <h2 className="font-display text-[20px] font-bold tracking-[-0.01em] text-[var(--ink)]">
          Trending this week
        </h2>

        {trendingError ? (
          <div className="mt-4 rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-6">
            <p className="text-sm text-[var(--muted)]">{trendingError}</p>
            <button
              type="button"
              onClick={onRetryTrending}
              className="mt-3 min-h-[44px] rounded-full bg-[var(--inverse-bg)] px-5 text-sm font-semibold text-[var(--inverse-ink)]"
            >
              Try again
            </button>
          </div>
        ) : trendingLoading ? (
          <TrendingGridSkeleton count={12} />
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] md:gap-5">
            {trending.map((item) => (
              <button
                key={`${item.mediaType}_${item.tmdbId}`}
                type="button"
                onClick={() => onOpenDetails(item.mediaType, item.tmdbId)}
                className="tap-press group flex min-w-0 flex-col self-start text-left transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                <div className="aspect-[2/3] w-full overflow-hidden rounded-[16px] transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.025]">
                  <MediaArt
                    title={item.title}
                    path={item.posterPath}
                    size="w500"
                    accentGradient={item.accentGradient}
                    className="h-full w-full"
                  />
                </div>
                <p className="mt-2.5 truncate text-[15px] leading-snug font-semibold text-[var(--ink)]">
                  {item.title}
                </p>
                <p className="text-[13px] text-[var(--muted)]">
                  {item.mediaType === 'tv' ? 'Series' : 'Movie'}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
