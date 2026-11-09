import React from 'react';
import { Sun, Moon, Music2 } from 'lucide-react';
import { ViewMode } from '../types.ts';

interface TopBarProps {
  currentView: ViewMode;
  onNavigate: (view: ViewMode) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentView,
  onNavigate,
  theme,
  onToggleTheme,
}) => {
  return (
    <header
      className={`sticky top-0 z-50 w-full transition-colors duration-300 ${
        currentView === 'artist'
          ? 'bg-black/20 backdrop-blur-md border-b border-white/10'
          : 'border-b border-[var(--border)] bg-[var(--surface)] backdrop-blur-xl'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Brand wordmark (single line element) */}
        <button
          onClick={() => onNavigate('search')}
          className="flex items-center gap-2.5 text-left group transition-transform active:scale-95"
          aria-label="LRCGlass Home"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#e49c98] to-[#9c4d5b] text-white shadow-md shadow-[#e49c98]/20">
            <Music2 className="h-5 w-5" />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-[var(--foreground)] whitespace-nowrap shrink-0">
            LRCGlass
          </span>
        </button>

        {/* Zone 2: 4-5 concise single-line nav links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-semibold">
          <button
            onClick={() => onNavigate('search')}
            className={`transition-colors whitespace-nowrap shrink-0 hover:text-[var(--accent)] ${
              currentView === 'search' ? 'text-[var(--accent)]' : 'text-[var(--foreground-muted)]'
            }`}
          >
            Search
          </button>
          <button
            onClick={() => onNavigate('community')}
            className={`transition-colors whitespace-nowrap shrink-0 hover:text-[var(--accent)] ${
              currentView === 'community' ? 'text-[var(--accent)]' : 'text-[var(--foreground-muted)]'
            }`}
          >
            Community Lyrics
          </button>
          <button
            onClick={() => onNavigate('status')}
            className={`transition-colors whitespace-nowrap shrink-0 hover:text-[var(--accent)] ${
              currentView === 'status' ? 'text-[var(--accent)]' : 'text-[var(--foreground-muted)]'
            }`}
          >
            System Status
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onToggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all active:scale-95"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
