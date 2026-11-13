import React from 'react';

export const ContinueWatchingSkeleton: React.FC = () => (
  <>
    {/* Desktop Featured Continue Watching Banner Skeleton */}
    <section className="hidden md:block" aria-label="Loading continue watching" aria-busy="true">
      <div className="relative h-[290px] w-full overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface)] lg:h-[320px]">
        <div className="skeleton-shimmer h-full w-full" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-8">
          <div className="w-full max-w-md space-y-3">
            <div className="skeleton-shimmer h-3 w-32 rounded-full" />
            <div className="skeleton-shimmer h-9 w-64 rounded-[10px]" />
            <div className="skeleton-shimmer h-4 w-36 rounded-full" />
            <div className="skeleton-shimmer mt-2 h-[4px] w-[240px] rounded-full" />
          </div>
          <div className="skeleton-shimmer h-[44px] w-[108px] shrink-0 rounded-full" />
        </div>
      </div>
    </section>

    {/* Mobile Continue Watching Row Skeleton */}
    <section className="md:hidden" aria-label="Loading continue watching" aria-busy="true">
      <div className="skeleton-shimmer h-6 w-44 rounded-[8px]" />
      <div className="no-scrollbar mt-3.5 flex gap-3.5 overflow-hidden pb-1">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="w-[262px] shrink-0">
            <div className="skeleton-shimmer aspect-[16/10] w-full rounded-[18px]" />
            <div className="skeleton-shimmer mt-2.5 h-4 w-3/5 rounded-[6px]" />
            <div className="skeleton-shimmer mt-1.5 h-3.5 w-16 rounded-[6px]" />
          </div>
        ))}
      </div>
    </section>
  </>
);

export const TrendingGridSkeleton: React.FC<{ count?: number }> = ({ count = 12 }) => (
  <div
    className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] md:gap-5"
    aria-busy="true"
    aria-label="Loading trending titles"
  >
    {Array.from({ length: count }).map((_, idx) => (
      <div key={idx}>
        <div className="skeleton-shimmer aspect-[2/3] w-full rounded-[16px]" />
        <div className="skeleton-shimmer mt-2.5 h-4 w-3/4 rounded-[6px]" />
        <div className="skeleton-shimmer mt-1.5 h-3.5 w-1/3 rounded-[6px]" />
      </div>
    ))}
  </div>
);

export const LibraryGridSkeleton: React.FC<{ count?: number }> = ({ count = 9 }) => (
  <div
    className="mt-5 grid grid-cols-3 gap-3 md:grid-cols-[repeat(auto-fill,minmax(168px,1fr))] md:gap-5"
    aria-busy="true"
    aria-label="Loading library entries"
  >
    {Array.from({ length: count }).map((_, idx) => (
      <div key={idx}>
        <div className="skeleton-shimmer aspect-[2/3] w-full rounded-[14px] md:rounded-[16px]" />
        <div className="skeleton-shimmer mt-2 h-3.5 w-4/5 rounded-[6px]" />
        <div className="skeleton-shimmer mt-1.5 h-3 w-2/5 rounded-[6px]" />
      </div>
    ))}
  </div>
);

export const AppBootSkeleton: React.FC = () => (
  <div
    className="min-h-dvh bg-[var(--bg)] text-[var(--ink)]"
    aria-busy="true"
    aria-label="Loading SeenIt"
  >
    <header className="fixed inset-x-0 top-0 z-30">
      <div className="mx-auto flex max-w-[1344px] items-center justify-between px-4 pt-3.5 md:px-8 md:pt-5">
        <span className="font-display text-[28px] font-bold tracking-[-0.03em] leading-none text-[var(--ink)] md:text-[34px]">
          Seen<span className="text-[var(--accent)]">It</span>
        </span>
        <div className="skeleton-shimmer h-[44px] w-[44px] rounded-full" />
      </div>
    </header>

    <main className="mx-auto max-w-[1344px] px-4 pt-[78px] pb-[118px] md:px-8 md:pt-[92px] md:pb-[124px]">
      <div className="space-y-8 md:space-y-10">
        <ContinueWatchingSkeleton />
        <section>
          <div className="skeleton-shimmer h-6 w-48 rounded-[8px]" />
          <TrendingGridSkeleton count={12} />
        </section>
      </div>
    </main>
  </div>
);
