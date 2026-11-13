import type { LibraryEntry } from '../types/reelist';

export interface CompletedFormInput {
  year: string;
  startDate: string;
  endDate: string;
  rating?: number; // 0 or undefined = unset, 1..10 = 1 to 10 rating
  review: string;
}

export type CompletedFormResult =
  | {
      valid: false;
      error: string;
    }
  | {
      valid: true;
      patch: Partial<LibraryEntry>;
    };

export function isValidCompletedYear(year: string): boolean {
  const trimmed = year.trim();
  if (!/^\d{4}$/.test(trimmed)) return false;
  const num = Number(trimmed);
  return num >= 1900 && num <= 2100;
}

export function isFullIsoDate(value?: string | null): boolean {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

export function extractCompletedYear(finishedAt?: string | null): string {
  if (!finishedAt) return '';
  const match = finishedAt.trim().match(/^(\d{4})/);
  if (!match) return '';
  return isValidCompletedYear(match[1]) ? match[1] : '';
}

export function normalizeRating(rating?: number): number {
  if (typeof rating !== 'number' || !Number.isFinite(rating) || rating < 1) return 0;
  return Math.max(1, Math.min(10, Math.round(rating)));
}

export function buildCompletedPatch(input: CompletedFormInput): CompletedFormResult {
  const trimmedYear = input.year.trim();
  if (!isValidCompletedYear(trimmedYear)) {
    return {
      valid: false,
      error: 'Please enter a valid 4-digit year (1900–2100).',
    };
  }

  const trimmedStart = input.startDate.trim();
  const trimmedEnd = input.endDate.trim();
  const trimmedReview = input.review.trim();
  const normalizedRating = normalizeRating(input.rating);

  return {
    valid: true,
    patch: {
      finishedAt: trimmedEnd || trimmedYear,
      startedAt: trimmedStart || undefined,
      rating: normalizedRating > 0 ? normalizedRating : undefined,
      notes: trimmedReview || undefined,
    },
  };
}
