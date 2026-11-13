import React, { useEffect, useState } from 'react';
import { searchMedia } from '../services/tmdbApi';
import type { LibraryEntry, MediaSummary, MediaType, WatchStatus } from '../types/reelist';
import { CompletedModal } from './CompletedModal';
import { CloseIcon, PlusIcon, SearchIcon } from './Icons';
import { LiquidGlassDropdown, type LiquidGlassOption } from './LiquidGlassDropdown';
import { MediaArt } from './MediaArt';

interface SearchViewProps {
  trending: MediaSummary[];
  entriesByKey: Record<string, LibraryEntry>;
  onOpenDetails: (mediaType: MediaType, tmdbId: number) => void;
  onQuickSetStatus: (
    summary: MediaSummary,
    status: WatchStatus,
    patch?: Partial<LibraryEntry>
  ) => Promise<void>;
  onRemoveEntry: (entryId: string) => Promise<void>;
}

const STATUS_LABELS: Record<WatchStatus, string> = {
  watching: 'Watching',
  watchlist: 'Watchlist',
  watched: 'Completed',
  dropped: 'Dropped',
  onhold: 'On hold',
};

const STATUS_OPTIONS: LiquidGlassOption[] = (Object.keys(STATUS_LABELS) as WatchStatus[]).map(
  (status) => ({
    value: status,
    label: STATUS_LABELS[status],
  })
);

export const SearchView: React.FC<SearchViewProps> = ({
  trending,
  entriesByKey,
  onOpenDetails,
  onQuickSetStatus,
  onRemoveEntry,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MediaSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openDropdownKey, setOpenDropdownKey] = useState<string | null>(null);
  const [pendingCompletedItem, setPendingCompletedItem] = useState<MediaSummary | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const timer = window.setTimeout(async () => {
      try {
        const res = await searchMedia(trimmed);
        if (!cancelled) {
          setResults(res.results);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Search failed.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const displayed = query.trim() ? results : trending;
  const pendingCompletedEntry = pendingCompletedItem
    ? entriesByKey[`${pendingCompletedItem.tmdbId}_${pendingCompletedItem.mediaType}`]
    : undefined;

  return (
    <div>
      <h1 className="font-display text-[32px] font-bold tracking-[-0.02em] text-[var(--ink)] md:text-[36px]">
        Search
      </h1>

      <div className="mt-4">
        <label htmlFor="search-page-input" className="sr-only">
          Search movies and TV series
        </label>
        <div className="flex min-h-[48px] items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 focus-within:border-[var(--accent)]">
          <SearchIcon size={18} className="shrink-0 text-[var(--muted)]" />
          <input
            id="search-page-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search movies and TV series..."
            className="min-w-0 flex-1 bg-transparent text-[15px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="tap-press inline-flex h-[44px] w-[44px] -mr-2 items-center justify-center rounded-full text-[var(--muted)] hover:text-[var(--ink)]"
            >
              <CloseIcon size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="mt-6">
        <h2 className="font-display text-[17px] font-semibold text-[var(--muted)]">
          {query.trim() ? `Results for "${query.trim()}"` : 'Popular on MyWatchList'}
        </h2>

        {error && (
          <div className="mt-4 rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="flex animate-pulse gap-3.5 rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-3"
              >
                <div className="h-[108px] w-[72px] shrink-0 rounded-[12px] bg-[var(--surface-subtle)]" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 w-3/4 rounded bg-[var(--surface-subtle)]" />
                  <div className="h-3 w-1/2 rounded bg-[var(--surface-subtle)]" />
                </div>
              </div>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="mt-6 rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
            <p className="text-[15px] text-[var(--muted)]">
              No movies or series matched "{query.trim()}".
            </p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {displayed.map((item) => {
              const key = `${item.tmdbId}_${item.mediaType}`;
              const existing = entriesByKey[key];
              const options: LiquidGlassOption[] = existing
                ? [
                    ...STATUS_OPTIONS,
                    { value: '__remove__', label: 'Remove from library', tone: 'danger' },
                  ]
                : STATUS_OPTIONS;

              return (
                <div
                  key={key}
                  className={`relative flex items-center gap-3.5 rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-3 transition-colors duration-200 hover:border-[var(--muted)]/45 ${
                    openDropdownKey === key ? 'z-30' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onOpenDetails(item.mediaType, item.tmdbId)}
                    className="tap-press flex min-w-0 flex-1 items-center gap-3.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                  >
                    <div className="aspect-[2/3] w-[68px] shrink-0 overflow-hidden rounded-[12px]">
                      <MediaArt
                        title={item.title}
                        path={item.posterPath}
                        size="w500"
                        accentGradient={item.accentGradient}
                        className="h-full w-full"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[15px] leading-snug font-semibold text-[var(--ink)]">
                        {item.title}
                      </p>
                      <p className="mt-1 text-[13px] text-[var(--muted)]">
                        {[item.mediaType === 'tv' ? 'Series' : 'Movie', item.year]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                  </button>

                  <div className="shrink-0">
                    <LiquidGlassDropdown
                      ariaLabel={`Set status for ${item.title}`}
                      menuLabel={`Status options for ${item.title}`}
                      triggerLabel={existing ? STATUS_LABELS[existing.status] : 'Add'}
                      leadingIcon={!existing ? <PlusIcon size={14} /> : undefined}
                      isActiveTrigger={Boolean(existing)}
                      selectedValue={existing?.status}
                      options={options}
                      align="right"
                      menuWidthClass="w-52"
                      onOpenChange={(isOpen) =>
                        setOpenDropdownKey((prev) =>
                          isOpen ? key : prev === key ? null : prev
                        )
                      }
                      onSelect={(value) => {
                        if (value === '__remove__') {
                          void onRemoveEntry(key);
                          return;
                        }
                        if (value === 'watched') {
                          setPendingCompletedItem(item);
                          return;
                        }
                        void onQuickSetStatus(item, value as WatchStatus);
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CompletedModal
        open={Boolean(pendingCompletedItem)}
        title={pendingCompletedItem?.title || ''}
        initialEntry={pendingCompletedEntry}
        showMarkAllEpisodes={false}
        onClose={() => setPendingCompletedItem(null)}
        onConfirm={async ({ patch }) => {
          if (!pendingCompletedItem) return;
          const target = pendingCompletedItem;
          setPendingCompletedItem(null);
          await onQuickSetStatus(target, 'watched', patch);
        }}
      />
    </div>
  );
};
