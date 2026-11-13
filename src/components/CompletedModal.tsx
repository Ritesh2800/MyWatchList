import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LibraryEntry } from '../types/reelist';
import {
  buildCompletedPatch,
  extractCompletedYear,
  isFullIsoDate,
  isValidCompletedYear,
  normalizeRating,
} from '../utils/completedForm';
import { CloseIcon } from './Icons';

interface CompletedModalProps {
  open: boolean;
  title: string;
  initialEntry?: LibraryEntry;
  showMarkAllEpisodes?: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    patch: Partial<LibraryEntry>;
    markAllEpisodes: boolean;
    year: string;
  }) => Promise<void> | void;
}

export const CompletedModal: React.FC<CompletedModalProps> = ({
  open,
  title,
  initialEntry,
  showMarkAllEpisodes = false,
  onClose,
  onConfirm,
}) => {
  const [year, setYear] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [markAllEpisodes, setMarkAllEpisodes] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const yearInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const isAlreadyCompleted = initialEntry?.status === 'watched';
    setYear(isAlreadyCompleted ? extractCompletedYear(initialEntry?.finishedAt) : '');
    setStartDate(initialEntry?.startedAt || '');
    setEndDate(
      isAlreadyCompleted && isFullIsoDate(initialEntry?.finishedAt)
        ? initialEntry!.finishedAt!
        : ''
    );
    setRating(normalizeRating(initialEntry?.rating));
    setReview(initialEntry?.notes || '');
    setMarkAllEpisodes(true);
    setError(null);

    const timer = window.setTimeout(() => {
      yearInputRef.current?.focus();
    }, 30);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, initialEntry, onClose]);

  if (!open) return null;

  const hasValidYear = isValidCompletedYear(year);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = buildCompletedPatch({
      year,
      startDate,
      endDate,
      rating,
      review,
    });

    if (!result.valid) {
      setError(result.error);
      yearInputRef.current?.focus();
      return;
    }

    await onConfirm({
      patch: result.patch,
      markAllEpisodes,
      year: year.trim(),
    });
  };

  return createPortal(
    <div
      className="animate-backdrop-in fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[4px]"
      onClick={onClose}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="completed-modal-title"
        onSubmit={(e) => void handleSubmit(e)}
        onClick={(e) => e.stopPropagation()}
        className="glass-sheet animate-sheet-up max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[26px] p-5 md:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="completed-modal-title"
              className="font-display text-[20px] font-bold text-[var(--ink)]"
            >
              Mark as Completed
            </h2>
            <p className="mt-0.5 text-[13px] text-[var(--muted)]">{title}</p>
          </div>
          <button
            type="button"
            aria-label="Close Completed dialog"
            onClick={onClose}
            className="tap-press flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--ink)] hover:bg-[var(--surface-subtle)]"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {/* Compulsory Year Watched */}
          <div>
            <label htmlFor="completed-year-input" className="block">
              <span className="text-[13px] font-semibold text-[var(--ink)]">
                Year watched <span className="text-[var(--accent)]">*</span>
              </span>
              <input
                ref={yearInputRef}
                id="completed-year-input"
                type="text"
                inputMode="numeric"
                maxLength={4}
                required
                value={year}
                onChange={(e) => {
                  const digitsOnly = e.target.value.replace(/[^\d]/g, '').slice(0, 4);
                  setYear(digitsOnly);
                  if (error) setError(null);
                }}
                placeholder="e.g. 2026"
                className="mt-1.5 min-h-[44px] w-full rounded-[14px] border border-[var(--border)] bg-transparent px-3.5 text-[15px] text-[var(--ink)] placeholder:text-[var(--muted)] transition-colors focus:border-[var(--accent)] focus:outline-none"
              />
            </label>
            {error ? (
              <p role="alert" className="mt-1.5 text-[12px] font-medium text-[var(--accent)]">
                {error}
              </p>
            ) : !hasValidYear ? (
              <p className="mt-1.5 text-[12px] text-[var(--muted)]">
                Required. Enter a 4-digit year to also add optional start and end dates.
              </p>
            ) : null}
          </div>

          {/* Optional Start & End Dates (revealed only after valid year is entered) */}
          {hasValidYear && (
            <div className="animate-menu-down grid grid-cols-1 gap-3 rounded-[16px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3.5 sm:grid-cols-2">
              <label className="block">
                <span className="text-[12px] font-medium text-[var(--muted)]">
                  Start date (optional)
                </span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 min-h-[44px] w-full rounded-[12px] border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] text-[var(--ink)]"
                />
              </label>
              <label className="block">
                <span className="text-[12px] font-medium text-[var(--muted)]">
                  End date (optional)
                </span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 min-h-[44px] w-full rounded-[12px] border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] text-[var(--ink)]"
                />
              </label>
            </div>
          )}

          {/* Optional 1–10 Rating & Notes */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-[var(--ink)]">
                My rating (1–10) <span className="font-normal text-[var(--muted)]">(optional)</span>
              </span>
              {rating > 0 && (
                <button
                  type="button"
                  onClick={() => setRating(0)}
                  className="tap-press min-h-[32px] px-2 text-[12px] font-medium text-[var(--muted)] hover:text-[var(--ink)]"
                >
                  Clear
                </button>
              )}
            </div>
            <div
              className="mt-2 flex flex-wrap gap-1.5"
              role="group"
              aria-label="My rating 1 to 10"
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((score) => {
                const selected = rating === score;
                return (
                  <button
                    key={score}
                    type="button"
                    aria-label={`Rate ${score} out of 10`}
                    aria-pressed={selected}
                    onClick={() => setRating(selected ? 0 : score)}
                    className={`tap-press flex h-[40px] w-[40px] items-center justify-center rounded-full text-[13px] font-semibold tabular-nums transition-all duration-150 ${
                      selected
                        ? 'scale-105 bg-[var(--accent)] text-white shadow-sm'
                        : 'border border-[var(--border)] text-[var(--ink)] hover:border-[var(--muted)] hover:bg-[var(--surface-subtle)]'
                    }`}
                  >
                    {score}
                  </button>
                );
              })}
            </div>
            <textarea
              rows={3}
              aria-label="Review (optional)"
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="Write your review or thoughts (optional)..."
              className="mt-3 w-full rounded-[14px] border border-[var(--border)] bg-transparent p-3 text-[14px] text-[var(--ink)] placeholder:text-[var(--muted)] transition-colors focus:border-[var(--accent)] focus:outline-none"
            />
          </div>

          {/* Mark all aired episodes option for TV series */}
          {showMarkAllEpisodes && (
            <label className="tap-press flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-[14px] border border-[var(--border)] px-3.5 py-2 text-[13px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface-subtle)]">
              <input
                type="checkbox"
                checked={markAllEpisodes}
                onChange={(e) => setMarkAllEpisodes(e.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              <span>Mark all aired episodes as watched</span>
            </label>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="tap-press min-h-[44px] rounded-full border border-[var(--border)] px-4 text-[14px] font-semibold text-[var(--ink)] hover:bg-[var(--surface-subtle)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="tap-press min-h-[44px] rounded-full bg-[var(--accent)] px-5 text-[14px] font-semibold text-white hover:brightness-95"
          >
            Save Completed
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
};
