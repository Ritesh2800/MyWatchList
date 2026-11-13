import React, { useEffect, useRef, useState } from 'react';
import { searchMedia } from '../services/tmdbApi';
import type { LibraryEntry, MediaSummary, MediaType, WatchStatus } from '../types/reelist';
import { CheckIcon, CloseIcon, SearchIcon } from './Icons';
import { MediaArt } from './MediaArt';

interface QuickAddModalProps {
  open: boolean;
  trending: MediaSummary[];
  entriesByKey: Record<string, LibraryEntry>;
  onClose: () => void;
  onAddToWatchlist: (item: MediaSummary) => Promise<void>;
  onOpenDetails: (mediaType: MediaType, tmdbId: number) => void;
}

const STATUS_NAMES: Record<WatchStatus, string> = {
  watching: 'Watching',
  watchlist: 'Watchlist',
  watched: 'Completed',
  dropped: 'Dropped',
  onhold: 'On hold',
};

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  open,
  trending,
  entriesByKey,
  onClose,
  onAddToWatchlist,
  onOpenDetails,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MediaSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [justAddedKey, setJustAddedKey] = useState<string | null>(null);
  const [confirmationText, setConfirmationText] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setJustAddedKey(null);
      setConfirmationText(null);
      return;
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 60);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await searchMedia(trimmed);
        if (!cancelled) setResults(res.results);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 240);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, open]);

  if (!open) return null;

  const list = query.trim() ? results : trending.slice(0, 6);

  const handleSelect = async (item: MediaSummary) => {
    const key = `${item.tmdbId}_${item.mediaType}`;
    const existing = entriesByKey[key];
    if (existing) {
      onClose();
      onOpenDetails(item.mediaType, item.tmdbId);
      return;
    }
    await onAddToWatchlist(item);
    setJustAddedKey(key);
    setConfirmationText(`Added "${item.title}" to Watchlist`);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quick add to watchlist"
      className="animate-backdrop-in fixed inset-0 z-40 flex items-end justify-center bg-black/55 p-3 pb-[108px] backdrop-blur-[3px] sm:items-center sm:p-6 sm:pb-[108px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="glass-sheet animate-sheet-up w-full max-w-lg rounded-[26px] p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <div className="flex min-h-[48px] flex-1 items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4">
            <SearchIcon size={18} className="shrink-0 text-[var(--muted)]" />
            <label htmlFor="quick-add-input" className="sr-only">
              Search title to add to Watchlist
            </label>
            <input
              ref={inputRef}
              id="quick-add-input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Quick add movie or series..."
              className="min-w-0 flex-1 bg-transparent text-[15px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close quick add"
            className="tap-press inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)]"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {confirmationText && (
          <div
            role="status"
            className="mt-3 flex items-center gap-2 rounded-full bg-[var(--accent)]/15 px-3.5 py-2 text-[13px] font-semibold text-[var(--accent)]"
          >
            <CheckIcon size={15} />
            <span>{confirmationText}</span>
          </div>
        )}

        <div className="no-scrollbar mt-3 max-h-[55dvh] space-y-2 overflow-y-auto">
          {loading ? (
            <div className="space-y-2 py-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[64px] animate-pulse rounded-[14px] bg-[var(--surface-subtle)]" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--muted)]">
              No titles found for "{query.trim()}".
            </p>
          ) : (
            list.map((item) => {
              const key = `${item.tmdbId}_${item.mediaType}`;
              const existing = entriesByKey[key];
              const isJustAdded = justAddedKey === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => void handleSelect(item)}
                  className="tap-press flex min-h-[60px] w-full items-center gap-3 rounded-[16px] p-2 text-left transition-colors hover:bg-[var(--surface-subtle)]"
                >
                  <div className="aspect-[2/3] w-[42px] shrink-0 overflow-hidden rounded-[10px]">
                    <MediaArt
                      title={item.title}
                      path={item.posterPath}
                      size="w500"
                      accentGradient={item.accentGradient}
                      className="h-full w-full"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-[var(--ink)]">
                      {item.title}
                    </p>
                    <p className="text-[12px] text-[var(--muted)]">
                      {[item.mediaType === 'tv' ? 'Series' : 'Movie', item.year]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold ${
                      isJustAdded
                        ? 'bg-[var(--accent)] text-white'
                        : existing
                          ? 'bg-[var(--surface-subtle)] text-[var(--ink)]'
                          : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)]'
                    }`}
                  >
                    {isJustAdded
                      ? 'Added to Watchlist'
                      : existing
                        ? STATUS_NAMES[existing.status]
                        : '+ Watchlist'}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
