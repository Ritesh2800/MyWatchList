import React from 'react';
import type { ActiveTab, UserProfile } from '../types/reelist';
import { ChevronLeftIcon, HomeIcon, LibraryIcon, PlusIcon, SearchIcon } from './Icons';

export const GlassSvgFilter: React.FC = () => (
  <svg
    aria-hidden="true"
    width="0"
    height="0"
    className="pointer-events-none fixed h-0 w-0 opacity-0"
  >
    <defs>
      <filter id="glass-distortion" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.015 0.015"
          numOctaves="2"
          seed="4"
          result="noise"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="noise"
          scale="7"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </defs>
  </svg>
);

interface TopBarProps {
  activeTab: ActiveTab;
  user: UserProfile;
  onBack: () => void;
  onOpenProfile: () => void;
  onGoHome: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  user,
  onBack,
  onOpenProfile,
  onGoHome,
}) => {
  const initial = (user.displayName || user.email || 'R').trim().charAt(0).toUpperCase() || 'R';
  const isHome = activeTab === 'home';
  const isProfile = activeTab === 'profile';

  return (
    <header className="pointer-events-none fixed top-0 right-0 left-0 z-40">
      <div className="mx-auto flex max-w-[1344px] items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] md:px-8 md:pt-6">
        {isHome ? (
          <button
            type="button"
            onClick={onGoHome}
            className="tap-press pointer-events-auto inline-flex min-h-[44px] items-center rounded-full px-1 text-left transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <span className="font-display text-[24px] font-bold tracking-[-0.02em] text-[var(--ink)] md:text-[26px]">
              MyWatchList
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className="glass glass-refract tap-press pointer-events-auto inline-flex h-[44px] w-[44px] items-center justify-center text-[var(--ink)] transition-all duration-200 hover:scale-[1.07] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <ChevronLeftIcon size={20} />
          </button>
        )}

        <button
          type="button"
          onClick={onOpenProfile}
          aria-label="Open profile"
          aria-pressed={isProfile}
          className={`glass glass-refract tap-press pointer-events-auto inline-flex h-[44px] w-[44px] items-center justify-center overflow-hidden font-display text-[15px] font-semibold text-[var(--ink)] transition-all duration-200 hover:scale-[1.07] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
            isProfile ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg)]' : ''
          }`}
        >
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
        </button>
      </div>
    </header>
  );
};

interface FloatingNavProps {
  activeTab: ActiveTab;
  quickAddOpen?: boolean;
  onNavigate: (tab: 'home' | 'library' | 'search') => void;
  onOpenQuickAdd: () => void;
}

export const FloatingBottomNav: React.FC<FloatingNavProps> = ({
  activeTab,
  quickAddOpen = false,
  onNavigate,
  onOpenQuickAdd,
}) => {
  const navItems: { id: 'home' | 'library' | 'search'; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Home', icon: <HomeIcon size={20} /> },
    { id: 'library', label: 'Library', icon: <LibraryIcon size={20} /> },
    { id: 'search', label: 'Search', icon: <SearchIcon size={20} /> },
  ];

  const activeIdx = navItems.findIndex((item) => item.id === activeTab);

  return (
    <div className="pointer-events-none fixed right-0 bottom-[max(22px,env(safe-area-inset-bottom))] left-0 z-50 flex items-center justify-center gap-3 px-4">
      <nav
        aria-label="Primary navigation"
        className="glass glass-refract pointer-events-auto relative flex items-center p-[6px]"
      >
        {/* Sliding glass pill indicator */}
        <span
          aria-hidden="true"
          data-testid="nav-sliding-pill"
          className="glass-active pointer-events-none absolute top-[6px] left-[6px] h-[52px] w-[84px] rounded-full transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            transform: activeIdx >= 0 ? `translateX(${activeIdx * 84}px)` : 'translateX(0px) scale(0.9)',
            opacity: activeIdx >= 0 ? 1 : 0,
          }}
        />

        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`tap-press group relative z-10 flex h-[52px] w-[84px] flex-col items-center justify-center gap-1 rounded-full whitespace-nowrap transition-[color,opacity] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                isActive
                  ? 'text-[var(--ink)] opacity-100'
                  : 'text-[var(--ink)] opacity-70 hover:opacity-100'
              }`}
            >
              <span
                className={`transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isActive ? 'scale-105 -translate-y-[1px]' : 'group-hover:scale-105'
                }`}
              >
                {item.icon}
              </span>
              <span className="text-[11px] leading-none font-semibold">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={onOpenQuickAdd}
        aria-label={quickAddOpen ? 'Close quick add' : 'Quick add movie or series'}
        aria-expanded={quickAddOpen}
        className={`glass glass-refract tap-press pointer-events-auto inline-flex h-[64px] w-[64px] shrink-0 items-center justify-center transition-all duration-200 hover:scale-[1.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
          quickAddOpen
            ? 'border-[var(--accent)]/60 bg-[var(--accent)]/20 text-[var(--accent)]'
            : 'text-[var(--ink)]'
        }`}
      >
        <PlusIcon
          size={24}
          className={`transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            quickAddOpen ? 'rotate-45 scale-110' : 'rotate-0'
          }`}
        />
      </button>
    </div>
  );
};
