import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { isFirebaseConfigured } from '../services/firebase';
import type { LibraryEntry, ThemePreference, UserProfile, WatchStatus } from '../types/reelist';
import { computeProfileStats } from '../utils/episodeLogic';
import {
  CheckIcon,
  CloseIcon,
  DownloadIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  TmdbLogo,
} from './Icons';

interface ProfileViewProps {
  user: UserProfile;
  entries: LibraryEntry[];
  loading?: boolean;
  theme: ThemePreference;
  tmdbConfigured: boolean;
  onChangeTheme: (theme: ThemePreference) => void;
  onSignOut: () => Promise<void>;
}

const STATUS_LABELS: { id: WatchStatus; label: string }[] = [
  { id: 'watching', label: 'Watching' },
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'watched', label: 'Completed' },
  { id: 'onhold', label: 'On hold' },
  { id: 'dropped', label: 'Dropped' },
];

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  entries,
  loading = false,
  theme,
  tmdbConfigured,
  onChangeTheme,
  onSignOut,
}) => {
  const showStatsSkeleton = loading && entries.length === 0;
  const stats = useMemo(() => computeProfileStats(entries), [entries]);
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  const initial = (user.displayName || user.email || 'R').trim().charAt(0).toUpperCase() || 'R';

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowInstallGuide(true);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <h1 className="font-display text-[32px] font-bold tracking-[-0.02em] text-[var(--ink)] md:text-[36px]">
        Profile
      </h1>

      {/* Account Header */}
      <section aria-label="Account" className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3.5 sm:gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--inverse-bg)] font-display text-xl font-bold text-[var(--inverse-ink)]">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{initial}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-display text-[20px] font-bold text-[var(--ink)]">
                {user.displayName}
              </h2>
              <p className="truncate text-[14px] text-[var(--muted)]">{user.email}</p>
              <p className="mt-1 text-[12px] text-[var(--muted)]">
                {isFirebaseConfigured && !user.isLocal
                  ? 'Synced with Cloud Firestore'
                  : 'Saved locally on this device'}
                {' · '}
                {tmdbConfigured ? 'TMDB live API' : 'Offline catalog'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void onSignOut()}
            className="tap-press inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[var(--border)] px-4 text-[14px] font-semibold text-[var(--ink)] hover:bg-[var(--surface-subtle)]"
          >
            <LogOutIcon size={16} />
            <span>Sign out</span>
          </button>
        </div>
      </section>

      {/* Appearance & Install */}
      <section aria-label="Preferences" className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-[18px] font-bold text-[var(--ink)]">Appearance</h2>
            <p className="text-[13px] text-[var(--muted)]">Follows system theme by default.</p>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Theme preference">
            {(
              [
                { id: 'system', label: 'System', icon: <MonitorIcon size={15} /> },
                { id: 'light', label: 'Light', icon: <SunIcon size={15} /> },
                { id: 'dark', label: 'Dark', icon: <MoonIcon size={15} /> },
              ] as { id: ThemePreference; label: string; icon: React.ReactNode }[]
            ).map((opt) => {
              const active = theme === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChangeTheme(opt.id)}
                  className={`tap-press inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition-colors ${
                    active
                      ? 'bg-[var(--inverse-bg)] text-[var(--inverse-ink)]'
                      : 'border border-[var(--border)] text-[var(--ink)] hover:bg-[var(--surface-subtle)]'
                  }`}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--border)] pt-5">
          <div>
            <h3 className="font-display text-[16px] font-bold text-[var(--ink)]">Install SeenIt</h3>
            <p className="text-[13px] text-[var(--muted)]">
              Add to your home screen or desktop for offline access.
            </p>
          </div>
          {isInstalled ? (
            <span className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-[var(--surface-subtle)] px-4 text-[13px] font-semibold text-[var(--ink)]">
              <CheckIcon size={15} />
              <span>Installed</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => void handleInstallClick()}
              className="tap-press inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[var(--accent)] px-5 text-[13px] font-semibold text-white hover:brightness-95"
            >
              <DownloadIcon size={16} />
              <span>{isIOS ? 'Install on iOS' : 'Install app'}</span>
            </button>
          )}
        </div>
      </section>

      {/* Stats */}
      <section aria-label="Watch statistics" className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-5 md:p-6">
        <h2 className="font-display text-[18px] font-bold text-[var(--ink)]">Watch stats</h2>

        <div className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-4">
          <div>
            <p className="text-[12px] font-medium text-[var(--muted)]">Total titles</p>
            {showStatsSkeleton ? (
              <div className="skeleton-shimmer mt-2 h-8 w-14 rounded-[8px]" />
            ) : (
              <p className="mt-1 font-display text-[28px] font-bold text-[var(--ink)] tabular-nums">
                {stats.totalTitles}
              </p>
            )}
          </div>
          <div>
            <p className="text-[12px] font-medium text-[var(--muted)]">Movies</p>
            {showStatsSkeleton ? (
              <div className="skeleton-shimmer mt-2 h-8 w-14 rounded-[8px]" />
            ) : (
              <p className="mt-1 font-display text-[28px] font-bold text-[var(--ink)] tabular-nums">
                {stats.moviesCount}
              </p>
            )}
          </div>
          <div>
            <p className="text-[12px] font-medium text-[var(--muted)]">Series</p>
            {showStatsSkeleton ? (
              <div className="skeleton-shimmer mt-2 h-8 w-14 rounded-[8px]" />
            ) : (
              <p className="mt-1 font-display text-[28px] font-bold text-[var(--ink)] tabular-nums">
                {stats.seriesCount}
              </p>
            )}
          </div>
          <div>
            <p className="text-[12px] font-medium text-[var(--muted)]">Est. hours watched</p>
            {showStatsSkeleton ? (
              <div className="skeleton-shimmer mt-2 h-8 w-16 rounded-[8px]" />
            ) : (
              <p className="mt-1 font-display text-[28px] font-bold text-[var(--accent)] tabular-nums">
                {stats.estimatedHoursWatched}h
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 border-t border-[var(--border)] pt-5">
          <p className="text-[13px] font-semibold text-[var(--ink)]">By status</p>
          <div className="mt-3 divide-y divide-[var(--border)]">
            {STATUS_LABELS.map((st) => (
              <div key={st.id} className="flex items-center justify-between py-2.5 text-[14px]">
                <span className="text-[var(--muted)]">{st.label}</span>
                {showStatsSkeleton ? (
                  <div className="skeleton-shimmer h-4 w-7 rounded-[6px]" />
                ) : (
                  <span className="font-semibold text-[var(--ink)] tabular-nums">
                    {stats.statusCounts[st.id]}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {stats.topGenres.length > 0 && (
          <div className="mt-5 border-t border-[var(--border)] pt-5">
            <p className="text-[13px] font-semibold text-[var(--ink)]">Top genres</p>
            <p className="mt-2 text-[14px] text-[var(--muted)]">
              {stats.topGenres.map((g) => `${g.genre} (${g.count})`).join(' · ')}
            </p>
          </div>
        )}
      </section>

      {/* TMDB Attribution */}
      <section aria-label="About and attribution" className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-5 md:p-6">
        <TmdbLogo className="h-5 w-auto" />
        <p className="mt-3 text-[13px] leading-relaxed text-[var(--muted)]">
          This product uses the TMDB API but is not endorsed or certified by TMDB.
        </p>
      </section>

      {/* Install Instructions Modal */}
      {showInstallGuide &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Install SeenIt instructions"
            className="animate-backdrop-in fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[3px]"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowInstallGuide(false);
            }}
          >
            <div className="glass-sheet animate-sheet-up w-full max-w-sm rounded-[24px] p-6">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold text-[var(--ink)]">
                  Install SeenIt
                </h3>
                <button
                  type="button"
                  onClick={() => setShowInstallGuide(false)}
                  aria-label="Close install guide"
                  className="tap-press inline-flex h-[44px] w-[44px] items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]"
                >
                  <CloseIcon size={18} />
                </button>
              </div>
              {isIOS ? (
                <ol className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                  <li>1. Tap the <strong className="text-[var(--ink)]">Share</strong> button in Safari&apos;s toolbar.</li>
                  <li>2. Scroll down and tap <strong className="text-[var(--ink)]">Add to Home Screen</strong>.</li>
                  <li>3. Tap <strong className="text-[var(--ink)]">Add</strong> to launch SeenIt as a standalone app.</li>
                </ol>
              ) : (
                <ol className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                  <li>1. In Chrome or Edge, click the <strong className="text-[var(--ink)]">Install</strong> icon in the address bar (or browser menu → Install SeenIt).</li>
                  <li>2. On Android, tap the browser menu → <strong className="text-[var(--ink)]">Add to Home screen</strong>.</li>
                </ol>
              )}
              <button
                type="button"
                onClick={() => setShowInstallGuide(false)}
                className="tap-press mt-5 min-h-[44px] w-full rounded-full bg-[var(--inverse-bg)] text-sm font-semibold text-[var(--inverse-ink)] hover:brightness-95"
              >
                Got it
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
