import React, { useMemo, useState } from 'react';
import type {
  LibraryEntry,
  LibrarySortOption,
  LibraryStatusFilter,
  MediaFilterOption,
  MediaType,
  WatchStatus,
} from '../types/reelist';
import { extractCompletedYear } from '../utils/completedForm';
import { formatEpisodeCode, sortAndFilterEntries } from '../utils/episodeLogic';
import { LiquidGlassDropdown, type LiquidGlassOption } from './LiquidGlassDropdown';
import { MediaArt } from './MediaArt';
import { LibraryGridSkeleton } from './SkeletonScreens';

const SORT_OPTIONS: LiquidGlassOption[] = [
  { value: 'year_desc', label: 'Year (Recent first)' },
  { value: 'year_asc', label: 'Year (Old first)' },
  { value: 'recent', label: 'Recently added' },
  { value: 'title', label: 'Title' },
  { value: 'rating', label: 'My rating' },
];

interface LibraryViewProps {
  entries: LibraryEntry[];
  loading: boolean;
  onOpenDetails: (mediaType: MediaType, tmdbId: number) => void;
  onGoSearch: () => void;
}

const STATUS_TABS: { id: LibraryStatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'watching', label: 'Watching' },
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'watched', label: 'Completed' },
  { id: 'dropped', label: 'Dropped' },
  { id: 'onhold', label: 'On hold' },
];

const STATUS_LABELS: Record<WatchStatus, string> = {
  watching: 'Watching',
  watchlist: 'Watchlist',
  watched: 'Completed',
  dropped: 'Dropped',
  onhold: 'On hold',
};

function getPosterStatusBadge(entry: LibraryEntry): string {
  if (entry.status === 'watched') {
    const completedYear = extractCompletedYear(entry.finishedAt);
    return completedYear ? `Completed · ${completedYear}` : 'Completed';
  }
  return STATUS_LABELS[entry.status];
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  entries,
  loading,
  onOpenDetails,
  onGoSearch,
}) => {
  const [activeStatus, setActiveStatus] = useState<LibraryStatusFilter>('all');
  const [mediaFilter, setMediaFilter] = useState<MediaFilterOption>('all');
  const [sortBy, setSortBy] = useState<LibrarySortOption>('year_desc');

  const items = useMemo(
    () => sortAndFilterEntries(entries, activeStatus, mediaFilter, sortBy),
    [entries, activeStatus, mediaFilter, sortBy]
  );

  const getProgressPercent = (entry: LibraryEntry): number => {
    if (entry.mediaType === 'tv') {
      const total = entry.totalEpisodes || 0;
      const watched = entry.watchedCount || 0;
      if (total > 0) return Math.min(100, Math.max(8, Math.round((watched / total) * 100)));
      return 12;
    }
    return 45;
  };

  const getSubLabel = (entry: LibraryEntry): string | null => {
    if (entry.mediaType !== 'tv') {
      return entry.rating ? `Rated ${entry.rating}/10` : null;
    }
    const resume = formatEpisodeCode(
      entry.resumeSeason ?? entry.currentSeason,
      entry.resumeEpisode ?? entry.currentEpisode
    );
    if (entry.status === 'watching' && resume) return resume;
    if (entry.status === 'dropped' && resume) return `Stopped at ${resume}`;
    if (entry.status === 'onhold' && resume) return `Paused at ${resume}`;
    if (entry.status === 'watched' && entry.hasNewEpisodes && resume) return `New · ${resume}`;
    if (entry.watchedCount && entry.totalEpisodes) {
      return `${entry.watchedCount}/${entry.totalEpisodes} eps`;
    }
    return null;
  };

  return (
    <div>
      <h1 className="font-display text-[32px] font-bold tracking-[-0.02em] text-[var(--ink)] md:text-[36px]">
        Library
      </h1>

      {/* Horizontally scrollable status pill tabs */}
      <div
        role="tablist"
        aria-label="Library status"
        className="no-scrollbar mt-4 flex gap-2.5 overflow-x-auto pb-1"
      >
        {STATUS_TABS.map((tab) => {
          const isActive = activeStatus === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => setActiveStatus(tab.id)}
              className={`tap-press min-h-[44px] shrink-0 rounded-full px-5 text-[14px] font-semibold whitespace-nowrap transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                isActive
                  ? 'bg-[var(--inverse-bg)] text-[var(--inverse-ink)]'
                  : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--muted)]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Filter & Sort Controls */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-1" role="group" aria-label="Filter by type">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'movie', label: 'Movies' },
              { id: 'tv', label: 'Series' },
            ] as { id: MediaFilterOption; label: string }[]
          ).map((f) => {
            const active = mediaFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setMediaFilter(f.id)}
                className={`tap-press min-h-[40px] rounded-full px-3 text-[13px] font-medium whitespace-nowrap transition-colors sm:min-h-[44px] sm:px-3.5 ${
                  active
                    ? 'bg-[var(--surface-subtle)] text-[var(--ink)] font-semibold'
                    : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="relative z-20 flex items-center text-[13px] text-[var(--muted)]">
          <LiquidGlassDropdown
            ariaLabel="Sort library"
            menuLabel="Sort library"
            triggerLabel={
              SORT_OPTIONS.find((opt) => opt.value === sortBy)?.label || 'Year (Recent first)'
            }
            selectedValue={sortBy}
            options={SORT_OPTIONS}
            align="right"
            menuWidthClass="w-52"
            triggerClassName="bg-[var(--surface)] px-3.5 sm:px-4 min-h-[40px] sm:min-h-[44px]"
            onSelect={(val) => setSortBy(val as LibrarySortOption)}
          />
        </div>
      </div>

      {/* Content Grid */}
      {loading ? (
        <LibraryGridSkeleton count={9} />
      ) : items.length === 0 ? (
        <div className="mt-10 rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
          <p className="text-[15px] text-[var(--muted)]">
            Nothing here yet. Search for something to add.
          </p>
          <button
            type="button"
            onClick={onGoSearch}
            className="tap-press mt-4 min-h-[44px] rounded-full bg-[var(--inverse-bg)] px-6 text-sm font-semibold text-[var(--inverse-ink)]"
          >
            Search titles
          </button>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-[repeat(auto-fill,minmax(168px,1fr))] md:gap-5">
          {items.map((entry) => {
            const subLabel = getSubLabel(entry);
            const showStatusPill = activeStatus === 'all';
            const statusPillText = showStatusPill ? getPosterStatusBadge(entry) : null;
            const showBar =
              entry.status === 'watching' &&
              (activeStatus === 'watching' || activeStatus === 'all');
            const pct = getProgressPercent(entry);

            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => onOpenDetails(entry.mediaType, entry.tmdbId)}
                className="tap-press group flex min-w-0 flex-col self-start text-left transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                <div className="relative aspect-[2/3] w-full overflow-hidden rounded-[14px] md:rounded-[16px]">
                  <MediaArt
                    title={entry.title}
                    path={entry.posterPath}
                    size="w500"
                    accentGradient={entry.accentGradient}
                    className="h-full w-full transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
                  />

                  {(statusPillText || entry.hasNewEpisodes) && (
                    <div className="pointer-events-none absolute top-2 right-2 left-2 flex flex-wrap items-start gap-1">
                      {statusPillText && (
                        <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/20 bg-[#141413]/78 px-2.5 py-0.5 text-[11px] font-semibold leading-tight text-white shadow-sm backdrop-blur-md md:py-1">
                          {(entry.status === 'watching' || entry.status === 'watched') && (
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]"
                              aria-hidden="true"
                            />
                          )}
                          <span className="truncate">{statusPillText}</span>
                        </span>
                      )}

                      {entry.hasNewEpisodes && (
                        <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-semibold leading-tight text-white shadow-sm">
                          New episodes
                        </span>
                      )}
                    </div>
                  )}

                  {showBar && (
                    <div className="absolute right-2.5 bottom-2.5 left-2.5 h-[3.5px] overflow-hidden rounded-full bg-white/30">
                      <div
                        className="h-full rounded-full bg-[var(--accent)]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>

                <p className="mt-2 line-clamp-2 text-[13px] leading-snug font-semibold text-[var(--ink)] md:text-[15px]">
                  {entry.title}
                </p>
                {subLabel && (
                  <p className="mt-0.5 truncate text-[12px] text-[var(--muted)] tabular-nums">
                    {subLabel}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
