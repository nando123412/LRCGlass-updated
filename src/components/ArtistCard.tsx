import React from 'react';
import { ExternalLink, Mic2 } from 'lucide-react';
import { Artist } from '../types.ts';

interface ArtistCardProps {
  artist: Artist;
  onSelectArtist: (artistId: string) => void;
}

export const ArtistCard: React.FC<ArtistCardProps> = ({ artist, onSelectArtist }) => {
  return (
    <div
      onClick={() => onSelectArtist(artist.id)}
      className="group relative flex flex-col items-center text-center rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-5 transition-all duration-200 hover:-translate-y-1 hover:border-[var(--border-focus)] hover:bg-[var(--surface-hover)] hover:shadow-xl cursor-pointer"
    >
      {/* Round Artist Avatar */}
      <div className="relative h-28 w-28 overflow-hidden rounded-full border-2 border-[var(--border)] bg-[#241218] shadow-lg mb-4 group-hover:border-[var(--accent)] transition-colors">
        {artist.profilePicture ? (
          <img
            src={artist.profilePicture}
            alt={artist.name}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--accent)]">
            <Mic2 className="h-10 w-10 opacity-60" />
          </div>
        )}
      </div>

      {/* Name */}
      <h4 className="font-extrabold text-lg text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors line-clamp-1">
        {artist.name}
      </h4>

      {/* Genres */}
      <p className="text-xs text-[var(--foreground-muted)] line-clamp-1 mt-1 capitalize">
        {artist.genres && artist.genres.length > 0 ? artist.genres.slice(0, 2).join(' · ') : 'Artist'}
      </p>

      {/* Spotify Link */}
      {artist.spotifyUrl && (
        <div className="mt-3">
          <a
            href={artist.spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--foreground-muted)] hover:text-[#1DB954] transition-colors"
          >
            <span>Spotify</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
};
