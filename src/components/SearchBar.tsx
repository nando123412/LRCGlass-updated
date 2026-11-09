import React from 'react';
import { Search, Loader2, X } from 'lucide-react';

export type SearchTab = 'all' | 'tracks' | 'albums' | 'artists';

interface SearchBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  activeTab: SearchTab;
  onTabChange: (tab: SearchTab) => void;
  isLoading: boolean;
  onClear: () => void;
  resultsCount: { tracks: number; albums: number; artists: number };
}

export const SearchBar: React.FC<SearchBarProps> = ({
  query,
  onQueryChange,
  activeTab,
  onTabChange,
  isLoading,
  onClear,
  resultsCount,
}) => {
  return (
    <div className="w-full space-y-4">
      {/* Search Input Box */}
      <div className="relative flex items-center w-full">
        <div className="absolute left-4.5 text-[var(--foreground-muted)] pointer-events-none">
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
          ) : (
            <Search className="h-5 w-5" />
          )}
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search songs, artists, albums with Spotify catalog..."
          className="w-full h-14 pl-12 pr-12 rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] text-base font-medium text-[var(--foreground)] placeholder:text-[var(--foreground-muted)]/60 focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 shadow-lg backdrop-blur-xl transition-all"
        />

        {query && (
          <button
            onClick={onClear}
            className="absolute right-4 p-1.5 rounded-lg text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
            aria-label="Clear search query"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Tabs Filter (All / Songs / Albums / Artists) */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        <button
          onClick={() => onTabChange('all')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'all'
              ? 'bg-[var(--accent)] text-[#180b0f] shadow-md shadow-[var(--accent)]/25'
              : 'border border-[var(--border)] bg-[var(--card-bg)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-focus)]'
          }`}
        >
          All Results
        </button>

        <button
          onClick={() => onTabChange('tracks')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'tracks'
              ? 'bg-[var(--accent)] text-[#180b0f] shadow-md shadow-[var(--accent)]/25'
              : 'border border-[var(--border)] bg-[var(--card-bg)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-focus)]'
          }`}
        >
          Songs {resultsCount.tracks > 0 ? `(${resultsCount.tracks})` : ''}
        </button>

        <button
          onClick={() => onTabChange('albums')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'albums'
              ? 'bg-[var(--accent)] text-[#180b0f] shadow-md shadow-[var(--accent)]/25'
              : 'border border-[var(--border)] bg-[var(--card-bg)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-focus)]'
          }`}
        >
          Albums {resultsCount.albums > 0 ? `(${resultsCount.albums})` : ''}
        </button>

        <button
          onClick={() => onTabChange('artists')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'artists'
              ? 'bg-[var(--accent)] text-[#180b0f] shadow-md shadow-[var(--accent)]/25'
              : 'border border-[var(--border)] bg-[var(--card-bg)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-focus)]'
          }`}
        >
          Artists {resultsCount.artists > 0 ? `(${resultsCount.artists})` : ''}
        </button>
      </div>
    </div>
  );
};
