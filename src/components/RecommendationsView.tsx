import React, { useMemo, useState } from 'react';
import type { MediaFilterOption, MediaType, RecommendationItem } from '../types/reelist';
import { RotateCcwIcon, SparklesIcon, StarIcon } from './Icons';
import { MediaArt } from './MediaArt';
import { TrendingGridSkeleton } from './SkeletonScreens';

interface RecommendationsViewProps {
  recommendations: RecommendationItem[];
  source: 'gemini' | 'taste-match';
  topGenres: string[];
  notice?: string;
  loading: boolean;
  error: string | null;
  hasLibraryEntries: boolean;
  onRefresh: () => void;
  onOpenDetails: (mediaType: MediaType, tmdbId: number) => void;
  onGoSearch: () => void;
}

export const RecommendationsView: React.FC<RecommendationsViewProps> = ({
  recommendations,
  source,
  topGenres,
  notice,
  loading,
  error,
  hasLibraryEntries,
  onRefresh,
  onOpenDetails,
  onGoSearch,
}) => {
  const [filter, setFilter] = useState<MediaFilterOption>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return recommendations;
    return recommendations.filter((item) => item.mediaType === filter);
  }, [recommendations, filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-[12px] font-semibold tracking-[0.06em] text-[var(--accent)] uppercase">
            <SparklesIcon size={14} />
            <span>{source === 'gemini' ? 'Gemini AI Picks' : 'Smart Taste Match'}</span>
          </div>
          <h1 className="mt-1 font-display text-[26px] leading-tight font-bold tracking-[-0.02em] text-[var(--ink)] md:text-[32px]">
            Recommended for you
          </h1>
          <p className="mt-1 text-[14px] text-[var(--muted)]">
            {topGenres.length > 0
              ? `Tailored from your ratings and top genres (${topGenres.slice(0, 3).join(', ')})`
              : 'Personalized movies and series based on your library activity'}
          </p>
        </div>

        {hasLibraryEntries && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="tap-press inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-[13px] font-semibold text-[var(--ink)] hover:bg-[var(--surface-subtle)] disabled:opacity-50"
          >
            <RotateCcwIcon size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh picks</span>
          </button>
        )}
      </div>

      {notice && (
        <div
          role="status"
          className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[13px] text-[var(--muted)]"
        >
          {notice}
        </div>
      )}

      {!hasLibraryEntries ? (
        <div className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
          <p className="text-[15px] font-medium text-[var(--ink)]">
            Add and rate a few movies or series first
          </p>
          <p className="mt-1.5 text-[14px] text-[var(--muted)]">
            Once your library has watch history, genres, or 1–10 ratings, personalized recommendations will appear here.
          </p>
          <button
            type="button"
            onClick={onGoSearch}
            className="tap-press mt-5 inline-flex min-h-[44px] items-center rounded-full bg-[var(--accent)] px-5 text-[14px] font-semibold text-white hover:brightness-95"
          >
            Browse titles
          </button>
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-[18px] border border-[var(--accent)]/40 bg-[var(--accent)]/10 p-6"
        >
          <p className="text-[14px] text-[var(--ink)]">{error}</p>
          <button
            type="button"
            onClick={onRefresh}
            className="tap-press mt-3 inline-flex min-h-[44px] items-center rounded-full bg-[var(--inverse-bg)] px-5 text-[13px] font-semibold text-[var(--inverse-ink)]"
          >
            Try again
          </button>
        </div>
      ) : loading && recommendations.length === 0 ? (
        <TrendingGridSkeleton count={10} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'all', label: `All (${recommendations.length})` },
                {
                  id: 'movie',
                  label: `Movies (${recommendations.filter((r) => r.mediaType === 'movie').length})`,
                },
                {
                  id: 'tv',
                  label: `Series (${recommendations.filter((r) => r.mediaType === 'tv').length})`,
                },
              ] as { id: MediaFilterOption; label: string }[]
            ).map((opt) => {
              const active = filter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFilter(opt.id)}
                  className={`tap-press min-h-[40px] rounded-full px-4 text-[13px] font-semibold transition-all duration-150 ${
                    active
                      ? 'bg-[var(--inverse-bg)] text-[var(--inverse-ink)] shadow-sm'
                      : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-[14px] text-[var(--muted)]">
              No recommendations match this filter right now.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-[repeat(auto-fill,minmax(190px,1fr))] md:gap-5">
              {filtered.map((item) => (
                <button
                  key={`${item.mediaType}_${item.tmdbId}`}
                  type="button"
                  onClick={() => onOpenDetails(item.mediaType, item.tmdbId)}
                  className="tap-press group flex min-w-0 flex-col self-start text-left transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
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
                      <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-md">
                        <StarIcon size={11} filled className="text-[var(--accent)]" />
                        {item.voteAverage}
                      </span>
                    )}
                  </div>
                  <p className="mt-2.5 truncate text-[15px] leading-snug font-semibold text-[var(--ink)]">
                    {item.title}
                  </p>
                  <p className="text-[12px] text-[var(--muted)]">
                    {item.mediaType === 'tv' ? 'Series' : 'Movie'}
                    {item.year ? ` · ${item.year}` : ''}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-[var(--muted)]">
                    {item.reason}
                  </p>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
