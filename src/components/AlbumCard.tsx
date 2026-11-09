import React from 'react';
import { ExternalLink, Disc } from 'lucide-react';
import { Album } from '../types.ts';

interface AlbumCardProps {
  album: Album;
  onSelectAlbum: (albumId: string) => void;
}

export const AlbumCard: React.FC<AlbumCardProps> = ({ album, onSelectAlbum }) => {
  return (
    <div
      onClick={() => onSelectAlbum(album.id)}
      className="group relative flex flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-4 transition-all duration-200 hover:-translate-y-1 hover:border-[var(--border-focus)] hover:bg-[var(--surface-hover)] hover:shadow-xl cursor-pointer"
    >
      <div>
        {/* Album Artwork */}
        <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[#241218] shadow-md mb-3.5">
          {album.albumCover ? (
            <img
              src={album.albumCover}
              alt={album.title}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[var(--accent)]">
              <Disc className="h-12 w-12 opacity-60" />
            </div>
          )}
        </div>

        {/* Title & Artist */}
        <h4 className="font-bold text-base leading-snug text-[var(--foreground)] line-clamp-1 group-hover:text-[var(--accent)] transition-colors">
          {album.title}
        </h4>
        <p className="text-sm font-medium text-[var(--foreground-muted)] line-clamp-1 mt-0.5">
          {album.artist}
        </p>
      </div>

      {/* Footer Info */}
      <div className="mt-4 pt-3 flex items-center justify-between border-t border-[var(--border)] text-xs text-[var(--foreground-muted)]">
        <div className="flex items-center gap-1.5 capitalize">
          <span>{album.releaseDate ? album.releaseDate.split('-')[0] : album.albumType}</span>
          <span aria-hidden="true">·</span>
          <span>{album.totalTracks} {album.totalTracks === 1 ? 'track' : 'tracks'}</span>
        </div>

        {album.spotifyUrl && (
          <a
            href={album.spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 font-medium hover:text-[#1DB954] transition-colors"
            title="Open on Spotify"
          >
            <span className="text-[11px]">Spotify</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
};
