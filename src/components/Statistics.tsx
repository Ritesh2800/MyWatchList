import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { LibraryEntry, MediaType } from '../types/reelist';
import { computeLibraryStatistics, type StatisticsTimeframe } from '../utils/statisticsLogic';
import { ChevronRightIcon } from './Icons';

interface StatisticsProps {
  entries: LibraryEntry[];
  loading?: boolean;
  variant?: 'preview' | 'full';
  onViewAll?: () => void;
  onGoSearch?: () => void;
  onOpenDetails?: (mediaType: MediaType, tmdbId: number) => void;
}

interface TooltipPayloadItem {
  name?: string;
  value?: number;
  color?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

const ChartTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-[12px] text-[var(--ink)] shadow-lg">
      {label && <p className="font-display font-bold text-[var(--ink)]">{label}</p>}
      <div className="mt-1 space-y-0.5">
        {payload.map((item, idx) => (
          <p key={`${item.name || idx}`} className="flex items-center justify-between gap-4 tabular-nums">
            <span className="flex items-center gap-1.5 text-[var(--muted)]">
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: item.color || 'var(--accent)' }}
              />
              <span>{item.name}</span>
            </span>
            <span className="font-semibold text-[var(--ink)]">{item.value ?? 0}</span>
          </p>
        ))}
      </div>
    </div>
  );
};

export const Statistics: React.FC<StatisticsProps> = ({
  entries,
  loading = false,
  variant = 'full',
  onViewAll,
  onGoSearch,
  onOpenDetails,
}) => {
  const [monthWindow, setMonthWindow] = useState<StatisticsTimeframe>(
    variant === 'preview' ? 6 : 12
  );
  const stats = useMemo(
    () => computeLibraryStatistics(entries, { monthWindow }),
    [entries, monthWindow]
  );

  const [previewChartMode, setPreviewChartMode] = useState<'auto' | 'monthly' | 'genres'>('auto');
  const resolvedPreviewMode: 'monthly' | 'genres' =
    previewChartMode === 'auto'
      ? stats.monthlyWatchTotal > 0 || stats.genreDistribution.length === 0
        ? 'monthly'
        : 'genres'
      : previewChartMode;

  const recentCompleted = useMemo(
    () =>
      entries
        .filter((e) => e.status === 'watched' || typeof e.rating === 'number')
        .sort((a, b) => (b.updatedAt || b.addedAt).localeCompare(a.updatedAt || a.addedAt))
        .slice(0, 5),
    [entries]
  );

  const showSkeleton = loading && entries.length === 0;

  if (variant === 'preview') {
    return (
      <section aria-label="Statistics overview">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-[20px] font-bold tracking-[-0.01em] text-[var(--ink)]">
            Statistics
          </h2>
          {onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="tap-press inline-flex min-h-[44px] items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-[13px] font-semibold whitespace-nowrap text-[var(--ink)] hover:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              <span>View all statistics</span>
              <ChevronRightIcon size={15} />
            </button>
          )}
        </div>

        <div className="mt-3.5 rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-5 md:p-6">
          {showSkeleton ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="skeleton-shimmer h-3.5 w-20 rounded" />
                    <div className="skeleton-shimmer h-7 w-12 rounded" />
                  </div>
                ))}
              </div>
              <div className="skeleton-shimmer h-[190px] w-full rounded-[16px]" />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-4 py-2">
              <div>
                <p className="text-[15px] font-semibold text-[var(--ink)]">
                  Your watch stats will appear here
                </p>
                <p className="mt-1 text-[13px] text-[var(--muted)]">
                  Track movies or series to visualize monthly activity and favorite genres.
                </p>
              </div>
              {onViewAll && (
                <button
                  type="button"
                  onClick={onViewAll}
                  className="tap-press min-h-[44px] rounded-full bg-[var(--surface-subtle)] px-4 text-[13px] font-semibold text-[var(--ink)] hover:bg-[var(--border)]"
                >
                  Open statistics
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:flex-wrap sm:items-center sm:gap-8">
                  <div>
                    <p className="text-[12px] font-medium text-[var(--muted)]">Total titles</p>
                    <p className="font-display text-[24px] font-bold text-[var(--ink)] tabular-nums">
                      {stats.totalTitles}
                    </p>
                  </div>
                  <div>
                    <p className="text-[12px] font-medium text-[var(--muted)]">Completed</p>
                    <p className="font-display text-[24px] font-bold text-[var(--ink)] tabular-nums">
                      {stats.completedCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-[12px] font-medium text-[var(--muted)]">Hours watched</p>
                    <p className="font-display text-[24px] font-bold text-[var(--accent)] tabular-nums">
                      {stats.estimatedHoursWatched}h
                    </p>
                  </div>
                  <div>
                    <p className="text-[12px] font-medium text-[var(--muted)]">Avg rating</p>
                    <p className="font-display text-[24px] font-bold text-[var(--ink)] tabular-nums">
                      {stats.averageRating !== null ? `${stats.averageRating}/10` : '—'}
                    </p>
                  </div>
                </div>

                <div
                  role="group"
                  aria-label="Preview chart mode"
                  className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] p-1"
                >
                  <button
                    type="button"
                    aria-pressed={resolvedPreviewMode === 'monthly'}
                    onClick={() => setPreviewChartMode('monthly')}
                    className={`min-h-[36px] rounded-full px-3.5 text-[12px] font-semibold whitespace-nowrap transition-colors ${
                      resolvedPreviewMode === 'monthly'
                        ? 'bg-[var(--inverse-bg)] text-[var(--inverse-ink)]'
                        : 'text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    aria-pressed={resolvedPreviewMode === 'genres'}
                    onClick={() => setPreviewChartMode('genres')}
                    className={`min-h-[36px] rounded-full px-3.5 text-[12px] font-semibold whitespace-nowrap transition-colors ${
                      resolvedPreviewMode === 'genres'
                        ? 'bg-[var(--inverse-bg)] text-[var(--inverse-ink)]'
                        : 'text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    Genres
                  </button>
                </div>
              </div>

              <div className="h-[200px] w-full min-w-0">
                {resolvedPreviewMode === 'monthly' ? (
                  <ResponsiveContainer width="100%" height={200} minWidth={0} initialDimension={{ width: 640, height: 200 }}>
                    <BarChart
                      data={stats.monthlyActivity}
                      margin={{ top: 8, right: 8, left: -22, bottom: 0 }}
                    >
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: 'var(--muted)', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: 'var(--muted)', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-subtle)' }} />
                      <Bar
                        dataKey="movies"
                        name="Movies"
                        stackId="a"
                        fill="#ff7a59"
                        radius={[0, 0, 0, 0]}
                        animationDuration={200}
                      />
                      <Bar
                        dataKey="series"
                        name="Series"
                        stackId="a"
                        fill="#5b8c85"
                        radius={[6, 6, 0, 0]}
                        animationDuration={200}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : stats.genreDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200} minWidth={0} initialDimension={{ width: 640, height: 200 }}>
                    <BarChart
                      data={stats.genreDistribution.slice(0, 6)}
                      margin={{ top: 8, right: 8, left: -22, bottom: 0 }}
                    >
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="genre"
                        tick={{ fill: 'var(--muted)', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                        tickFormatter={(val: string) => (val.length > 10 ? `${val.slice(0, 9)}…` : val)}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: 'var(--muted)', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-subtle)' }} />
                      <Bar
                        dataKey="count"
                        name="Titles"
                        fill="#ff7a59"
                        radius={[6, 6, 0, 0]}
                        animationDuration={200}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-[13px] text-[var(--muted)]">
                    No genre tags recorded for your current titles yet.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }

  // Full Statistics Page
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[32px] font-bold tracking-[-0.02em] text-[var(--ink)] md:text-[36px]">
            Statistics
          </h1>
          <p className="mt-1 text-[14px] text-[var(--muted)] tabular-nums">
            {stats.totalTitles} titles · {stats.moviesCount} movies · {stats.seriesCount} series ·{' '}
            {stats.episodesWatched} episodes watched
          </p>
        </div>

        <div
          role="group"
          aria-label="Monthly timeframe"
          className="inline-flex flex-wrap items-center rounded-full border border-[var(--border)] bg-[var(--surface)] p-1"
        >
          <button
            type="button"
            aria-pressed={monthWindow === 6}
            onClick={() => setMonthWindow(6)}
            className={`min-h-[40px] rounded-full px-3 text-[12px] font-semibold whitespace-nowrap transition-colors sm:px-4 sm:text-[13px] ${
              monthWindow === 6
                ? 'bg-[var(--inverse-bg)] text-[var(--inverse-ink)]'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            Last 6 months
          </button>
          <button
            type="button"
            aria-pressed={monthWindow === 12}
            onClick={() => setMonthWindow(12)}
            className={`min-h-[40px] rounded-full px-3 text-[12px] font-semibold whitespace-nowrap transition-colors sm:px-4 sm:text-[13px] ${
              monthWindow === 12
                ? 'bg-[var(--inverse-bg)] text-[var(--inverse-ink)]'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            Last 12 months
          </button>
          <button
            type="button"
            aria-pressed={monthWindow === 'all'}
            onClick={() => setMonthWindow('all')}
            className={`min-h-[40px] rounded-full px-3 text-[12px] font-semibold whitespace-nowrap transition-colors sm:px-4 sm:text-[13px] ${
              monthWindow === 'all'
                ? 'bg-[var(--inverse-bg)] text-[var(--inverse-ink)]'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            All time
          </button>
        </div>
      </div>

      {showSkeleton ? (
        <div className="space-y-6">
          <div className="skeleton-shimmer h-28 w-full rounded-[22px]" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="skeleton-shimmer h-[320px] w-full rounded-[22px]" />
            <div className="skeleton-shimmer h-[320px] w-full rounded-[22px]" />
          </div>
        </div>
      ) : entries.length === 0 ? (
        <section
          aria-label="Empty statistics"
          className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-10 text-center"
        >
          <h2 className="font-display text-[20px] font-bold text-[var(--ink)]">
            No library activity yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[14px] text-[var(--muted)]">
            Start adding movies and series to your watchlist, mark titles completed, or rate what you watch to populate your charts.
          </p>
          {onGoSearch && (
            <button
              type="button"
              onClick={onGoSearch}
              className="tap-press mt-5 min-h-[44px] rounded-full bg-[var(--inverse-bg)] px-6 text-[14px] font-semibold text-[var(--inverse-ink)]"
            >
              Search titles
            </button>
          )}
        </section>
      ) : (
        <>
          {/* Summary KPI Strip */}
          <section
            aria-label="Key metrics"
            className="grid grid-cols-2 gap-6 rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-5 sm:grid-cols-4 md:p-6"
          >
            <div>
              <p className="text-[12px] font-medium text-[var(--muted)]">Total titles</p>
              <p className="mt-1 font-display text-[30px] font-bold text-[var(--ink)] tabular-nums">
                {stats.totalTitles}
              </p>
              <p className="mt-0.5 text-[12px] text-[var(--muted)] tabular-nums">
                {stats.moviesCount} movies · {stats.seriesCount} series
              </p>
            </div>
            <div>
              <p className="text-[12px] font-medium text-[var(--muted)]">Completed</p>
              <p className="mt-1 font-display text-[30px] font-bold text-[var(--ink)] tabular-nums">
                {stats.completedCount}
              </p>
              <p className="mt-0.5 text-[12px] text-[var(--muted)] tabular-nums">
                {stats.watchingCount} currently watching
              </p>
            </div>
            <div>
              <p className="text-[12px] font-medium text-[var(--muted)]">Est. hours watched</p>
              <p className="mt-1 font-display text-[30px] font-bold text-[var(--accent)] tabular-nums">
                {stats.estimatedHoursWatched}h
              </p>
              <p className="mt-0.5 text-[12px] text-[var(--muted)] tabular-nums">
                {stats.episodesWatched} episodes tracked
              </p>
            </div>
            <div>
              <p className="text-[12px] font-medium text-[var(--muted)]">Average rating</p>
              <p className="mt-1 font-display text-[30px] font-bold text-[var(--ink)] tabular-nums">
                {stats.averageRating !== null ? `${stats.averageRating}/10` : '—'}
              </p>
              <p className="mt-0.5 text-[12px] text-[var(--muted)] tabular-nums">
                {stats.ratedCount} rated {stats.ratedCount === 1 ? 'title' : 'titles'}
              </p>
            </div>
          </section>

          {/* Primary Charts Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Monthly Activity */}
            <section
              aria-label="Watched per month"
              className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-5 md:p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-[18px] font-bold text-[var(--ink)]">
                    {monthWindow === 'all' ? 'Watched by year' : 'Watched per month'}
                  </h2>
                  <p className="text-[13px] text-[var(--muted)]">
                    {monthWindow === 'all'
                      ? 'Completed and active titles across all years'
                      : `Completed and active titles over the last ${monthWindow} months`}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[12px] text-[var(--muted)]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#ff7a59]" />
                    Movies
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#5b8c85]" />
                    Series
                  </span>
                </div>
              </div>

              <div className="mt-4 h-[250px] w-full min-w-0">
                <ResponsiveContainer width="100%" height={250} minWidth={0} initialDimension={{ width: 540, height: 250 }}>
                  <BarChart
                    data={stats.monthlyActivity}
                    margin={{ top: 10, right: 8, left: -22, bottom: 0 }}
                  >
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: 'var(--muted)', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: 'var(--muted)', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-subtle)' }} />
                    <Bar
                      dataKey="movies"
                      name="Movies"
                      stackId="monthly"
                      fill="#ff7a59"
                      radius={[0, 0, 0, 0]}
                      animationDuration={200}
                    />
                    <Bar
                      dataKey="series"
                      name="Series"
                      stackId="monthly"
                      fill="#5b8c85"
                      radius={[6, 6, 0, 0]}
                      animationDuration={200}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Genre Distribution */}
            <section
              aria-label="Genre distribution"
              className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-5 md:p-6"
            >
              <div>
                <h2 className="font-display text-[18px] font-bold text-[var(--ink)]">
                  Genre distribution
                </h2>
                <p className="text-[13px] text-[var(--muted)]">
                  Top genres across your saved movies and series
                </p>
              </div>

              <div className="mt-4 h-[250px] w-full min-w-0">
                {stats.genreDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250} minWidth={0} initialDimension={{ width: 540, height: 250 }}>
                    <BarChart
                      layout="vertical"
                      data={stats.genreDistribution}
                      margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
                    >
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        tick={{ fill: 'var(--muted)', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="genre"
                        width={92}
                        tick={{ fill: 'var(--ink)', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-subtle)' }} />
                      <Bar
                        dataKey="count"
                        name="Titles"
                        fill="#ff7a59"
                        radius={[0, 6, 6, 0]}
                        animationDuration={200}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-[13px] text-[var(--muted)]">
                    Add titles with genres to see your distribution.
                  </div>
                )}
              </div>
            </section>

            {/* Status Breakdown */}
            <section
              aria-label="Library status breakdown"
              className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-5 md:p-6"
            >
              <div>
                <h2 className="font-display text-[18px] font-bold text-[var(--ink)]">
                  By watch status
                </h2>
                <p className="text-[13px] text-[var(--muted)]">
                  How titles are organized across your library
                </p>
              </div>

              <div className="mt-4 h-[230px] w-full min-w-0">
                <ResponsiveContainer width="100%" height={230} minWidth={0} initialDimension={{ width: 540, height: 230 }}>
                  <BarChart
                    data={stats.statusDistribution}
                    margin={{ top: 10, right: 8, left: -22, bottom: 0 }}
                  >
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: 'var(--muted)', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: 'var(--muted)', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-subtle)' }} />
                    <Bar
                      dataKey="count"
                      name="Titles"
                      fill="#5b8c85"
                      radius={[6, 6, 0, 0]}
                      animationDuration={200}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Rating Distribution */}
            <section
              aria-label="Rating distribution"
              className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-5 md:p-6"
            >
              <div>
                <h2 className="font-display text-[18px] font-bold text-[var(--ink)]">
                  Rating distribution
                </h2>
                <p className="text-[13px] text-[var(--muted)]">
                  Score spread across rated titles (1–10)
                </p>
              </div>

              <div className="mt-4 h-[230px] w-full min-w-0">
                {stats.ratedCount > 0 ? (
                  <ResponsiveContainer width="100%" height={230} minWidth={0} initialDimension={{ width: 540, height: 230 }}>
                    <BarChart
                      data={stats.ratingDistribution}
                      margin={{ top: 10, right: 8, left: -22, bottom: 0 }}
                    >
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="score"
                        tick={{ fill: 'var(--muted)', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: 'var(--muted)', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-subtle)' }} />
                      <Bar
                        dataKey="count"
                        name="Titles"
                        fill="#ff7a59"
                        radius={[6, 6, 0, 0]}
                        animationDuration={200}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-[13px] text-[var(--muted)]">
                    Rate a completed movie or series to view your score distribution.
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Recent Completed / Rated Highlights */}
          {recentCompleted.length > 0 && (
            <section
              aria-label="Recently completed or rated"
              className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-5 md:p-6"
            >
              <h2 className="font-display text-[18px] font-bold text-[var(--ink)]">
                Recent completions &amp; ratings
              </h2>
              <div className="mt-3 divide-y divide-[var(--border)]">
                {recentCompleted.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => onOpenDetails?.(entry.mediaType, entry.tmdbId)}
                    className="flex min-h-[52px] w-full items-center justify-between gap-4 py-2.5 text-left transition-colors hover:opacity-80"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-[var(--ink)]">
                        {entry.title}
                      </p>
                      <p className="text-[12px] text-[var(--muted)]">
                        {entry.mediaType === 'tv' ? 'Series' : 'Movie'}
                        {entry.year ? ` · ${entry.year}` : ''}
                        {entry.finishedAt ? ` · Completed ${entry.finishedAt}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-[13px] font-semibold text-[var(--accent)] tabular-nums">
                      {typeof entry.rating === 'number' ? `${entry.rating}/10` : 'Completed'}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};
