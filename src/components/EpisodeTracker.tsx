import React, { useMemo, useState } from 'react';
import type {
  EpisodeItem,
  SeasonSummary,
  WatchedEpisodesMap,
  WatchStatus,
} from '../types/reelist';
import {
  advanceOneEpisodeInMap,
  computeSeriesProgress,
  formatEpisodeCode,
  getTodayDateString,
  isEpisodeAired,
  markAllPreviousAcrossSeasons,
  markSeasonWatchedInMap,
  toggleEpisodeInMap,
  unmarkSeasonInMap,
} from '../utils/episodeLogic';
import { CheckIcon, PlayIcon } from './Icons';

interface EpisodeTrackerProps {
  seasons: SeasonSummary[];
  episodesBySeason: Record<number, EpisodeItem[]>;
  loadingSeason: number | null;
  watchedMap: WatchedEpisodesMap;
  status?: WatchStatus;
  onSelectSeason: (seasonNumber: number) => void;
  onUpdateWatched: (
    nextMap: WatchedEpisodesMap,
    summary: ReturnType<typeof computeSeriesProgress>,
    justCompletedAll: boolean
  ) => void;
  onMoveToWatching?: () => void;
}

export const EpisodeTracker: React.FC<EpisodeTrackerProps> = ({
  seasons,
  episodesBySeason,
  loadingSeason,
  watchedMap,
  status,
  onSelectSeason,
  onUpdateWatched,
  onMoveToWatching,
}) => {
  const [showSpecials, setShowSpecials] = useState(false);

  const visibleSeasons = useMemo(
    () =>
      seasons
        .filter((s) => (showSpecials ? true : s.seasonNumber >= 1))
        .sort((a, b) => a.seasonNumber - b.seasonNumber),
    [seasons, showSpecials]
  );

  const hasSpecials = useMemo(() => seasons.some((s) => s.seasonNumber === 0), [seasons]);

  const progress = useMemo(
    () => computeSeriesProgress(episodesBySeason, watchedMap, status),
    [episodesBySeason, watchedMap, status]
  );

  const defaultSeason = useMemo(() => {
    if (progress.resumeSeason && visibleSeasons.some((s) => s.seasonNumber === progress.resumeSeason)) {
      return progress.resumeSeason;
    }
    return visibleSeasons[0]?.seasonNumber ?? 1;
  }, [progress.resumeSeason, visibleSeasons]);

  const [selectedSeason, setSelectedSeason] = useState<number>(defaultSeason);

  // Sync if selectedSeason isn't in visibleSeasons
  const activeSeasonNum = visibleSeasons.some((s) => s.seasonNumber === selectedSeason)
    ? selectedSeason
    : defaultSeason;

  const handleSelectSeason = (sNum: number) => {
    setSelectedSeason(sNum);
    onSelectSeason(sNum);
  };

  const todayStr = getTodayDateString();
  const activeEpisodes = useMemo(
    () => [...(episodesBySeason[activeSeasonNum] || [])].sort((a, b) => a.episodeNumber - b.episodeNumber),
    [episodesBySeason, activeSeasonNum]
  );

  const watchedInActiveSeason = useMemo(
    () => new Set(watchedMap[String(activeSeasonNum)] || []),
    [watchedMap, activeSeasonNum]
  );

  const seasonStats = progress.seasonProgress[activeSeasonNum] || {
    seasonNumber: activeSeasonNum,
    watchedCount: watchedInActiveSeason.size,
    airedCount: activeEpisodes.filter((e) => isEpisodeAired(e.airDate, todayStr)).length,
    totalCount: activeEpisodes.length,
  };

  const seasonPercent =
    seasonStats.airedCount > 0
      ? Math.min(100, Math.round((seasonStats.watchedCount / seasonStats.airedCount) * 100))
      : 0;

  const handleToggleEpisode = (ep: EpisodeItem) => {
    if (activeSeasonNum >= 1 && !isEpisodeAired(ep.airDate, todayStr)) return;
    const wasAllWatched = progress.isAllAiredWatched;
    const nextMap = toggleEpisodeInMap(
      episodesBySeason,
      watchedMap,
      activeSeasonNum,
      ep.episodeNumber,
      { markPrevious: false, todayStr }
    );
    const nextSummary = computeSeriesProgress(episodesBySeason, nextMap, status, todayStr);
    onUpdateWatched(nextMap, nextSummary, !wasAllWatched && nextSummary.isAllAiredWatched);
  };

  const handleMarkPrevious = (ep: EpisodeItem) => {
    if (!isEpisodeAired(ep.airDate, todayStr)) return;
    const wasAllWatched = progress.isAllAiredWatched;
    const nextMap = markAllPreviousAcrossSeasons(
      episodesBySeason,
      watchedMap,
      activeSeasonNum,
      ep.episodeNumber,
      todayStr
    );
    const nextSummary = computeSeriesProgress(episodesBySeason, nextMap, status, todayStr);
    onUpdateWatched(nextMap, nextSummary, !wasAllWatched && nextSummary.isAllAiredWatched);
  };

  const handleMarkSeason = () => {
    const wasAllWatched = progress.isAllAiredWatched;
    const nextMap = markSeasonWatchedInMap(episodesBySeason, watchedMap, activeSeasonNum, todayStr);
    const nextSummary = computeSeriesProgress(episodesBySeason, nextMap, status, todayStr);
    onUpdateWatched(nextMap, nextSummary, !wasAllWatched && nextSummary.isAllAiredWatched);
  };

  const handleUnmarkSeason = () => {
    const nextMap = unmarkSeasonInMap(watchedMap, activeSeasonNum);
    const nextSummary = computeSeriesProgress(episodesBySeason, nextMap, status, todayStr);
    onUpdateWatched(nextMap, nextSummary, false);
  };

  const handlePlusOne = () => {
    const wasAllWatched = progress.isAllAiredWatched;
    const res = advanceOneEpisodeInMap(episodesBySeason, watchedMap, todayStr);
    if (res.markedSeason !== null) {
      onUpdateWatched(res.watched, res.summary, !wasAllWatched && res.summary.isAllAiredWatched);
      if (res.summary.resumeSeason && res.summary.resumeSeason !== activeSeasonNum) {
        setSelectedSeason(res.summary.resumeSeason);
        onSelectSeason(res.summary.resumeSeason);
      }
    }
  };

  const resumeLabel =
    progress.resumeSeason && progress.resumeEpisode
      ? formatEpisodeCode(progress.resumeSeason, progress.resumeEpisode)
      : null;

  return (
    <section aria-label="Episode tracker" className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-4 md:p-6">
      {/* Header: Resume Point + +1 Episode + Overall Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="font-display text-[20px] font-bold text-[var(--ink)]">Episodes</h2>
          {resumeLabel ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)]/15 px-3 py-1 text-[13px] font-semibold text-[var(--accent)] tabular-nums">
              <PlayIcon size={12} />
              <span>Resume: {resumeLabel}</span>
            </span>
          ) : progress.isAllAiredWatched ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-subtle)] px-3 py-1 text-[13px] font-semibold text-[var(--ink)]">
              <CheckIcon size={13} />
              <span>All aired watched</span>
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasSpecials && (
            <button
              type="button"
              onClick={() => setShowSpecials((v) => !v)}
              className={`tap-press min-h-[44px] rounded-full px-3.5 text-[13px] font-medium transition-colors ${
                showSpecials
                  ? 'bg-[var(--inverse-bg)] text-[var(--inverse-ink)]'
                  : 'border border-[var(--border)] text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              {showSpecials ? 'Hide specials' : 'Show specials'}
            </button>
          )}
          {resumeLabel && (
            <button
              type="button"
              onClick={handlePlusOne}
              className="tap-press min-h-[44px] rounded-full bg-[var(--accent)] px-4 text-[13px] font-semibold text-white hover:brightness-95"
            >
              +1 episode
            </button>
          )}
        </div>
      </div>

      {/* New episodes banner if status is Watched */}
      {progress.hasNewEpisodes && resumeLabel && onMoveToWatching && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-4 py-3">
          <p className="text-[14px] font-medium text-[var(--ink)]">
            New episodes released since you finished · Next up {resumeLabel}
          </p>
          <button
            type="button"
            onClick={onMoveToWatching}
            className="tap-press min-h-[44px] rounded-full bg-[var(--accent)] px-4 text-[13px] font-semibold text-white hover:brightness-95"
          >
            Move to Watching
          </button>
        </div>
      )}

      {/* Overall Series Progress */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-[13px] text-[var(--muted)] tabular-nums">
          <span>Overall progress</span>
          <span>
            {progress.watchedCount} / {progress.totalAiredEpisodes} aired watched ({progress.percent}%)
          </span>
        </div>
        <div className="mt-1.5 h-[5px] w-full overflow-hidden rounded-full bg-[var(--surface-subtle)]">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </div>

      {/* Responsive Split: Seasons (left on desktop / horizontal pills on mobile) + Episodes */}
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-[230px_minmax(0,1fr)]">
        {/* Seasons selector */}
        <div>
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible">
            {visibleSeasons.map((s) => {
              const active = s.seasonNumber === activeSeasonNum;
              const sp = progress.seasonProgress[s.seasonNumber];
              const countLabel = sp
                ? `${sp.watchedCount}/${sp.airedCount}`
                : `${s.episodeCount} eps`;
              return (
                <button
                  key={s.seasonNumber}
                  type="button"
                  onClick={() => handleSelectSeason(s.seasonNumber)}
                  className={`tap-press flex min-h-[44px] shrink-0 items-center justify-between gap-3 rounded-full px-4 text-left text-[13px] font-semibold whitespace-nowrap transition-colors md:w-full md:rounded-[14px] ${
                    active
                      ? 'bg-[var(--inverse-bg)] text-[var(--inverse-ink)]'
                      : 'border border-[var(--border)] bg-transparent text-[var(--ink)] hover:bg-[var(--surface-subtle)]'
                  }`}
                >
                  <span>{s.name}</span>
                  <span className={`text-[12px] tabular-nums ${active ? 'opacity-80' : 'text-[var(--muted)]'}`}>
                    {countLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Episode List */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--border)]">
            <div>
              <p className="font-display text-[16px] font-bold text-[var(--ink)]">
                {visibleSeasons.find((s) => s.seasonNumber === activeSeasonNum)?.name || `Season ${activeSeasonNum}`}
              </p>
              <p className="text-[13px] text-[var(--muted)] tabular-nums">
                {seasonStats.watchedCount} / {seasonStats.airedCount} watched
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleMarkSeason}
                className="tap-press min-h-[44px] rounded-full border border-[var(--border)] px-3.5 text-[12px] font-semibold text-[var(--ink)] hover:bg-[var(--surface-subtle)]"
              >
                Mark season watched
              </button>
              {watchedInActiveSeason.size > 0 && (
                <button
                  type="button"
                  onClick={handleUnmarkSeason}
                  className="tap-press min-h-[44px] rounded-full px-3 text-[12px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
                >
                  Unmark season
                </button>
              )}
            </div>
          </div>

          <div className="mt-2.5 h-[4px] w-full overflow-hidden rounded-full bg-[var(--surface-subtle)]">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
              style={{ width: `${seasonPercent}%` }}
            />
          </div>

          {loadingSeason === activeSeasonNum && activeEpisodes.length === 0 ? (
            <div className="mt-4 space-y-2.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-[56px] animate-pulse rounded-[14px] bg-[var(--surface-subtle)]" />
              ))}
            </div>
          ) : activeEpisodes.length === 0 ? (
            <p className="py-6 text-sm text-[var(--muted)]">
              No episode details available for this season yet.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--border)]">
              {activeEpisodes.map((ep) => {
                const aired = activeSeasonNum === 0 || isEpisodeAired(ep.airDate, todayStr);
                const checked = watchedInActiveSeason.has(ep.episodeNumber);
                const isResumePoint =
                  progress.resumeSeason === activeSeasonNum &&
                  progress.resumeEpisode === ep.episodeNumber;

                return (
                  <li
                    key={ep.id}
                    className={`flex min-h-[60px] items-center gap-2 py-2 transition-opacity ${
                      !aired ? 'opacity-45' : ''
                    }`}
                  >
                    <button
                      type="button"
                      disabled={!aired}
                      onClick={() => handleToggleEpisode(ep)}
                      aria-label={`${checked ? 'Unmark' : 'Mark'} S${activeSeasonNum} E${ep.episodeNumber} ${ep.name} as watched`}
                      aria-pressed={checked}
                      className="tap-press flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed"
                    >
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full border transition-all duration-150 ${
                          checked
                            ? 'animate-check-pop border-[var(--accent)] bg-[var(--accent)] text-white'
                            : 'border-[var(--border)] bg-transparent text-transparent'
                        }`}
                      >
                        <CheckIcon size={14} />
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={!aired}
                      onClick={() => handleToggleEpisode(ep)}
                      className="min-w-0 flex-1 py-1 text-left disabled:cursor-not-allowed"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[14px] font-semibold text-[var(--ink)]">
                          <span className="tabular-nums">E{ep.episodeNumber}</span> · {ep.name}
                        </p>
                        {isResumePoint && (
                          <span className="rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)]">
                            Next
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[12px] text-[var(--muted)] tabular-nums">
                        {!aired
                          ? `Unaired${ep.airDate ? ` · ${ep.airDate}` : ''}`
                          : [ep.airDate, ep.runtime ? `${ep.runtime}m` : null]
                              .filter(Boolean)
                              .join(' · ')}
                      </p>
                    </button>

                    {aired && !checked && activeSeasonNum >= 1 && (
                      <button
                        type="button"
                        onClick={() => handleMarkPrevious(ep)}
                        className="tap-press min-h-[44px] shrink-0 rounded-full px-3 text-[12px] font-medium text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]"
                      >
                        Mark previous
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
};
