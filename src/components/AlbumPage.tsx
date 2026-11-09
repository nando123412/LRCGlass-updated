import React, { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, Play, Disc, Loader2, Sparkles } from 'lucide-react';
import { Album, Track } from '../types.ts';

interface AlbumPageProps {
  albumId: string;
  onBack: () => void;
  onSelectTrack: (track: Track) => void;
  onSelectArtist?: (artistId: string) => void;
}

export const AlbumPage: React.FC<AlbumPageProps> = ({
  albumId,
  onBack,
  onSelectTrack,
  onSelectArtist,
}) => {
  const [loading, setLoading] = useState(true);
  const [album, setAlbum] = useState<Album | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [headlinerAlbum, setHeadlinerAlbum] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    async function loadAlbum() {
      try {
        const res = await fetch(`/api/spotify/album/${encodeURIComponent(albumId)}`);
        if (!res.ok) throw new Error('Failed to load album');
        const data = await res.json();
        if (!isMounted) return;

        setAlbum(data.album);
        setTracks(data.tracks || []);
        setLoading(false);

        // Fetch animated artwork from Headliner
        if (data.album?.title) {
          fetchHeadliner(data.album.title, data.album.artist);
        }
      } catch (err) {
        console.error('Album load error:', err);
        if (isMounted) setLoading(false);
      }
    }

    async function fetchHeadliner(title: string, artist: string) {
      try {
        const hRes = await fetch(
          `/api/headliner/album?album=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist || '')}`
        );
        if (hRes.ok) {
          const hData = await hRes.json();
          if (isMounted) setHeadlinerAlbum(hData);
        }
      } catch (err) {
        // Fallback
      }
    }

    loadAlbum();

    return () => {
      isMounted = false;
    };
  }, [albumId]);

  if (loading && !album) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
        <p className="text-sm text-[var(--foreground-muted)] font-medium">Loading album details...</p>
      </div>
    );
  }

  const animatedMp4 = headlinerAlbum?.animatedVideoMp4;

  return (
    <div className="w-full space-y-8 pb-16">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] px-3.5 py-2 text-xs font-bold text-[var(--foreground)] hover:border-[var(--accent)] transition-all active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>

        {album?.spotifyUrl && (
          <a
            href={album.spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-xl border border-[#1DB954]/40 bg-[#1DB954]/15 px-3.5 py-2 text-xs font-bold text-[#1DB954] hover:bg-[#1DB954]/25 transition-all"
          >
            <span>Spotify Album</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {/* Album Header Details */}
      <div className="flex flex-col md:flex-row items-center md:items-end gap-6 sm:gap-8 rounded-3xl border border-[var(--border)] bg-[var(--card-bg)] p-6 sm:p-8 backdrop-blur-xl">
        {/* Cover Artwork (Square) with Animated Video or Static Cover */}
        <div className="relative aspect-square w-48 sm:w-60 md:w-68 shrink-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[#241218] shadow-2xl">
          {animatedMp4 ? (
            <video
              src={animatedMp4}
              autoPlay
              loop
              muted
              playsInline
              className="h-full w-full object-cover"
            />
          ) : album?.albumCover ? (
            <img
              src={album.albumCover}
              alt={album.title}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[var(--accent)]">
              <Disc className="h-16 w-16 opacity-60" />
            </div>
          )}

          {animatedMp4 && (
            <div className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-lg bg-black/60 px-2 py-0.5 text-[10px] font-bold text-[#e49c98] backdrop-blur-md">
              <Sparkles className="h-3 w-3" />
              Animated
            </div>
          )}
        </div>

        {/* Text Info */}
        <div className="space-y-3 text-center md:text-left min-w-0">
          <div className="inline-block rounded-md bg-[var(--accent)]/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[var(--accent)]">
            {album?.albumType || 'Album'}
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[var(--foreground)] line-clamp-2">
            {album?.title}
          </h1>

          <p
            onClick={() => {
              if (onSelectArtist && album?.artists?.[0]?.id) {
                onSelectArtist(album.artists[0].id);
              }
            }}
            className="text-base sm:text-lg font-bold text-[var(--accent)] hover:underline cursor-pointer"
          >
            {album?.artist}
          </p>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs text-[var(--foreground-muted)]">
            <span>{album?.releaseDate ? album.releaseDate.split('-')[0] : ''}</span>
            <span aria-hidden="true">·</span>
            <span>{album?.totalTracks} {album?.totalTracks === 1 ? 'song' : 'songs'}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{album?.code}</span>
          </div>
        </div>
      </div>

      {/* Tracklist Table */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
          Tracks
        </h3>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] overflow-hidden">
          <div className="divide-y divide-[var(--border)]">
            {tracks.map((t, idx) => (
              <div
                key={t.id}
                onClick={() => onSelectTrack(t)}
                className="flex items-center justify-between px-4 sm:px-6 py-3.5 hover:bg-[var(--surface-hover)] transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <span className="w-6 text-center text-xs font-bold text-[var(--foreground-muted)] tabular-nums">
                    {idx + 1}
                  </span>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors truncate">
                        {t.title}
                      </p>
                      {t.explicit && (
                        <span className="shrink-0 rounded px-1 py-0.2 text-[9px] font-extrabold uppercase bg-red-500/20 text-red-300 border border-red-500/30">
                          E
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--foreground-muted)] truncate">
                      {t.artist}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 text-xs text-[var(--foreground-muted)] tabular-nums">
                  <span>{t.durationFormatted}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTrack(t);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)]/15 text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[#180b0f] transition-all"
                    aria-label={`Open synchronized lyrics for ${t.title}`}
                  >
                    <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
