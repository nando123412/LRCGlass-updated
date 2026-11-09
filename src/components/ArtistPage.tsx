import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Play,
  Disc,
  Disc3,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { Artist, Track, Album } from '../types.ts';
import { blurFor, scrollProgress } from '../utils/backdrop-math.ts';

interface ArtistPageProps {
  artistId: string;
  onBack: () => void;
  onSelectTrack: (track: Track) => void;
  onSelectAlbum: (albumId: string) => void;
}

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

/**
 * Parses hex color strings (#rrggbb or #rgb) to RGB
 */
function parseHexColor(hex?: string): RgbColor | null {
  if (!hex || typeof hex !== 'string') return null;
  const clean = hex.replace('#', '').trim();
  if (clean.length === 6) {
    return {
      r: parseInt(clean.substring(0, 2), 16) || 24,
      g: parseInt(clean.substring(2, 4), 16) || 11,
      b: parseInt(clean.substring(4, 6), 16) || 15,
    };
  } else if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16) || 24,
      g: parseInt(clean[1] + clean[1], 16) || 11,
      b: parseInt(clean[2] + clean[2], 16) || 15,
    };
  }
  return null;
}

export const ArtistPage: React.FC<ArtistPageProps> = ({
  artistId,
  onBack,
  onSelectTrack,
  onSelectAlbum,
}) => {
  const [loading, setLoading] = useState(true);
  const [artist, setArtist] = useState<Artist | null>(null);
  const [popularTracks, setPopularTracks] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [singles, setSingles] = useState<Album[]>([]);
  const [compilations, setCompilations] = useState<Album[]>([]);
  const [allTracks, setAllTracks] = useState<Track[]>([]);
  const [headlinerData, setHeadlinerData] = useState<any>(null);

  // Failure tracking for visual header
  const [videoFailed, setVideoFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  // Dynamic sampled color from the bottom of the video/artwork
  const [bottomColor, setBottomColor] = useState<RgbColor>({ r: 24, g: 11, b: 15 });

  // Artwork quality feedback state
  const [imageFeedback, setImageFeedback] = useState<{ likes: number; dislikes: number }>({
    likes: 0,
    dislikes: 0,
  });
  const [userVoted, setUserVoted] = useState<'like' | 'dislike' | null>(null);

  // Video and canvas refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll transition values
  const [scrollY, setScrollY] = useState(0);

  // Sample the bottom rows of the media to adapt page colors
  const sampleBottomColor = useCallback((mediaEl: HTMLVideoElement | HTMLImageElement) => {
    try {
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }
      const canvas = canvasRef.current;
      canvas.width = 40;
      canvas.height = 40;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(mediaEl, 0, 0, 40, 40);
      // Sample bottom 6 rows (y = 34 to 39)
      const frame = ctx.getImageData(0, 34, 40, 6);
      const data = frame.data;
      let totalR = 0;
      let totalG = 0;
      let totalB = 0;
      let count = 0;

      for (let i = 0; i < data.length; i += 4) {
        totalR += data[i];
        totalG += data[i + 1];
        totalB += data[i + 2];
        count++;
      }

      if (count > 0) {
        const r = Math.round(totalR / count);
        const g = Math.round(totalG / count);
        const b = Math.round(totalB / count);
        // Avoid pure white washed out backgrounds; keep rich and deep
        const dampR = Math.min(65, Math.max(16, r));
        const dampG = Math.min(50, Math.max(8, g));
        const dampB = Math.min(55, Math.max(12, b));
        setBottomColor({ r: dampR, g: dampG, b: dampB });
      }
    } catch (e) {
      // Cross-origin restriction fallback: use headliner extracted dominantColor
      if (headlinerData?.dominantColor) {
        const parsed = parseHexColor(headlinerData.dominantColor);
        if (parsed) {
          setBottomColor({
            r: Math.min(65, Math.max(16, parsed.r)),
            g: Math.min(50, Math.max(8, parsed.g)),
            b: Math.min(55, Math.max(12, parsed.b)),
          });
        }
      }
    }
  }, [headlinerData]);

  // Load artist discography and headliner animated artwork
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setVideoFailed(false);
    setImageFailed(false);

    async function loadDiscography() {
      try {
        const res = await fetch(`/api/spotify/artist/${encodeURIComponent(artistId)}`);
        if (!res.ok) throw new Error('Failed to load artist');
        const data = await res.json();
        if (!isMounted) return;

        setArtist(data.artist);
        setPopularTracks(data.popularTracks || []);
        setAlbums(data.albums || []);
        setSingles(data.singles || []);
        setCompilations(data.compilations || []);
        setAllTracks(data.allTracks || []);
        setLoading(false);

        // Concurrently fetch Headliner animated header
        if (data.artist?.name) {
          fetchHeadliner(data.artist.name);
          fetchFeedback(data.artist.name, data.artist.profilePicture || '');
        }
      } catch (err) {
        console.error('Discography load error:', err);
        if (isMounted) setLoading(false);
      }
    }

    async function fetchHeadliner(name: string) {
      try {
        const hRes = await fetch(`/api/headliner/artist?name=${encodeURIComponent(name)}`);
        if (hRes.ok) {
          const hData = await hRes.json();
          if (isMounted) {
            setHeadlinerData(hData);
            if (hData.dominantColor) {
              const parsed = parseHexColor(hData.dominantColor);
              if (parsed) {
                setBottomColor({
                  r: Math.min(65, Math.max(16, parsed.r)),
                  g: Math.min(50, Math.max(8, parsed.g)),
                  b: Math.min(55, Math.max(12, parsed.b)),
                });
              }
            }
          }
        }
      } catch (err) {
        // Fallback gracefully
      }
    }

    async function fetchFeedback(name: string, url: string) {
      if (!url) return;
      try {
        const fRes = await fetch(
          `/api/feedback/image?artist=${encodeURIComponent(name)}&url=${encodeURIComponent(url)}`
        );
        if (fRes.ok) {
          const fData = await fRes.json();
          if (isMounted) setImageFeedback({ likes: fData.likes || 0, dislikes: fData.dislikes || 0 });
        }
      } catch (err) {
        // Ignore
      }
    }

    loadDiscography();

    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      isMounted = false;
      window.removeEventListener('scroll', handleScroll);
    };
  }, [artistId]);

  const handleVote = async (action: 'like' | 'dislike') => {
    if (!artist || userVoted) return;
    setUserVoted(action);
    const picUrl = artist.profilePicture || headlinerData?.staticArtwork || '';
    setImageFeedback((prev) => ({
      ...prev,
      likes: action === 'like' ? prev.likes + 1 : prev.likes,
      dislikes: action === 'dislike' ? prev.dislikes + 1 : prev.dislikes,
    }));

    try {
      await fetch('/api/feedback/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistName: artist.name,
          imageUrl: picUrl,
          action,
        }),
      });
    } catch (err) {
      console.warn('Feedback submit error:', err);
    }
  };

  // Scroll blur & dim calculation
  const progress = scrollProgress(scrollY, 420);
  const currentBlur = blurFor(progress, 26); // smooth blur from 0px up to 26px
  const currentShade = Math.min(0.96, 0.25 + progress * 0.7);

  if (loading && !artist) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
        <p className="text-sm text-[var(--foreground-muted)] font-medium">
          Discovering Spotify discography &amp; Apple Music assets...
        </p>
      </div>
    );
  }

  // Find best compatible MP4 (prioritizing H.264 for cross-browser playback)
  const headerVideo =
    (!videoFailed &&
      (headlinerData?.headerVideoMp4 ||
        headlinerData?.variants?.find((v: any) => v.codec === 'H.264' && v.mp4)?.mp4 ||
        headlinerData?.variants?.find((v: any) => v.is16x9 && v.mp4)?.mp4 ||
        headlinerData?.variants?.find((v: any) => v.mp4)?.mp4 ||
        (headlinerData?.headerVideo &&
        typeof headlinerData.headerVideo === 'string' &&
        headlinerData.headerVideo.endsWith('.mp4')
          ? headlinerData.headerVideo
          : null))) ||
    null;

  const logoUrl = headlinerData?.logoUrl;
  const fallbackImage = (!imageFailed && (artist?.profilePicture || headlinerData?.staticArtwork)) || null;
  const hasVisualHeader = Boolean(headerVideo || fallbackImage);

  return (
    <div ref={containerRef} className="relative w-full -mt-16 pb-24 overflow-x-hidden">
      {/* 
        TIGHT TOP HERO CONTAINER:
        Spans from the very top of the screen (top: 0), extending right under the navigation bar.
      */}
      <div className="relative w-full h-[64vh] min-h-[460px] max-h-[720px] overflow-hidden">
        {headerVideo ? (
          <video
            ref={(el) => {
              videoRef.current = el;
              if (el) {
                el.muted = true;
                el.defaultMuted = true;
                el.play().catch(() => {});
              }
            }}
            key={headerVideo}
            src={headerVideo}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            crossOrigin="anonymous"
            onLoadedData={(e) => sampleBottomColor(e.currentTarget)}
            onTimeUpdate={(e) => {
              // Periodically adapt color as video progresses
              if (Math.floor(e.currentTarget.currentTime) % 4 === 0) {
                sampleBottomColor(e.currentTarget);
              }
            }}
            onError={(e) => {
              // Try H.264 fallback if high-res variant failed
              const h264 = headlinerData?.variants?.find((v: any) => v.codec === 'H.264' && v.mp4)?.mp4;
              if (h264 && e.currentTarget.src !== h264) {
                e.currentTarget.src = h264;
                e.currentTarget.play().catch(() => {});
              } else {
                setVideoFailed(true);
              }
            }}
            style={{
              filter: `blur(${currentBlur}px)`,
              transform: `scale(${1 + progress * 0.05})`,
              transition: 'filter 0.2s ease, transform 0.2s ease',
            }}
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        ) : fallbackImage ? (
          <img
            src={fallbackImage}
            alt={artist?.name}
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            onLoad={(e) => sampleBottomColor(e.currentTarget)}
            onError={() => setImageFailed(true)}
            style={{
              filter: `blur(${currentBlur}px)`,
              transform: `scale(${1 + progress * 0.05})`,
              transition: 'filter 0.2s ease, transform 0.2s ease',
            }}
            className="absolute inset-0 h-full w-full object-cover object-top"
          />
        ) : (
          <div
            style={{
              background: `linear-gradient(135deg, rgb(${bottomColor.r + 20}, ${bottomColor.g + 10}, ${bottomColor.b + 15}) 0%, rgb(${bottomColor.r}, ${bottomColor.g}, ${bottomColor.b}) 100%)`,
            }}
            className="absolute inset-0"
          />
        )}

        {/* 
          ADAPTIVE BOTTOM GRADIENT:
          Smoothly transitions from video transparency into the exact color of the video bottom edge.
        */}
        <div
          style={{
            background: `linear-gradient(to bottom, transparent 0%, rgba(${bottomColor.r}, ${bottomColor.g}, ${bottomColor.b}, 0.4) 50%, rgba(${bottomColor.r}, ${bottomColor.g}, ${bottomColor.b}, ${currentShade}) 85%, rgb(${bottomColor.r}, ${bottomColor.g}, ${bottomColor.b}) 100%)`,
            transition: 'background 0.3s ease',
          }}
          className="absolute inset-0 pointer-events-none"
        />

        {/* Top Floating Action Controls (Back & Spotify Link) */}
        <div className="absolute top-20 left-6 right-6 z-30 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 rounded-xl bg-black/40 hover:bg-black/65 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-md border border-white/15 transition-all active:scale-95 shadow-lg"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>

          {artist?.spotifyUrl && (
            <a
              href={artist.spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl bg-[#1DB954]/25 hover:bg-[#1DB954]/40 px-4 py-2.5 text-xs font-bold text-white border border-[#1DB954]/45 backdrop-blur-md transition-all shadow-lg"
            >
              <span>Spotify Catalog</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        {/* 
          CENTERED ARTIST IDENTITY:
          The artist's name / logo is prominently centered horizontally and vertically in the hero.
        */}
        <div className="absolute inset-0 pt-14 flex flex-col items-center justify-center text-center px-4 sm:px-8 z-20 pointer-events-none">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={artist?.name}
              referrerPolicy="no-referrer"
              className="h-20 sm:h-28 md:h-36 lg:h-44 w-auto max-w-[85vw] sm:max-w-[550px] md:max-w-[650px] object-contain drop-shadow-[0_16px_36px_rgba(0,0,0,0.9)] filter pointer-events-auto transition-transform hover:scale-105 duration-300"
            />
          ) : (
            <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight text-white drop-shadow-[0_16px_40px_rgba(0,0,0,0.95)] uppercase select-none pointer-events-auto">
              {artist?.name}
            </h1>
          )}

          {/* Centered Meta Badges (genres & listeners) */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-4 text-xs sm:text-sm font-semibold text-white/90 drop-shadow-md pointer-events-auto">
            {artist?.genres && artist.genres.length > 0 && (
              <span className="bg-black/40 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20">
                {artist.genres.slice(0, 3).join(' · ')}
              </span>
            )}
            {artist?.followers && (
              <span className="bg-black/40 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20 tabular-nums">
                {artist.followers.toLocaleString()} monthly listeners
              </span>
            )}
          </div>
        </div>

        {/* 
          CONDITIONAL IMAGE QUALITY FEEDBACK:
          Strictly only displayed when the animated header and image BOTH fail to load.
        */}
        {!hasVisualHeader && (
          <div className="absolute bottom-6 right-6 z-30 flex items-center gap-3 bg-red-950/80 border border-red-500/30 backdrop-blur-md rounded-2xl p-2.5 text-xs text-white shadow-2xl">
            <div className="flex items-center gap-1.5 text-red-300 pl-2">
              <AlertTriangle className="h-4 w-4" />
              <span>Header artwork unavailable</span>
            </div>
            <div className="flex items-center gap-1.5 border-l border-white/20 pl-2">
              <button
                onClick={() => handleVote('like')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors ${
                  userVoted === 'like' ? 'bg-[var(--accent)] text-[#180b0f] font-bold' : 'hover:bg-white/10'
                }`}
                title="Helpful artwork match"
              >
                <ThumbsUp className="h-3.5 w-3.5" />
                <span>{imageFeedback.likes}</span>
              </button>
              <button
                onClick={() => handleVote('dislike')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors ${
                  userVoted === 'dislike' ? 'bg-red-500 text-white font-bold' : 'hover:bg-white/10'
                }`}
                title="Incorrect or missing artwork"
              >
                <ThumbsDown className="h-3.5 w-3.5" />
                <span>{imageFeedback.dislikes}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 
        MAIN CONTENT BODY:
        The background seamlessly adapts to the exact sampled color from the bottom of the video,
        flowing gently down into the base application theme.
      */}
      <div
        style={{
          background: `linear-gradient(to bottom, rgb(${bottomColor.r}, ${bottomColor.g}, ${bottomColor.b}) 0%, rgba(${bottomColor.r}, ${bottomColor.g}, ${bottomColor.b}, 0.6) 240px, var(--background) 600px)`,
          transition: 'background 0.3s ease',
        }}
        className="w-full pt-4"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          {/* Popular Tracks Section */}
          {popularTracks.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
                  Popular Tracks
                </h3>
                <span className="text-xs text-[var(--foreground-muted)]">
                  Click any song to open synchronized lyrics
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {popularTracks.slice(0, 8).map((t, index) => (
                  <div
                    key={t.id}
                    onClick={() => onSelectTrack(t)}
                    className="group flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-3 hover:bg-[var(--surface-hover)] hover:border-[var(--border-focus)] transition-all cursor-pointer backdrop-blur-md"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-5 text-center text-xs font-bold text-[var(--foreground-muted)] tabular-nums">
                        {index + 1}
                      </span>
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[#241218]">
                        {t.albumCover ? (
                          <img
                            src={t.albumCover}
                            alt={t.title}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Disc3 className="h-6 w-6 text-[var(--accent)] m-auto" />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="h-4 w-4 fill-white text-white ml-0.5" />
                        </div>
                      </div>

                      <div className="min-w-0">
                        <p className="font-bold text-sm text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors truncate">
                          {t.title}
                        </p>
                        <p className="text-xs text-[var(--foreground-muted)] truncate">
                          {t.album}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-xs text-[var(--foreground-muted)] tabular-nums">
                      <span>{t.durationFormatted}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Studio Albums Section */}
          {albums.length > 0 && (
            <section className="space-y-4">
              <h3 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
                Albums ({albums.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {albums.map((alb) => (
                  <div
                    key={alb.id}
                    onClick={() => onSelectAlbum(alb.id)}
                    className="group rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-3 hover:bg-[var(--surface-hover)] hover:border-[var(--border-focus)] transition-all cursor-pointer backdrop-blur-md"
                  >
                    <div className="aspect-square w-full rounded-xl overflow-hidden border border-[var(--border)] bg-[#241218] mb-2.5">
                      {alb.albumCover ? (
                        <img
                          src={alb.albumCover}
                          alt={alb.title}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <Disc className="h-8 w-8 text-[var(--accent)] m-auto" />
                      )}
                    </div>
                    <h4 className="font-bold text-xs text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors truncate">
                      {alb.title}
                    </h4>
                    <p className="text-[11px] text-[var(--foreground-muted)] mt-0.5">
                      {alb.releaseDate ? alb.releaseDate.split('-')[0] : 'Album'}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Singles & EPs Section */}
          {singles.length > 0 && (
            <section className="space-y-4">
              <h3 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
                Singles &amp; EPs ({singles.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {singles.slice(0, 12).map((s) => (
                  <div
                    key={s.id}
                    onClick={() => onSelectAlbum(s.id)}
                    className="group rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-3 hover:bg-[var(--surface-hover)] hover:border-[var(--border-focus)] transition-all cursor-pointer backdrop-blur-md"
                  >
                    <div className="aspect-square w-full rounded-xl overflow-hidden border border-[var(--border)] bg-[#241218] mb-2.5">
                      {s.albumCover ? (
                        <img
                          src={s.albumCover}
                          alt={s.title}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <Disc className="h-8 w-8 text-[var(--accent)] m-auto" />
                      )}
                    </div>
                    <h4 className="font-bold text-xs text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors truncate">
                      {s.title}
                    </h4>
                    <p className="text-[11px] text-[var(--foreground-muted)] mt-0.5">
                      {s.releaseDate ? s.releaseDate.split('-')[0] : 'Single'}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Complete Deduplicated Tracklist */}
          {allTracks.length > 0 && (
            <section className="space-y-4 pt-4 border-t border-[var(--border)]">
              <div>
                <h3 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
                  Complete Discovered Catalog ({allTracks.length} tracks)
                </h3>
                <p className="text-xs text-[var(--foreground-muted)] mt-0.5">
                  Deduplicated by Spotify catalog reference
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] overflow-hidden backdrop-blur-md">
                <div className="divide-y divide-[var(--border)]">
                  {allTracks.map((t, i) => (
                    <div
                      key={t.id}
                      onClick={() => onSelectTrack(t)}
                      className="flex items-center justify-between px-4 py-3 hover:bg-[var(--surface-hover)] transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 text-xs text-[var(--foreground-muted)] tabular-nums">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors truncate">
                            {t.title}
                          </p>
                          <p className="text-xs text-[var(--foreground-muted)] truncate">
                            {t.album}
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
                          aria-label={`Play lyrics for ${t.title}`}
                        >
                          <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
