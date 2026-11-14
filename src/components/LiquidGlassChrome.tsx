import React, { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { ActiveTab, UserProfile } from '../types/reelist';
import { LiquidGlass } from './ui/liquid-glass';
import {
  ChevronLeftIcon,
  CloseIcon,
  HomeIcon,
  LibraryIcon,
  PlusIcon,
  SearchIcon,
} from './Icons';

export const ACETERNITY_GLASS_SURFACE_CLASS =
  'shadow-[0_4px_20px_rgb(0_0_0/0.08),0_0_0_1px_rgb(0_0_0/0.04),inset_0_1px_0_rgb(255_255_255/0.6)] dark:shadow-[0_6px_22px_rgb(0_0_0/0.40),0_0_0_1px_rgb(255_255_255/0.08),inset_0_1px_0_rgb(255_255_255/0.22)]';

export const ACETERNITY_GLASS_CHROME_CLASS =
  'shadow-[0_6px_20px_rgb(0_0_0/0.10),0_0_0_1px_rgb(0_0_0/0.04),inset_0_1px_0_rgb(255_255_255/0.8)] dark:shadow-[0_8px_24px_rgb(0_0_0/0.45),0_0_0_1px_rgb(255_255_255/0.08),inset_0_1px_0_rgb(255_255_255/0.24)]';

interface TopBarProps {
  activeTab: ActiveTab;
  user: UserProfile;
  librarySearchQuery?: string;
  librarySearchOpen?: boolean;
  onLibrarySearchOpenChange?: (open: boolean) => void;
  onLibrarySearchChange?: (query: string) => void;
  onBack: () => void;
  onOpenProfile: () => void;
  onGoHome: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  user,
  librarySearchQuery = '',
  librarySearchOpen = false,
  onLibrarySearchOpenChange,
  onLibrarySearchChange,
  onBack,
  onOpenProfile,
  onGoHome,
}) => {
  const initial = (user.displayName || user.email || 'R').trim().charAt(0).toUpperCase() || 'R';
  const isHome = activeTab === 'home';
  const isProfile = activeTab === 'profile';
  const isLibrary = activeTab === 'library';
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isLibrary && librarySearchOpen) {
      const timer = window.setTimeout(() => {
        inputRef.current?.focus();
      }, 60);
      return () => window.clearTimeout(timer);
    }
  }, [isLibrary, librarySearchOpen]);

  const handleCloseSearch = () => {
    onLibrarySearchChange?.('');
    onLibrarySearchOpenChange?.(false);
  };

  return (
    <header
      className={`pointer-events-none z-40 ${
        isHome ? 'relative' : 'fixed top-0 right-0 left-0'
      }`}
    >
      <div className="mx-auto flex max-w-[1344px] items-center justify-between gap-2 px-4 pt-[max(0.85rem,env(safe-area-inset-top))] md:px-8 md:pt-6">
        {isHome ? (
          <button
            type="button"
            onClick={onGoHome}
            aria-label="SeenIt"
            className="tap-press pointer-events-auto inline-flex min-h-[44px] items-center rounded-lg text-left transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <span className="font-display text-[28px] leading-none font-bold tracking-[-0.03em] text-[var(--ink)] md:text-[34px]">
              Seen<span className="text-[var(--accent)]">It</span>
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className="tap-press pointer-events-auto inline-flex h-[44px] w-[44px] shrink-0 rounded-full text-[var(--ink)] transition-transform duration-200 hover:scale-[1.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <LiquidGlass
              radius={22}
              bevelDepth={12}
              scale={34}
              aberration={2}
              frost={0.5}
              tint={0.42}
              className={`size-full ${ACETERNITY_GLASS_SURFACE_CLASS}`}
              contentClassName="flex size-full items-center justify-center"
            >
              <ChevronLeftIcon size={20} />
            </LiquidGlass>
          </button>
        )}

        <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-2.5">
          {isLibrary && (
            <div className="pointer-events-auto flex items-center">
              {librarySearchOpen ? (
                <div className="animate-menu-down h-[48px] w-[min(238px,calc(100vw-134px))] sm:w-[270px] md:w-[320px]">
                  <LiquidGlass
                    radius={24}
                    bevelDepth={12}
                    scale={34}
                    aberration={2}
                    frost={0.5}
                    tint={0.48}
                    className={`size-full ${ACETERNITY_GLASS_SURFACE_CLASS}`}
                    contentClassName="flex size-full items-center gap-2 pr-1.5 pl-3.5"
                  >
                    <SearchIcon size={17} className="shrink-0 text-[var(--muted)]" />
                    <input
                      ref={inputRef}
                      type="text"
                      value={librarySearchQuery}
                      onChange={(e) => onLibrarySearchChange?.(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          handleCloseSearch();
                        }
                      }}
                      placeholder="Search library..."
                      aria-label="Search library titles"
                      className="min-w-0 flex-1 bg-transparent text-[14px] font-medium text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCloseSearch}
                      aria-label="Close library search"
                      className="tap-press inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                    >
                      <CloseIcon size={16} />
                    </button>
                  </LiquidGlass>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onLibrarySearchOpenChange?.(true)}
                  aria-label="Search library"
                  className="tap-press relative inline-flex h-[48px] w-[48px] shrink-0 rounded-full text-[var(--ink)] transition-transform duration-200 hover:scale-[1.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                >
                  <LiquidGlass
                    radius={24}
                    bevelDepth={12}
                    scale={34}
                    aberration={2}
                    frost={0.5}
                    tint={0.42}
                    className={`size-full ${ACETERNITY_GLASS_SURFACE_CLASS}`}
                    contentClassName="relative flex size-full items-center justify-center"
                  >
                    <SearchIcon size={19} />
                    {librarySearchQuery.trim().length > 0 && (
                      <span
                        aria-hidden="true"
                        className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-[var(--accent)]"
                      />
                    )}
                  </LiquidGlass>
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={onOpenProfile}
            aria-label="Open profile"
            aria-pressed={isProfile}
            className={`tap-press pointer-events-auto inline-flex h-[48px] w-[48px] shrink-0 rounded-full font-display text-[15px] font-semibold text-[var(--ink)] transition-transform duration-200 hover:scale-[1.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
              isProfile ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg)]' : ''
            }`}
          >
            <LiquidGlass
              radius={24}
              bevelDepth={12}
              scale={34}
              aberration={2}
              frost={0.5}
              tint={0.42}
              className={`size-full ${ACETERNITY_GLASS_SURFACE_CLASS}`}
              contentClassName="flex size-full items-center justify-center p-[4px]"
            >
              <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full">
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
              </span>
            </LiquidGlass>
          </button>
        </div>
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
  const reduceMotion = useReducedMotion();
  const navItems: { id: 'home' | 'library' | 'search'; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Home', icon: <HomeIcon size={19} /> },
    { id: 'library', label: 'Library', icon: <LibraryIcon size={19} /> },
    { id: 'search', label: 'Search', icon: <SearchIcon size={19} /> },
  ];

  return (
    <div className="pointer-events-none fixed right-0 bottom-[max(16px,env(safe-area-inset-bottom))] left-0 z-50 flex items-center justify-center gap-2.5 px-3 sm:bottom-[max(22px,env(safe-area-inset-bottom))] sm:gap-3 sm:px-4">
      <nav aria-label="Primary navigation" className="pointer-events-auto">
        <LiquidGlass
          radius={999}
          bevelDepth={10}
          scale={28}
          aberration={2}
          frost={0.5}
          tint={0.55}
          className={ACETERNITY_GLASS_CHROME_CLASS}
          contentClassName="flex items-center p-1"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`tap-press relative flex h-[48px] w-[74px] flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-semibold tracking-tight whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] sm:h-[52px] sm:w-[84px] sm:text-[11px] ${
                  isActive
                    ? 'text-[var(--ink)]'
                    : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="liquid-glass-tab"
                    data-testid="nav-sliding-pill"
                    className="absolute inset-0 rounded-full bg-neutral-900/[0.06] dark:bg-white/[0.12]"
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: 'spring', bounce: 0.2, duration: 0.4 }
                    }
                  />
                )}
                <span className="relative z-10">{item.icon}</span>
                <span className="relative z-10 leading-none">{item.label}</span>
              </button>
            );
          })}
        </LiquidGlass>
      </nav>

      <button
        type="button"
        onClick={onOpenQuickAdd}
        aria-label={quickAddOpen ? 'Close quick add' : 'Quick add movie or series'}
        aria-expanded={quickAddOpen}
        className={`tap-press pointer-events-auto inline-flex h-[56px] w-[56px] shrink-0 rounded-full transition-transform duration-200 hover:scale-[1.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] sm:h-[60px] sm:w-[60px] ${
          quickAddOpen ? 'text-[var(--accent)]' : 'text-[var(--ink)]'
        }`}
      >
        <LiquidGlass
          radius={30}
          bevelDepth={10}
          scale={28}
          aberration={2}
          frost={0.5}
          tint={0.55}
          className={`size-full ${ACETERNITY_GLASS_CHROME_CLASS}`}
          contentClassName="flex size-full items-center justify-center"
        >
          <PlusIcon
            size={23}
            className={`transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              quickAddOpen ? 'rotate-45 scale-110' : 'rotate-0'
            }`}
          />
        </LiquidGlass>
      </button>
    </div>
  );
};
