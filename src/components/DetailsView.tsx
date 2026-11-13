import React, { useEffect, useRef, useState } from 'react';
import {
  fetchEpisodeStreamingUrl,
  fetchMediaDetails,
  fetchSeasonEpisodes,
} from '../services/tmdbApi';
import type {
  EpisodeItem,
  LibraryEntry,
  MediaDetails,
  MediaType,
  WatchedEpisodesMap,
  WatchStatus,
} from '../types/reelist';
import { extractCompletedYear, isFullIsoDate } from '../utils/completedForm';
import {
  computeSeriesProgress,
  detectNewSeasonForCompletedSeries,
  formatEpisodeCode,
  markAllAiredInMap,
  resolveStatusAfterEpisodeUpdate,
} from '../utils/episodeLogic';
import { getFirstStreamingProvider, resolveProviderUrl } from '../utils/streamingLinks';
import { CompletedModal } from './CompletedModal';
import { EpisodeTracker } from './EpisodeTracker';
import {
  ExternalLinkIcon,
  PlayIcon,
  PlusIcon,
  RotateCcwIcon,
  StarIcon,
  TrashIcon,
} from './Icons';
import { LiquidGlassDropdown } from './LiquidGlassDropdown';
import { MediaArt } from './MediaArt';

interface DetailsViewProps {
  mediaType: MediaType;
  tmdbId: number;
  existingEntry?: LibraryEntry;
  onSaveEntry: (entry: LibraryEntry) => Promise<void>;
  onRemoveEntry: (entryId: string) => Promise<void>;
}

const ALL_STATUSES: { id: WatchStatus; label: string }[] = [
  { id: 'watching', label: 'Watching' },
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'watched', label: 'Completed' },
  { id: 'dropped', label: 'Dropped' },
  { id: 'onhold', label: 'On hold' },
];

export const DetailsView: React.FC<DetailsViewProps> = ({
  mediaType,
  tmdbId,
  existingEntry,
  onSaveEntry,
  onRemoveEntry,
}) => {
  const [details, setDetails] = useState<MediaDetails | null>(null);
  const [episodesBySeason, setEpisodesBySeason] = useState<Record<number, EpisodeItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadingSeason, setLoadingSeason] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const [promptMoveToCompleted, setPromptMoveToCompleted] = useState(false);

  const [completedModalOpen, setCompletedModalOpen] = useState(false);
  const autoReopenedRef = useRef<Set<string>>(new Set());

  const [resumeStreamUrl, setResumeStreamUrl] = useState<string | null>(null);
  const [isEpisodeDirectUrl, setIsEpisodeDirectUrl] = useState(false);

  const [notesDraft, setNotesDraft] = useState(existingEntry?.notes || '');
  const [startedAtDraft, setStartedAtDraft] = useState(existingEntry?.startedAt || '');
  const [finishedAtDraft, setFinishedAtDraft] = useState(
    isFullIsoDate(existingEntry?.finishedAt) ? existingEntry!.finishedAt! : ''
  );

  useEffect(() => {
    setNotesDraft(existingEntry?.notes || '');
    setStartedAtDraft(existingEntry?.startedAt || '');
    setFinishedAtDraft(
      isFullIsoDate(existingEntry?.finishedAt) ? existingEntry!.finishedAt! : ''
    );
  }, [existingEntry?.id, existingEntry?.notes, existingEntry?.startedAt, existingEntry?.finishedAt]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setCompletedModalOpen(false);
    setPromptMoveToCompleted(false);

    fetchMediaDetails(mediaType, tmdbId)
      .then(async (res) => {
        if (cancelled) return;
        const d = res.details;
        setDetails(d);
        if (d.episodesBySeason) {
          setEpisodesBySeason(d.episodesBySeason);
        } else if (d.mediaType === 'tv' && d.seasons.length > 0) {
          const regularSeasons = d.seasons.filter((s) => s.seasonNumber >= 1);
          const loaded: Record<number, EpisodeItem[]> = {};
          await Promise.all(
            regularSeasons.map(async (s) => {
              try {
                const sRes = await fetchSeasonEpisodes(d.tmdbId, s.seasonNumber);
                loaded[s.seasonNumber] = sRes.episodes;
              } catch {
                loaded[s.seasonNumber] = [];
              }
            })
          );
          if (!cancelled) setEpisodesBySeason(loaded);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load title details.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mediaType, tmdbId]);

  // Automatically move a Completed TV series back to Watching if TMDB has a newly aired season
  useEffect(() => {
    if (!details || details.mediaType !== 'tv') return;
    if (!existingEntry || existingEntry.status !== 'watched') return;
    if (Object.keys(episodesBySeason).length === 0) return;

    const checkKey = `${existingEntry.id}_${existingEntry.updatedAt}`;
    if (autoReopenedRef.current.has(checkKey)) return;

    const { shouldMoveToWatching, summary } = detectNewSeasonForCompletedSeries(
      existingEntry,
      episodesBySeason
    );
    if (!shouldMoveToWatching) return;

    autoReopenedRef.current.add(checkKey);
    const now = new Date().toISOString();
    void onSaveEntry({
      ...existingEntry,
      status: 'watching',
      totalEpisodes: summary.totalAiredEpisodes,
      watchedCount: summary.watchedCount,
      resumeSeason: summary.resumeSeason,
      resumeEpisode: summary.resumeEpisode,
      currentSeason: summary.resumeSeason ?? summary.lastWatchedSeason ?? 1,
      currentEpisode: summary.resumeEpisode ?? summary.lastWatchedEpisode ?? 1,
      hasNewEpisodes: false,
      updatedAt: now,
    }).then(() => {
      setStatusFeedback('New season released · Moved to Watching');
    });
  }, [details, existingEntry, episodesBySeason, onSaveEntry]);

  const firstProvider = details ? getFirstStreamingProvider(details.watchProvidersIN) : null;
  const tvProgressForResume =
    mediaType === 'tv' && details
      ? computeSeriesProgress(episodesBySeason, existingEntry?.watched || {}, 'watched')
      : null;
  const nextResumeSeason =
    tvProgressForResume?.resumeSeason ?? existingEntry?.resumeSeason ?? existingEntry?.currentSeason ?? 1;
  const nextResumeEpisode =
    tvProgressForResume?.resumeEpisode ?? existingEntry?.resumeEpisode ?? existingEntry?.currentEpisode ?? 1;

  // Resolve direct streaming URL (first provider, upgraded to exact episode URL for TV series when Watching)
  useEffect(() => {
    if (!details || existingEntry?.status !== 'watching') {
      setResumeStreamUrl(null);
      setIsEpisodeDirectUrl(false);
      return;
    }

    const baseUrl = firstProvider
      ? resolveProviderUrl(firstProvider, details.title)
      : details.watchLinkIN || null;
    setResumeStreamUrl(baseUrl);
    setIsEpisodeDirectUrl(false);

    if (details.mediaType !== 'tv' || !firstProvider || !nextResumeSeason || !nextResumeEpisode) {
      return;
    }

    let cancelled = false;
    fetchEpisodeStreamingUrl({
      title: details.title,
      year: details.year,
      season: nextResumeSeason,
      episode: nextResumeEpisode,
      providerId: firstProvider.providerId,
      providerName: firstProvider.providerName,
      justWatchNodeId: details.justWatchNodeId,
    })
      .then((res) => {
        if (cancelled) return;
        if (res.url) {
          setResumeStreamUrl(res.url);
          setIsEpisodeDirectUrl(Boolean(res.isEpisodeDirect));
        }
      })
      .catch(() => {
        // Keep baseUrl fallback gracefully
      });

    return () => {
      cancelled = true;
    };
  }, [
    details,
    existingEntry?.status,
    firstProvider,
    nextResumeSeason,
    nextResumeEpisode,
  ]);

  const handleLoadSeason = async (seasonNumber: number) => {
    if (!details || episodesBySeason[seasonNumber]?.length) return;
    setLoadingSeason(seasonNumber);
    try {
      const res = await fetchSeasonEpisodes(details.tmdbId, seasonNumber);
      setEpisodesBySeason((prev) => ({ ...prev, [seasonNumber]: res.episodes }));
    } catch {
      // Ignore transient season fetch error
    } finally {
      setLoadingSeason(null);
    }
  };

  const buildBaseEntry = (status: WatchStatus): LibraryEntry => {
    const now = new Date().toISOString();
    const id = `${tmdbId}_${mediaType}`;

    const base: LibraryEntry = existingEntry
      ? { ...existingEntry, status, updatedAt: now }
      : {
          id,
          tmdbId,
          mediaType,
          status,
          title: details?.title || 'Untitled',
          posterPath: details?.posterPath ?? null,
          backdropPath: details?.backdropPath ?? null,
          year: details?.year || '',
          genres: details?.genres || [],
          runtimeMinutes: details?.runtimeMinutes ?? (mediaType === 'tv' ? 45 : 120),
          watched: mediaType === 'tv' ? {} : undefined,
          addedAt: now,
          updatedAt: now,
          accentGradient: details?.accentGradient,
        };

    if (mediaType === 'tv') {
      const summary = computeSeriesProgress(episodesBySeason, base.watched || {}, status);
      base.resumeSeason = summary.resumeSeason;
      base.resumeEpisode = summary.resumeEpisode;
      base.currentSeason = summary.resumeSeason ?? summary.lastWatchedSeason ?? 1;
      base.currentEpisode = summary.resumeEpisode ?? summary.lastWatchedEpisode ?? 1;
      base.watchedCount = summary.watchedCount;
      base.totalEpisodes = summary.totalAiredEpisodes;
      base.hasNewEpisodes = summary.hasNewEpisodes;
    }

    return base;
  };

  const openCompletedPopout = () => {
    setCompletedModalOpen(true);
  };

  const handleStatusChange = async (newStatus: WatchStatus) => {
    if (!details) return;
    if (newStatus === 'watched') {
      openCompletedPopout();
      return;
    }
    const entry = buildBaseEntry(newStatus);
    await onSaveEntry(entry);
    setStatusFeedback(`Saved to ${ALL_STATUSES.find((s) => s.id === newStatus)?.label}`);
  };

  const handleConfirmCompleted = async ({
    patch,
    markAllEpisodes,
    year,
  }: {
    patch: Partial<LibraryEntry>;
    markAllEpisodes: boolean;
    year: string;
  }) => {
    if (!details) return;

    const entry: LibraryEntry = {
      ...buildBaseEntry('watched'),
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    if (mediaType === 'tv') {
      const prog = computeSeriesProgress(episodesBySeason, existingEntry?.watched || {}, 'watched');
      if (markAllEpisodes && !prog.isAllAiredWatched && prog.totalAiredEpisodes > 0) {
        const allMap = markAllAiredInMap(episodesBySeason);
        const summary = computeSeriesProgress(episodesBySeason, allMap, 'watched');
        entry.watched = allMap;
        entry.watchedCount = summary.watchedCount;
        entry.totalEpisodes = summary.totalAiredEpisodes;
        entry.resumeSeason = summary.resumeSeason;
        entry.resumeEpisode = summary.resumeEpisode;
        entry.hasNewEpisodes = false;
      }
    }

    setCompletedModalOpen(false);
    setPromptMoveToCompleted(false);
    await onSaveEntry(entry);
    setStatusFeedback(`Marked as Completed (${year})`);
  };

  const handleRemove = async () => {
    if (!existingEntry) return;
    setCompletedModalOpen(false);
    await onRemoveEntry(existingEntry.id);
    setStatusFeedback('Removed from library');
  };

  const handleUpdateWatched = async (
    nextMap: WatchedEpisodesMap,
    summary: ReturnType<typeof computeSeriesProgress>,
    justCompletedAll: boolean
  ) => {
    if (!details) return;
    const previousStatus = existingEntry?.status;
    const targetStatus: WatchStatus = resolveStatusAfterEpisodeUpdate(
      previousStatus,
      summary.watchedCount
    );
    const entry = buildBaseEntry(targetStatus);
    const now = new Date().toISOString();
    entry.watched = nextMap;
    entry.watchedCount = summary.watchedCount;
    entry.totalEpisodes = summary.totalAiredEpisodes;
    entry.resumeSeason = summary.resumeSeason;
    entry.resumeEpisode = summary.resumeEpisode;
    entry.currentSeason = summary.resumeSeason ?? summary.lastWatchedSeason ?? 1;
    entry.currentEpisode = summary.resumeEpisode ?? summary.lastWatchedEpisode ?? 1;
    entry.hasNewEpisodes = summary.hasNewEpisodes;
    entry.lastWatchedAt = now;
    entry.updatedAt = now;

    if (previousStatus === 'watchlist' && targetStatus === 'watching') {
      setStatusFeedback('Moved from Watchlist to Watching');
    }

    if (justCompletedAll && targetStatus !== 'watched') {
      setPromptMoveToCompleted(true);
    }

    await onSaveEntry(entry);
  };

  const handleResetProgress = async () => {
    if (!existingEntry) return;
    const summary = computeSeriesProgress(episodesBySeason, {}, existingEntry.status);
    await onSaveEntry({
      ...existingEntry,
      watched: {},
      watchedCount: 0,
      resumeSeason: summary.resumeSeason,
      resumeEpisode: summary.resumeEpisode,
      currentSeason: 1,
      currentEpisode: 1,
      hasNewEpisodes: false,
      updatedAt: new Date().toISOString(),
    });
    setStatusFeedback('Episode progress reset');
  };

  const handleSaveMeta = async (patch: Partial<LibraryEntry>) => {
    const entry = buildBaseEntry(existingEntry?.status || 'watchlist');
    await onSaveEntry({
      ...entry,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
    setStatusFeedback('Updated');
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-[260px] w-full rounded-[24px] bg-[var(--surface-subtle)]" />
        <div className="h-8 w-2/3 rounded bg-[var(--surface-subtle)]" />
        <div className="h-24 w-full rounded-[18px] bg-[var(--surface-subtle)]" />
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
        <p className="text-[15px] text-[var(--muted)]">{error || 'Title not found.'}</p>
      </div>
    );
  }

  const currentStatusLabel = existingEntry
    ? ALL_STATUSES.find((s) => s.id === existingEntry.status)?.label || 'Saved'
    : null;
  const savedCompletedYear =
    existingEntry?.status === 'watched'
      ? extractCompletedYear(existingEntry.finishedAt)
      : '';
  const tvProgress =
    mediaType === 'tv'
      ? computeSeriesProgress(episodesBySeason, existingEntry?.watched || {}, 'watched')
      : null;

  return (
    <div className="space-y-7">
      {/* Backdrop + Header Summary */}
      <div className="relative overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface)]">
        <div className="relative h-[220px] w-full md:h-[310px]">
          <MediaArt
            title={details.title}
            path={details.backdropPath || details.posterPath}
            size="w1280"
            variant="backdrop"
            accentGradient={details.accentGradient}
            className="h-full w-full"
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.65) 100%)',
            }}
          />
        </div>

        <div className="relative -mt-14 px-4 pb-6 md:-mt-20 md:px-8 md:pb-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
            <div className="aspect-[2/3] w-[112px] shrink-0 overflow-hidden rounded-[16px] shadow-xl ring-2 ring-[var(--surface)] md:w-[154px]">
              <MediaArt
                title={details.title}
                path={details.posterPath}
                size="w500"
                accentGradient={details.accentGradient}
                className="h-full w-full"
              />
            </div>

            <div className="min-w-0 flex-1 sm:pb-1">
              <h1 className="font-display text-[28px] leading-[1.1] font-bold text-[var(--ink)] md:text-[38px]">
                {details.title}
              </h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-[var(--muted)]">
                <span>{details.mediaType === 'tv' ? 'Series' : 'Movie'}</span>
                {details.year && <span>· {details.year}</span>}
                {details.mediaType === 'movie' && details.runtimeMinutes && (
                  <span>· {details.runtimeMinutes} min</span>
                )}
                {details.mediaType === 'tv' && details.numberOfSeasons && (
                  <span>· {details.numberOfSeasons} seasons</span>
                )}
                {details.voteAverage > 0 && (
                  <span className="inline-flex items-center gap-1 font-semibold text-[var(--ink)]">
                    · <StarIcon size={14} className="text-[var(--accent)]" /> {details.voteAverage}
                  </span>
                )}
              </p>
              {details.genres.length > 0 && (
                <p className="mt-1.5 text-[13px] text-[var(--muted)]">
                  {details.genres.join(' · ')}
                </p>
              )}
            </div>

            {details.trailerKey && (
              <a
                href={`https://www.youtube.com/watch?v=${details.trailerKey}`}
                target="_blank"
                rel="noopener noreferrer"
                className="tap-press inline-flex min-h-[44px] shrink-0 self-start items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-[13px] font-semibold text-[var(--ink)] hover:bg-[var(--surface-subtle)] sm:self-end"
              >
                <PlayIcon size={14} />
                <span>Trailer</span>
                <ExternalLinkIcon size={13} className="text-[var(--muted)]" />
              </a>
            )}
          </div>

          {details.tagline && (
            <p className="mt-5 text-[14px] italic text-[var(--muted)]">{details.tagline}</p>
          )}
          <p className="mt-2 max-w-[68ch] text-[15px] leading-relaxed text-[var(--ink)]">
            {details.overview}
          </p>
        </div>
      </div>

      {/* Add Your Status Action + Dropdown + Remove Button */}
      <section
        aria-label="Watch status"
        className="relative rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-4 md:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex flex-wrap items-center gap-2.5">
            <LiquidGlassDropdown
              ariaLabel="Choose watch status"
              menuLabel="Choose watch status"
              triggerLabel={
                currentStatusLabel
                  ? savedCompletedYear
                    ? `${currentStatusLabel} · ${savedCompletedYear}`
                    : currentStatusLabel
                  : 'Add your status'
              }
              leadingIcon={<PlusIcon size={16} />}
              isActiveTrigger={Boolean(existingEntry)}
              align="left"
              menuWidthClass="w-56"
              triggerClassName="px-4 text-[14px]"
              selectedValue={existingEntry?.status}
              options={ALL_STATUSES.map((s) => ({ value: s.id, label: s.label }))}
              onSelect={(val) => void handleStatusChange(val as WatchStatus)}
            />

            {existingEntry?.status === 'watching' && resumeStreamUrl && (
              <a
                href={resumeStreamUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={
                  isEpisodeDirectUrl && mediaType === 'tv'
                    ? `Watch ${formatEpisodeCode(nextResumeSeason, nextResumeEpisode)} on ${firstProvider?.providerName || 'streaming app'}`
                    : `Watch on ${firstProvider?.providerName || 'streaming app'}`
                }
                className="tap-press inline-flex min-h-[44px] max-w-full items-center gap-2 rounded-full bg-[var(--accent)] px-4 text-[13px] font-semibold text-white shadow-sm hover:brightness-95 sm:text-[14px]"
              >
                <PlayIcon size={14} className="shrink-0" />
                <span className="truncate">
                  Resume streaming
                  {firstProvider ? ` · ${firstProvider.providerName}` : ''}
                  {mediaType === 'tv' && nextResumeSeason && nextResumeEpisode
                    ? ` (${formatEpisodeCode(nextResumeSeason, nextResumeEpisode)})`
                    : ''}
                </span>
                <ExternalLinkIcon size={13} className="shrink-0 opacity-85" />
              </a>
            )}

            {existingEntry && (
              <button
                type="button"
                onClick={() => void handleRemove()}
                className="tap-press inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[var(--border)] px-4 text-[14px] font-semibold text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                <TrashIcon size={15} />
                <span>Remove</span>
              </button>
            )}

            {existingEntry?.mediaType === 'tv' &&
              existingEntry.status === 'watchlist' &&
              (existingEntry.watchedCount || 0) > 0 && (
                <button
                  type="button"
                  onClick={() => void handleResetProgress()}
                  className="tap-press inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[var(--border)] px-4 text-[13px] font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)]"
                >
                  <RotateCcwIcon size={14} />
                  <span>Reset progress</span>
                </button>
              )}
          </div>

          {statusFeedback && (
            <span role="status" className="text-[13px] font-medium text-[var(--accent)]">
              {statusFeedback}
            </span>
          )}
        </div>

        {/* Offer move to Completed when last aired episode is checked */}
        {promptMoveToCompleted && existingEntry?.status !== 'watched' && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-[var(--accent)]/40 bg-[var(--accent)]/10 p-4">
            <p className="text-[14px] font-medium text-[var(--ink)]">
              You finished the last aired episode! Move {details.title} to Completed?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={openCompletedPopout}
                className="tap-press min-h-[44px] rounded-full bg-[var(--accent)] px-4 text-[13px] font-semibold text-white hover:brightness-95"
              >
                Move to Completed
              </button>
              <button
                type="button"
                onClick={() => setPromptMoveToCompleted(false)}
                className="tap-press min-h-[44px] px-3 text-[13px] text-[var(--muted)] hover:text-[var(--ink)]"
              >
                Keep Watching
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Series Episode Tracker */}
      {details.mediaType === 'tv' && details.seasons.length > 0 && (
        <EpisodeTracker
          seasons={details.seasons}
          episodesBySeason={episodesBySeason}
          loadingSeason={loadingSeason}
          watchedMap={existingEntry?.watched || {}}
          status={existingEntry?.status}
          onSelectSeason={(s) => void handleLoadSeason(s)}
          onUpdateWatched={(map, summary, justCompleted) =>
            void handleUpdateWatched(map, summary, justCompleted)
          }
          onMoveToWatching={() => void handleStatusChange('watching')}
        />
      )}

      {/* Personal Rating, Dates & Notes */}
      <section aria-label="Rating and notes" className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-4 md:p-6">
        <h2 className="font-display text-[18px] font-bold text-[var(--ink)]">My notes &amp; rating</h2>

        <div className="mt-4">
          <p className="text-[13px] font-medium text-[var(--muted)]">My rating (1–10)</p>
          <div className="mt-2 grid max-w-[260px] grid-cols-5 gap-2 sm:flex sm:max-w-none sm:flex-wrap sm:gap-1.5">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((score) => {
              const selected = existingEntry?.rating === score;
              return (
                <button
                  key={score}
                  type="button"
                  onClick={() =>
                    void handleSaveMeta({ rating: selected ? undefined : score })
                  }
                  aria-label={`Rate ${score} out of 10`}
                  aria-pressed={selected}
                  className={`tap-press h-[44px] w-[44px] rounded-full text-[14px] font-semibold tabular-nums transition-all duration-150 ${
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
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-[13px] font-medium text-[var(--muted)]">Started date</span>
            <input
              type="date"
              value={startedAtDraft}
              onChange={(e) => {
                setStartedAtDraft(e.target.value);
                void handleSaveMeta({ startedAt: e.target.value || undefined });
              }}
              className="mt-1.5 min-h-[44px] w-full rounded-[14px] border border-[var(--border)] bg-transparent px-3.5 text-[14px] text-[var(--ink)]"
            />
          </label>
          <label className="block">
            <span className="text-[13px] font-medium text-[var(--muted)]">Finished date</span>
            <input
              type="date"
              value={finishedAtDraft}
              onChange={(e) => {
                setFinishedAtDraft(e.target.value);
                void handleSaveMeta({ finishedAt: e.target.value || undefined });
              }}
              className="mt-1.5 min-h-[44px] w-full rounded-[14px] border border-[var(--border)] bg-transparent px-3.5 text-[14px] text-[var(--ink)]"
            />
            {savedCompletedYear && !isFullIsoDate(existingEntry?.finishedAt) && (
              <span className="mt-1 block text-[12px] text-[var(--muted)]">
                Completed year: {savedCompletedYear}
              </span>
            )}
          </label>
        </div>

        <label className="mt-4 block">
          <span className="text-[13px] font-medium text-[var(--muted)]">Personal notes</span>
          <textarea
            rows={3}
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            onBlur={() => {
              if ((existingEntry?.notes || '') !== notesDraft) {
                void handleSaveMeta({ notes: notesDraft });
              }
            }}
            placeholder="Favorite scenes, where you left off, or thoughts..."
            className="mt-1.5 w-full rounded-[16px] border border-[var(--border)] bg-transparent p-3.5 text-[14px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
          />
        </label>
      </section>

      {/* Where to Watch in India */}
      <section aria-label="Where to watch in India" className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-4 md:p-6">
        <h2 className="font-display text-[18px] font-bold text-[var(--ink)]">
          Where to watch (India)
        </h2>
        {details.watchProvidersIN.length === 0 ? (
          <p className="mt-2 text-[14px] text-[var(--muted)]">
            No streaming providers listed for India right now.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2.5">
            {details.watchProvidersIN.map((p) => {
              const directUrl = resolveProviderUrl(p, details.title);
              return (
                <a
                  key={`${p.type}_${p.providerId}`}
                  href={directUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tap-press inline-flex min-h-[42px] items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-subtle)]/40 px-4 py-2 transition-all duration-150 hover:border-[var(--accent)] hover:bg-[var(--surface-subtle)]"
                >
                  <span className="text-[13px] font-semibold text-[var(--ink)]">
                    {p.providerName}
                  </span>
                  <span className="text-[12px] text-[var(--muted)] capitalize">
                    {p.type === 'flatrate' ? 'Stream' : p.type}
                  </span>
                  <ExternalLinkIcon size={13} className="text-[var(--muted)]" />
                </a>
              );
            })}
          </div>
        )}
      </section>

      {/* Cast Row */}
      {details.cast.length > 0 && (
        <section aria-label="Cast">
          <h2 className="font-display text-[18px] font-bold text-[var(--ink)]">Cast</h2>
          <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto pb-1">
            {details.cast.map((member) => (
              <div
                key={member.id}
                className="w-[150px] shrink-0 rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-3.5"
              >
                <p className="truncate text-[14px] font-semibold text-[var(--ink)]">
                  {member.name}
                </p>
                <p className="mt-0.5 truncate text-[12px] text-[var(--muted)]">
                  {member.character}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Completed Pop-Out Card (compact floating modal, does not cover full page) */}
      <CompletedModal
        open={completedModalOpen}
        title={details.title}
        initialEntry={existingEntry}
        showMarkAllEpisodes={Boolean(
          mediaType === 'tv' &&
            tvProgress &&
            !tvProgress.isAllAiredWatched &&
            tvProgress.totalAiredEpisodes > 0
        )}
        onClose={() => setCompletedModalOpen(false)}
        onConfirm={handleConfirmCompleted}
      />
    </div>
  );
};
