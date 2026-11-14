import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { AuthView } from './components/AuthView';
import { DetailsView } from './components/DetailsView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HomeView } from './components/HomeView';
import { LibraryView } from './components/LibraryView';
import { FloatingBottomNav, TopBar } from './components/LiquidGlassChrome';
import { ProfileView } from './components/ProfileView';
import { QuickAddModal } from './components/QuickAddModal';
import { RecommendationsView } from './components/RecommendationsView';
import { SearchView } from './components/SearchView';
import { AppBootSkeleton } from './components/SkeletonScreens';
import { Statistics } from './components/Statistics';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { auth, isFirebaseConfigured } from './services/firebase';
import { removeEntry, subscribeEntries, upsertEntry } from './services/libraryStore';
import {
  fetchMediaDetails,
  fetchRecommendations,
  fetchSeasonEpisodes,
  fetchTrending,
  getServerConfig,
} from './services/tmdbApi';
import type {
  ActiveTab,
  EpisodeItem,
  LibraryEntry,
  MediaSummary,
  MediaType,
  RecommendationsResponse,
  ThemePreference,
  UserProfile,
  WatchStatus,
} from './types/reelist';
import { detectNewSeasonForCompletedSeries } from './utils/episodeLogic';
import { buildTasteProfile } from './utils/recommendationLogic';

const THEME_STORAGE_KEY = 'reelist_theme_v1';
const LOCAL_USER_STORAGE_KEY = 'reelist_local_user_v2';

const DEFAULT_LOCAL_USER: UserProfile = {
  uid: 'local-default',
  displayName: 'Ritesh',
  email: 'ritesh@reelist.app',
  photoURL: null,
  isLocal: true,
};

function readInitialTheme(): ThemePreference {
  try {
    const val = localStorage.getItem(THEME_STORAGE_KEY);
    if (val === 'light' || val === 'dark' || val === 'system') return val;
  } catch {
    // Ignore storage error
  }
  return 'system';
}

function readInitialLocalUser(): UserProfile | null {
  try {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        return DEFAULT_LOCAL_USER;
      }
    }
    const raw = localStorage.getItem(LOCAL_USER_STORAGE_KEY);
    if (raw === 'signed_out') return null;
    if (raw) return JSON.parse(raw) as UserProfile;
  } catch {
    // Ignore
  }
  return isFirebaseConfigured ? null : DEFAULT_LOCAL_USER;
}

interface NavState {
  tab: ActiveTab;
  detailTarget?: { mediaType: MediaType; tmdbId: number };
}

function ReelistApp() {
  const [theme, setTheme] = useState<ThemePreference>(readInitialTheme);
  const [user, setUser] = useState<UserProfile | null>(readInitialLocalUser);
  const [authReady, setAuthReady] = useState(() => !isFirebaseConfigured || user !== null);

  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [trending, setTrending] = useState<MediaSummary[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [trendingError, setTrendingError] = useState<string | null>(null);
  const [tmdbConfigured, setTmdbConfigured] = useState(false);

  const [recommendationsData, setRecommendationsData] = useState<RecommendationsResponse>({
    source: 'taste-match',
    topGenres: [],
    recommendations: [],
  });
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);

  const [navStack, setNavStack] = useState<NavState[]>([{ tab: 'home' }]);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [librarySearchOpen, setLibrarySearchOpen] = useState(false);
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');
  const checkedCompletedSeriesRef = useRef<Set<string>>(new Set());
  const isOnline = useOnlineStatus();

  const currentNav = navStack[navStack.length - 1] || { tab: 'home' };
  const pageTransitionKey =
    currentNav.tab === 'details' && currentNav.detailTarget
      ? `details_${currentNav.detailTarget.mediaType}_${currentNav.detailTarget.tmdbId}`
      : currentNav.tab;

  // Apply resolved theme to document root
  useEffect(() => {
    const apply = () => {
      const prefersDark =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      const resolved = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;
      document.documentElement.setAttribute('data-theme', resolved);
    };
    apply();
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  // Firebase Auth listener
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) return;
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        try {
          localStorage.removeItem(LOCAL_USER_STORAGE_KEY);
        } catch {
          // Ignore
        }
        setUser({
          uid: fbUser.uid,
          displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
          email: fbUser.email || '',
          photoURL: fbUser.photoURL,
          isLocal: false,
        });
      } else {
        setUser((prev) => (prev?.isLocal ? prev : null));
      }
      setAuthReady(true);
    });
    return unsub;
  }, []);

  // Load server config & trending
  const loadTrending = useCallback(async () => {
    setTrendingLoading(true);
    setTrendingError(null);
    try {
      const [cfg, trendRes] = await Promise.all([getServerConfig(), fetchTrending()]);
      setTmdbConfigured(cfg.tmdbConfigured);
      setTrending(trendRes.results);
    } catch (err) {
      setTrendingError(err instanceof Error ? err.message : 'Unable to load trending titles.');
    } finally {
      setTrendingLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTrending();
  }, [loadTrending]);

  // Subscribe to library entries once auth is ready and user is authenticated
  useEffect(() => {
    if (!authReady || !user) {
      setEntries([]);
      setEntriesLoading(false);
      return;
    }
    setEntriesLoading(true);
    setSyncError(null);
    const unsub = subscribeEntries(
      user.uid,
      user.isLocal,
      (list) => {
        setEntries(list);
        setEntriesLoading(false);
      },
      (msg) => {
        setSyncError(msg);
        setEntriesLoading(false);
      }
    );
    return unsub;
  }, [authReady, user]);

  const entriesByKey = useMemo(() => {
    const map: Record<string, LibraryEntry> = {};
    for (const e of entries) {
      map[e.id] = e;
    }
    return map;
  }, [entries]);

  const watchingEntries = useMemo(
    () =>
      entries
        .filter((e) => e.status === 'watching')
        .sort((a, b) =>
          (b.lastWatchedAt || b.updatedAt).localeCompare(a.lastWatchedAt || a.updatedAt)
        ),
    [entries]
  );

  const tasteProfile = useMemo(() => buildTasteProfile(entries), [entries]);

  const loadRecommendations = useCallback(
    async (forceRefresh = false) => {
      if (entriesLoading || entries.length === 0) {
        setRecommendationsData({
          source: 'taste-match',
          topGenres: [],
          recommendations: [],
        });
        setRecommendationsError(null);
        setRecommendationsLoading(false);
        return;
      }

      setRecommendationsLoading(true);
      setRecommendationsError(null);
      try {
        const res = await fetchRecommendations(entries, tasteProfile.fingerprint, forceRefresh);
        setRecommendationsData(res);
      } catch (err) {
        setRecommendationsError(
          err instanceof Error ? err.message : 'Unable to generate recommendations.'
        );
      } finally {
        setRecommendationsLoading(false);
      }
    },
    [entriesLoading, entries, tasteProfile.fingerprint]
  );

  useEffect(() => {
    if (!authReady || !user || entriesLoading) return;
    if (entries.length === 0) {
      void loadRecommendations(false);
      return;
    }
    const timer = window.setTimeout(() => {
      void loadRecommendations(false);
    }, 400);
    return () => window.clearTimeout(timer);
    // Re-fetch when the user's library taste fingerprint changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, user, entriesLoading, tasteProfile.fingerprint]);

  const navigateTopTab = (tab: 'home' | 'library' | 'search') => {
    setNavStack([{ tab }]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openDetails = (mediaType: MediaType, tmdbId: number) => {
    setNavStack((prev) => [...prev, { tab: 'details', detailTarget: { mediaType, tmdbId } }]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openProfile = () => {
    setNavStack((prev) => {
      const top = prev[prev.length - 1];
      if (top?.tab === 'profile') return prev;
      return [...prev, { tab: 'profile' }];
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openStatistics = () => {
    setNavStack((prev) => {
      const top = prev[prev.length - 1];
      if (top?.tab === 'statistics') return prev;
      return [...prev, { tab: 'statistics' }];
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openRecommendations = () => {
    setNavStack((prev) => {
      const top = prev[prev.length - 1];
      if (top?.tab === 'recommendations') return prev;
      return [...prev, { tab: 'recommendations' }];
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBack = () => {
    setNavStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : [{ tab: 'home' }]));
  };

  const handleSaveEntry = useCallback(async (entry: LibraryEntry) => {
    if (!user) return;
    // Optimistic update
    setEntries((prev) => {
      const idx = prev.findIndex((item) => item.id === entry.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = entry;
        return next;
      }
      return [entry, ...prev];
    });
    try {
      await upsertEntry(user.uid, entry, user.isLocal);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Failed to save entry.');
    }
  }, [user]);

  // Background check: automatically move Completed TV series back to Watching if a new season aired
  useEffect(() => {
    if (!user || entriesLoading || entries.length === 0) return;

    const completedTvEntries = entries.filter(
      (e) => e.mediaType === 'tv' && e.status === 'watched'
    );
    const pending = completedTvEntries.filter(
      (e) => !checkedCompletedSeriesRef.current.has(`${e.id}:${e.updatedAt}`)
    );
    if (pending.length === 0) return;

    let cancelled = false;
    for (const e of pending) {
      checkedCompletedSeriesRef.current.add(`${e.id}:${e.updatedAt}`);
    }

    void Promise.all(
      pending.map(async (entry) => {
        try {
          const res = await fetchMediaDetails('tv', entry.tmdbId);
          if (cancelled) return;
          const d = res.details;
          let epsBySeason: Record<number, EpisodeItem[]> = d.episodesBySeason || {};

          if (!d.episodesBySeason && d.seasons.length > 0) {
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
            if (cancelled) return;
            epsBySeason = loaded;
          }

          if (Object.keys(epsBySeason).length === 0) return;

          const { shouldMoveToWatching, summary } = detectNewSeasonForCompletedSeries(
            entry,
            epsBySeason
          );
          if (!shouldMoveToWatching || cancelled) return;

          const now = new Date().toISOString();
          await handleSaveEntry({
            ...entry,
            status: 'watching',
            totalEpisodes: summary.totalAiredEpisodes,
            watchedCount: summary.watchedCount,
            resumeSeason: summary.resumeSeason,
            resumeEpisode: summary.resumeEpisode,
            currentSeason: summary.resumeSeason ?? summary.lastWatchedSeason ?? 1,
            currentEpisode: summary.resumeEpisode ?? summary.lastWatchedEpisode ?? 1,
            hasNewEpisodes: false,
            updatedAt: now,
          });
        } catch {
          // Ignore transient TMDB lookup failure during background season check
        }
      })
    );

    return () => {
      cancelled = true;
    };
  }, [user, entriesLoading, entries, handleSaveEntry]);

  const handleRemoveEntry = async (entryId: string) => {
    if (!user) return;
    setEntries((prev) => prev.filter((item) => item.id !== entryId));
    try {
      await removeEntry(user.uid, entryId, user.isLocal);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Failed to remove entry.');
    }
  };

  const handleQuickStatus = async (
    summary: MediaSummary,
    status: WatchStatus,
    patch?: Partial<LibraryEntry>
  ) => {
    const id = `${summary.tmdbId}_${summary.mediaType}`;
    const existing = entriesByKey[id];
    const now = new Date().toISOString();

    const baseEntry: LibraryEntry = existing
      ? { ...existing, status, updatedAt: now }
      : {
          id,
          tmdbId: summary.tmdbId,
          mediaType: summary.mediaType,
          status,
          title: summary.title,
          posterPath: summary.posterPath,
          backdropPath: summary.backdropPath,
          year: summary.year,
          genres: summary.genres,
          runtimeMinutes: summary.mediaType === 'tv' ? 45 : 120,
          watched: summary.mediaType === 'tv' ? {} : undefined,
          resumeSeason: summary.mediaType === 'tv' ? 1 : undefined,
          resumeEpisode: summary.mediaType === 'tv' ? 1 : undefined,
          currentSeason: summary.mediaType === 'tv' ? 1 : undefined,
          currentEpisode: summary.mediaType === 'tv' ? 1 : undefined,
          watchedCount: summary.mediaType === 'tv' ? 0 : undefined,
          addedAt: now,
          updatedAt: now,
          accentGradient: summary.accentGradient,
        };

    const entry: LibraryEntry = patch
      ? { ...baseEntry, ...patch, status, updatedAt: now }
      : baseEntry;

    await handleSaveEntry(entry);
  };

  const handleSignOut = async () => {
    try {
      localStorage.setItem(LOCAL_USER_STORAGE_KEY, 'signed_out');
    } catch {
      // Ignore
    }
    if (isFirebaseConfigured && auth && !user?.isLocal) {
      await signOut(auth);
    }
    setUser(null);
    setNavStack([{ tab: 'home' }]);
  };

  const handleLocalSignIn = (localUser: UserProfile) => {
    try {
      localStorage.setItem(LOCAL_USER_STORAGE_KEY, JSON.stringify(localUser));
    } catch {
      // Ignore
    }
    setUser(localUser);
    setNavStack([{ tab: 'home' }]);
  };

  if (!authReady) {
    return <AppBootSkeleton />;
  }

  if (!user) {
    return <AuthView onLocalSignIn={handleLocalSignIn} />;
  }

  return (
    <div className="relative min-h-dvh bg-[var(--bg)] text-[var(--ink)]">
      <div id="page-ambient-slot" aria-hidden="true" />
      <TopBar
        activeTab={currentNav.tab}
        user={user}
        librarySearchQuery={librarySearchQuery}
        librarySearchOpen={librarySearchOpen}
        onLibrarySearchOpenChange={setLibrarySearchOpen}
        onLibrarySearchChange={setLibrarySearchQuery}
        onBack={goBack}
        onOpenProfile={openProfile}
        onGoHome={() => navigateTopTab('home')}
      />

      <main
        className={`relative z-10 mx-auto max-w-[1344px] px-4 pb-[118px] md:px-8 md:pb-[124px] ${
          currentNav.tab === 'home' ? 'pt-5 md:pt-7' : 'pt-[78px] md:pt-[92px]'
        }`}
      >
        {!isOnline && (
          <div
            role="status"
            className="mb-4 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-center text-[13px] font-medium text-[var(--muted)]"
          >
            Offline mode — cached data is active
          </div>
        )}

        {syncError && (
          <div
            role="alert"
            className="mb-4 rounded-[16px] border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-4 py-3 text-[13px] font-medium text-[var(--accent)]"
          >
            {syncError}
          </div>
        )}

        <div key={pageTransitionKey} className="animate-page-enter">
          {currentNav.tab === 'home' && (
            <HomeView
              entries={entries}
              watchingEntries={watchingEntries}
              entriesLoading={entriesLoading}
              trending={trending}
              trendingLoading={trendingLoading}
              trendingError={trendingError}
              onRetryTrending={() => void loadTrending()}
              recommendations={recommendationsData.recommendations}
              recommendationsLoading={recommendationsLoading}
              recommendationsSource={recommendationsData.source}
              recommendationsError={recommendationsError}
              onRetryRecommendations={() => void loadRecommendations(true)}
              onOpenRecommendations={openRecommendations}
              onOpenDetails={openDetails}
              onOpenStatistics={openStatistics}
            />
          )}

          {currentNav.tab === 'library' && (
            <LibraryView
              entries={entries}
              loading={entriesLoading}
              searchQuery={librarySearchQuery}
              onClearSearch={() => {
                setLibrarySearchQuery('');
                setLibrarySearchOpen(false);
              }}
              onOpenDetails={openDetails}
              onGoSearch={() => navigateTopTab('search')}
            />
          )}

          {currentNav.tab === 'search' && (
            <SearchView
              trending={trending}
              entriesByKey={entriesByKey}
              onOpenDetails={openDetails}
              onQuickSetStatus={handleQuickStatus}
              onRemoveEntry={handleRemoveEntry}
            />
          )}

          {currentNav.tab === 'details' && currentNav.detailTarget && (
            <DetailsView
              mediaType={currentNav.detailTarget.mediaType}
              tmdbId={currentNav.detailTarget.tmdbId}
              existingEntry={
                entriesByKey[`${currentNav.detailTarget.tmdbId}_${currentNav.detailTarget.mediaType}`]
              }
              onSaveEntry={handleSaveEntry}
              onRemoveEntry={handleRemoveEntry}
            />
          )}

          {currentNav.tab === 'profile' && (
            <ProfileView
              user={user}
              entries={entries}
              loading={entriesLoading}
              theme={theme}
              tmdbConfigured={tmdbConfigured}
              onChangeTheme={setTheme}
              onSignOut={handleSignOut}
            />
          )}

          {currentNav.tab === 'statistics' && (
            <Statistics
              entries={entries}
              loading={entriesLoading}
              variant="full"
              onGoSearch={() => navigateTopTab('search')}
              onOpenDetails={openDetails}
            />
          )}

          {currentNav.tab === 'recommendations' && (
            <RecommendationsView
              recommendations={recommendationsData.recommendations}
              source={recommendationsData.source}
              topGenres={recommendationsData.topGenres}
              notice={recommendationsData.notice}
              loading={recommendationsLoading}
              error={recommendationsError}
              hasLibraryEntries={entries.length > 0}
              onRefresh={() => void loadRecommendations(true)}
              onOpenDetails={openDetails}
              onGoSearch={() => navigateTopTab('search')}
            />
          )}
        </div>
      </main>

      <FloatingBottomNav
        activeTab={currentNav.tab}
        quickAddOpen={quickAddOpen}
        onNavigate={navigateTopTab}
        onOpenQuickAdd={() => setQuickAddOpen((v) => !v)}
      />

      <QuickAddModal
        open={quickAddOpen}
        trending={trending}
        entriesByKey={entriesByKey}
        onClose={() => setQuickAddOpen(false)}
        onAddToWatchlist={(item) => handleQuickStatus(item, 'watchlist')}
        onOpenDetails={openDetails}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ReelistApp />
    </ErrorBoundary>
  );
}
