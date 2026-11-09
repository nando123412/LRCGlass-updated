import React, { useState, useEffect, useCallback } from 'react';
import { TopBar } from './components/TopBar.tsx';
import { SearchBar, SearchTab } from './components/SearchBar.tsx';
import { TrackCard } from './components/TrackCard.tsx';
import { AlbumCard } from './components/AlbumCard.tsx';
import { ArtistCard } from './components/ArtistCard.tsx';
import { ArtistPage } from './components/ArtistPage.tsx';
import { AlbumPage } from './components/AlbumPage.tsx';
import { LyricsPlayer } from './components/LyricsPlayer.tsx';
import { CommunityLyricsView } from './components/CommunityLyricsView.tsx';
import { StatusView } from './components/StatusView.tsx';
import { Track, Album, Artist, ViewMode } from './types.ts';
import { Music, Disc3, Mic2, Compass, AlertCircle, ExternalLink } from 'lucide-react';

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [currentView, setCurrentView] = useState<ViewMode>('search');

  // Selected entities for dedicated view pages
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [searchResults, setSearchResults] = useState<{
    tracks: Track[];
    albums: Album[];
    artists: Artist[];
    totalTracks: number;
    totalAlbums: number;
    totalArtists: number;
  }>({
    tracks: [],
    albums: [],
    artists: [],
    totalTracks: 0,
    totalAlbums: 0,
    totalArtists: 0,
  });

  // Apply theme to HTML tag
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Perform search query to server backend
  const executeSearch = useCallback(async (q: string, tab: SearchTab) => {
    if (!q.trim()) {
      setSearchResults({
        tracks: [],
        albums: [],
        artists: [],
        totalTracks: 0,
        totalAlbums: 0,
        totalArtists: 0,
      });
      return;
    }

    setIsLoading(true);
    setSearchError(null);

    try {
      let typeParam = 'track,album,artist';
      if (tab === 'tracks') typeParam = 'track';
      else if (tab === 'albums') typeParam = 'album';
      else if (tab === 'artists') typeParam = 'artist';

      const url = `/api/spotify/search?q=${encodeURIComponent(q)}&type=${typeParam}&limit=18`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();

      setSearchResults({
        tracks: data.tracks || [],
        albums: data.albums || [],
        artists: data.artists || [],
        totalTracks: data.totalTracks || 0,
        totalAlbums: data.totalAlbums || 0,
        totalArtists: data.totalArtists || 0,
      });
    } catch (err: any) {
      console.error('Search error:', err);
      setSearchError('Search failed. Please try a different search term.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        executeSearch(searchQuery, activeTab);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery, activeTab, executeSearch]);

  // Initial featured search on first mount (Alex Warren / Ordinary as requested in prompt)
  useEffect(() => {
    executeSearch('Alex Warren Ordinary', 'all');
  }, [executeSearch]);

  // Navigation Handlers
  const handleSelectTrack = (track: Track) => {
    setSelectedTrack(track);
    setCurrentView('player');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectArtist = (artistId: string) => {
    setSelectedArtistId(artistId);
    setCurrentView('artist');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectAlbum = (albumId: string) => {
    setSelectedAlbumId(albumId);
    setCurrentView('album');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToSearch = () => {
    setCurrentView('search');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)] selection:bg-[var(--accent)]/30 selection:text-[var(--foreground)] transition-colors duration-200">
      {/* Top Bar Navigation */}
      <TopBar
        currentView={currentView}
        onNavigate={(view) => {
          setCurrentView(view);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Container */}
      <main
        className={`flex-1 w-full transition-all duration-300 ${
          currentView === 'artist'
            ? 'p-0 m-0 max-w-none'
            : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8'
        }`}
      >
        {/* VIEW: Search Catalog */}
        {currentView === 'search' && (
          <div className="space-y-8 pb-16">
            {/* Hero Kicker & Search Input */}
            <div className="space-y-4 max-w-3xl">
              <div className="space-y-1">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[var(--foreground)]">
                  Discover Music & <span className="text-[var(--accent)]">Synchronized Lyrics</span>
                </h1>
                <p className="text-sm sm:text-base text-[var(--foreground-muted)] font-medium">
                  Spotify-powered catalog discovery with Apple Music animated artwork, LRCLIB &amp; LRC.red syllable-timing, and community contributions.
                </p>
              </div>

              <SearchBar
                query={searchQuery}
                onQueryChange={setSearchQuery}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                isLoading={isLoading}
                onClear={() => setSearchQuery('')}
                resultsCount={{
                  tracks: searchResults.totalTracks,
                  albums: searchResults.totalAlbums,
                  artists: searchResults.totalArtists,
                }}
              />
            </div>

            {searchError && (
              <div className="flex items-center gap-2 rounded-xl bg-red-500/15 border border-red-500/30 p-4 text-xs text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{searchError}</span>
              </div>
            )}

            {/* Results Grid by Tab */}
            <div className="space-y-10">
              {/* Songs Section */}
              {(activeTab === 'all' || activeTab === 'tracks') && searchResults.tracks.length > 0 && (
                <section className="space-y-4">
                  <div className="flex items-center justify-between border-b border-[var(--border)] pb-2.5">
                    <div className="flex items-center gap-2">
                      <Music className="h-5 w-5 text-[var(--accent)]" />
                      <h2 className="text-lg font-bold text-[var(--foreground)]">
                        Songs
                      </h2>
                    </div>
                    <span className="text-xs text-[var(--foreground-muted)] font-mono">
                      {searchResults.tracks.length} results
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {searchResults.tracks.map((track, idx) => (
                      <TrackCard
                        key={`${track.id}-${idx}`}
                        track={track}
                        onSelectTrack={handleSelectTrack}
                        onSelectArtist={handleSelectArtist}
                        onSelectAlbum={handleSelectAlbum}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Artists Section */}
              {(activeTab === 'all' || activeTab === 'artists') && searchResults.artists.length > 0 && (
                <section className="space-y-4">
                  <div className="flex items-center justify-between border-b border-[var(--border)] pb-2.5">
                    <div className="flex items-center gap-2">
                      <Mic2 className="h-5 w-5 text-[var(--accent)]" />
                      <h2 className="text-lg font-bold text-[var(--foreground)]">
                        Artists
                      </h2>
                    </div>
                    <span className="text-xs text-[var(--foreground-muted)] font-mono">
                      {searchResults.artists.length} results
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {searchResults.artists.map((artist, idx) => (
                      <ArtistCard
                        key={`${artist.id}-${idx}`}
                        artist={artist}
                        onSelectArtist={handleSelectArtist}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Albums Section */}
              {(activeTab === 'all' || activeTab === 'albums') && searchResults.albums.length > 0 && (
                <section className="space-y-4">
                  <div className="flex items-center justify-between border-b border-[var(--border)] pb-2.5">
                    <div className="flex items-center gap-2">
                      <Disc3 className="h-5 w-5 text-[var(--accent)]" />
                      <h2 className="text-lg font-bold text-[var(--foreground)]">
                        Albums
                      </h2>
                    </div>
                    <span className="text-xs text-[var(--foreground-muted)] font-mono">
                      {searchResults.albums.length} results
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {searchResults.albums.map((album, idx) => (
                      <AlbumCard
                        key={`${album.id}-${idx}`}
                        album={album}
                        onSelectAlbum={handleSelectAlbum}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Empty state when no results found */}
              {!isLoading &&
                searchResults.tracks.length === 0 &&
                searchResults.albums.length === 0 &&
                searchResults.artists.length === 0 && (
                  <div className="py-16 text-center space-y-3 rounded-3xl border border-dashed border-[var(--border)] p-8">
                    <Compass className="h-10 w-10 text-[var(--accent)] mx-auto opacity-70" />
                    <h3 className="text-lg font-bold text-[var(--foreground)]">
                      No matching music found
                    </h3>
                    <p className="text-xs text-[var(--foreground-muted)] max-w-md mx-auto">
                      Try searching for an artist name, song title, or album. You can also explore popular queries like &quot;Alex Warren&quot;, &quot;Taylor Swift&quot;, or &quot;Billie Eilish&quot;.
                    </p>
                  </div>
                )}
            </div>
          </div>
        )}

        {/* VIEW: Artist Discography Page */}
        {currentView === 'artist' && selectedArtistId && (
          <ArtistPage
            artistId={selectedArtistId}
            onBack={handleBackToSearch}
            onSelectTrack={handleSelectTrack}
            onSelectAlbum={handleSelectAlbum}
          />
        )}

        {/* VIEW: Album Page */}
        {currentView === 'album' && selectedAlbumId && (
          <AlbumPage
            albumId={selectedAlbumId}
            onBack={handleBackToSearch}
            onSelectTrack={handleSelectTrack}
            onSelectArtist={handleSelectArtist}
          />
        )}

        {/* VIEW: Synchronized Lyrics Player Page */}
        {currentView === 'player' && selectedTrack && (
          <LyricsPlayer
            track={selectedTrack}
            onBack={handleBackToSearch}
            onSelectArtist={handleSelectArtist}
            onSelectAlbum={handleSelectAlbum}
          />
        )}

        {/* VIEW: Community Contributed Lyrics */}
        {currentView === 'community' && (
          <CommunityLyricsView onSelectTrack={handleSelectTrack} />
        )}

        {/* VIEW: System Status & Diagnostics */}
        {currentView === 'status' && <StatusView />}
      </main>

      {/* Footer & Mandatory Spotify Attribution */}
      <footer className="w-full border-t border-[var(--border)] bg-[var(--surface)] py-8 mt-auto text-xs text-[var(--foreground-muted)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[var(--foreground)]">LRCGlass</span>
            <span aria-hidden="true">·</span>
            <span>Music Discovery &amp; Synchronized Lyrics</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-[11px]">
            <a
              href="https://spotify.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-[#1DB954] transition-colors"
            >
              <span>Spotify API</span>
              <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href="https://headliner.nandoothjuuh.me"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-[var(--accent)] transition-colors"
            >
              <span>Headliner API</span>
              <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href="https://lrclib.net"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-[var(--accent)] transition-colors"
            >
              <span>LRCLIB</span>
              <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href="https://lrc.red"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-[var(--accent)] transition-colors"
            >
              <span>LRC.red</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
