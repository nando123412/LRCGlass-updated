import React from 'react';
import { ExternalLink, Play, Disc3, Mic2 } from 'lucide-react';
import { Track } from '../types.ts';

interface TrackCardProps {
  track: Track;
  onSelectTrack: (track: Track) => void;
  onSelectArtist?: (artistId: string) => void;
  onSelectAlbum?: (albumId: string) => void;
}

export const TrackCard: React.FC<TrackCardProps> = ({
  track,
  onSelectTrack,
  onSelectArtist,
  onSelectAlbum,
}) => {
  return (
    <div
      onClick={() => onSelectTrack(track)}
      className="group relative flex flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-4 transition-all duration-200 hover:-translate-y-1 hover:border-[var(--border-focus)] hover:bg-[var(--surface-hover)] hover:shadow-xl cursor-pointer"
    >
      <div>
        {/* Cover Artwork & Artist Avatar Header */}
        <div className="relative mb-3.5 flex items-center gap-3">
          {/* Album Cover */}
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[#241218] shadow-md">
            {track.albumCover ? (
              <img
                src={track.albumCover}
                alt={track.album || track.title}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[var(--accent)]">
                <Disc3 className="h-8 w-8 opacity-60" />
              </div>
            )}
            {/* Play hover overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] text-[#180b0f] shadow-lg">
                <Play className="h-4 w-4 fill-current ml-0.5" />
              </div>
            </div>
          </div>

          {/* Artist Profile Picture */}
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-[var(--border)] bg-[#241218] shadow-sm -ml-4 mt-6 z-10">
            {track.artistPicture ? (
              <img
                src={track.artistPicture}
                alt={track.artist}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[var(--accent)] bg-[var(--surface)]">
                <Mic2 className="h-6 w-6 opacity-60" />
              </div>
            )}
          </div>

          {/* Compact Code Badge */}
          <div className="ml-auto text-right">
            <span className="text-[11px] font-mono text-[var(--foreground-muted)]/70">
              {track.code || `sp:t:${track.id}`}
            </span>
          </div>
        </div>

        {/* Title & Metadata */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <h4 className="font-bold text-base leading-snug text-[var(--foreground)] line-clamp-1 group-hover:text-[var(--accent)] transition-colors">
              {track.title}
            </h4>
            {track.explicit && (
              <span className="shrink-0 rounded px-1 py-0.2 text-[9px] font-extrabold uppercase bg-red-500/20 text-red-300 border border-red-500/30">
                E
              </span>
            )}
          </div>

          {/* Artist link */}
          <p
            onClick={(e) => {
              if (onSelectArtist && track.artists?.[0]?.id) {
                e.stopPropagation();
                onSelectArtist(track.artists[0].id);
              }
            }}
            className="text-sm font-semibold text-[var(--accent)] line-clamp-1 hover:underline cursor-pointer"
          >
            {track.artist}
          </p>

          {/* Album link */}
          <p
            onClick={(e) => {
              if (onSelectAlbum && track.albumId) {
                e.stopPropagation();
                onSelectAlbum(track.albumId);
              }
            }}
            className="text-xs text-[var(--foreground-muted)] line-clamp-1 hover:text-[var(--foreground)]"
          >
            {track.album}
          </p>
        </div>
      </div>

      {/* Footer Info & Spotify Link */}
      <div className="mt-4 pt-3 flex items-center justify-between border-t border-[var(--border)] text-xs text-[var(--foreground-muted)]">
        <div className="flex items-center gap-2 tabular-nums">
          <span>{track.durationFormatted}</span>
          {track.releaseDate && (
            <>
              <span aria-hidden="true">·</span>
              <span>{track.releaseDate.split('-')[0]}</span>
            </>
          )}
        </div>

        {track.spotifyUrl && (
          <a
            href={track.spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 font-medium text-[var(--foreground-muted)] hover:text-[#1DB954] transition-colors"
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
