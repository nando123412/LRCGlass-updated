import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  ArrowLeft,
  ExternalLink,
  PlusCircle,
  Disc3,
  Loader2,
  Sparkles,
  Volume2,
  VolumeX,
  Volume1,
  Maximize2,
  Minimize2,
  Music,
  Radio,
  Upload,
  Link as LinkIcon,
  Check,
  AlertCircle,
  FileCode,
  Wand2,
} from 'lucide-react';
import { Track, LyricsData, TrackAudio } from '../types.ts';
import {
  parseLyrics,
  ParsedLyrics,
  getActiveLineIndex,
  formatTime,
  LyricLine,
  LyricWord,
} from '../utils/lyrics-parser.ts';
import { generateTestAudioBlob } from '../utils/audio-helper.ts';
import {
  subscribeTrackAudios,
  saveTrackAudio,
  subscribeCommunityContributions,
} from '../lib/firebase.ts';
import { ContributeLyricsModal } from './ContributeLyricsModal.tsx';

interface LyricsPlayerProps {
  track: Track;
  onBack: () => void;
  onSelectArtist?: (artistId: string) => void;
  onSelectAlbum?: (albumId: string) => void;
}

export const LyricsPlayer: React.FC<LyricsPlayerProps> = ({
  track,
  onBack,
  onSelectArtist,
  onSelectAlbum,
}) => {
  // Lyrics state
  const [lyricsData, setLyricsData] = useState<LyricsData | null>(null);
  const [parsed, setParsed] = useState<ParsedLyrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [formatMode, setFormatMode] = useState<'synced' | 'raw'>('synced');

  // Master Clock & Audio Playback State
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Audio Source State
  const [activeAudioUrl, setActiveAudioUrl] = useState<string | null>(null);
  const [audioSourceTitle, setAudioSourceTitle] = useState<string | null>(null);
  const [isAudioLoaded, setIsAudioLoaded] = useState(false);
  const [audioDurationSec, setAudioDurationSec] = useState<number>(0);
  const [communityAudios, setCommunityAudios] = useState<TrackAudio[]>([]);
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);

  // Add Audio Modal inputs
  const [inputAudioUrl, setInputAudioUrl] = useState('');
  const [audioUploaderName, setAudioUploaderName] = useState('');
  const [isSavingAudio, setIsSavingAudio] = useState(false);
  const [audioSaveSuccess, setAudioSaveSuccess] = useState(false);
  const [audioInputError, setAudioInputError] = useState<string | null>(null);

  // Contribute modal
  const [isContributeModalOpen, setIsContributeModalOpen] = useState(false);

  // DOM Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const linesContainerRef = useRef<HTMLDivElement>(null);
  const lineElementsRef = useRef<(HTMLDivElement | null)[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  const totalDurationMs =
    audioDurationSec > 0
      ? audioDurationSec * 1000
      : track.durationMs || (parsed?.durationMs ? parsed.durationMs + 4000 : 180000);

  // 1. Fetch Lyrics via priority API (Community -> LRCLIB -> LRC.red -> Genius)
  const fetchLyrics = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL('/api/lyrics', window.location.origin);
      url.searchParams.set('title', track.title);
      url.searchParams.set('artist', track.artist);
      if (track.album) url.searchParams.set('album', track.album);
      if (track.durationMs) url.searchParams.set('duration', String(track.durationMs));
      if (track.code) url.searchParams.set('trackCode', track.code);
      if (track.isrc) url.searchParams.set('isrc', track.isrc);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error('Lyrics discovery failed');
      const data: LyricsData = await res.json();
      setLyricsData(data);

      if (data.content) {
        const p = parseLyrics(data.content, data.format);
        setParsed(p);
      } else {
        setParsed(null);
      }
    } catch (err) {
      console.error('Error fetching lyrics:', err);
    } finally {
      setLoading(false);
    }
  }, [track]);

  useEffect(() => {
    fetchLyrics();
    setCurrentTimeMs(0);
    setIsPlaying(false);
    setActiveAudioUrl(null);
    setAudioSourceTitle(null);
    setIsAudioLoaded(false);
  }, [track.id, fetchLyrics]);

  // 2. Real-time Firebase Sync for Track Audios
  useEffect(() => {
    const unsub = subscribeTrackAudios(track.code, (audios) => {
      setCommunityAudios(audios);
      // Auto-load first audio if user hasn't selected one
      if (audios.length > 0 && !activeAudioUrl) {
        const first = audios[0];
        setActiveAudioUrl(first.audioUrl);
        setAudioSourceTitle(first.trackTitle || `Community Audio (${first.addedBy || 'Verified'})`);
      }
    });

    return () => unsub();
  }, [track.code, activeAudioUrl]);

  // 3. Audio Element Sync & Authoritative Clock
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = isMuted ? 0 : volume;
    audio.playbackRate = playbackRate;
  }, [volume, isMuted, playbackRate]);

  // High-precision Animation Frame clock for word-level sync
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    let lastTick = performance.now();

    const loop = (now: number) => {
      const audio = audioRef.current;

      if (audio && !audio.paused && !audio.ended && isAudioLoaded) {
        // True authoritative hardware audio clock
        setCurrentTimeMs(Math.round(audio.currentTime * 1000));
      } else if (!isAudioLoaded) {
        // Virtual fallback clock
        const delta = (now - lastTick) * playbackRate;
        lastTick = now;
        setCurrentTimeMs((prev) => {
          const next = prev + delta;
          if (next >= totalDurationMs) {
            setIsPlaying(false);
            return totalDurationMs;
          }
          return next;
        });
      }

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, isAudioLoaded, playbackRate, totalDurationMs]);

  // Active line index
  const activeLineIndex = parsed ? getActiveLineIndex(parsed.lines, currentTimeMs) : -1;

  // Auto-scroll active line into optical center (Apple Music style)
  useEffect(() => {
    if (activeLineIndex >= 0 && lineElementsRef.current[activeLineIndex]) {
      const el = lineElementsRef.current[activeLineIndex];
      el?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLineIndex]);

  // Play / Pause Toggle
  const togglePlayPause = async () => {
    const audio = audioRef.current;

    if (isPlaying) {
      if (audio && !audio.paused) {
        audio.pause();
      }
      setIsPlaying(false);
    } else {
      if (audio && activeAudioUrl) {
        try {
          await audio.play();
          setIsPlaying(true);
        } catch (err) {
          console.warn('Audio play failed, falling back to virtual clock:', err);
          setIsPlaying(true);
        }
      } else {
        setIsPlaying(true);
      }
    }
  };

  // Seek handler
  const handleSeek = (newMs: number) => {
    const clampedMs = Math.max(0, Math.min(totalDurationMs, newMs));
    setCurrentTimeMs(clampedMs);

    const audio = audioRef.current;
    if (audio && isAudioLoaded) {
      audio.currentTime = clampedMs / 1000;
    }
  };

  const handleLineClick = (line: LyricLine) => {
    handleSeek(line.startMs);
  };

  // Add Audio Handlers
  const handleUrlAudioSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAudioInputError(null);

    const trimmedUrl = inputAudioUrl.trim();
    if (!trimmedUrl) {
      setAudioInputError('Please enter a valid audio stream URL.');
      return;
    }

    setIsSavingAudio(true);
    try {
      // Set audio in player
      setActiveAudioUrl(trimmedUrl);
      setAudioSourceTitle(`Stream: ${trimmedUrl.slice(0, 32)}...`);
      setIsAudioLoaded(true);

      // Save to Firebase Firestore collection
      await saveTrackAudio({
        trackCode: track.code,
        trackTitle: track.title,
        artistName: track.artist,
        audioUrl: trimmedUrl,
        audioType: 'audio/mpeg',
        addedBy: audioUploaderName.trim() || 'Music Lover',
      });

      setAudioSaveSuccess(true);
      setTimeout(() => {
        setIsAudioModalOpen(false);
        setAudioSaveSuccess(false);
        setInputAudioUrl('');
      }, 1200);
    } catch (err: any) {
      console.error('Save audio error:', err);
      // Still allow playing current session even if Firestore write had error
      setIsAudioModalOpen(false);
    } finally {
      setIsSavingAudio(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const objUrl = URL.createObjectURL(file);
      setActiveAudioUrl(objUrl);
      setAudioSourceTitle(`Local: ${file.name}`);
      setIsAudioLoaded(true);
      setIsAudioModalOpen(false);
      // Reset input
      e.target.value = '';
    } catch (err) {
      setAudioInputError('Could not read the selected audio file.');
    }
  };

  const handleSynthesizeDemoAudio = () => {
    try {
      const blobUrl = generateTestAudioBlob(180);
      setActiveAudioUrl(blobUrl);
      setAudioSourceTitle('Synthesized Acoustic Melody (Live Preview)');
      setIsAudioLoaded(true);
      setIsAudioModalOpen(false);
    } catch (err) {
      console.warn('Synthesis error:', err);
    }
  };

  const selectCommunityAudio = (audio: TrackAudio) => {
    setActiveAudioUrl(audio.audioUrl);
    setAudioSourceTitle(audio.trackTitle || `Community Audio (${audio.addedBy || 'Verified'})`);
    setIsAudioLoaded(true);
    setIsAudioModalOpen(false);
  };

  return (
    <div
      className={`relative w-full flex flex-col justify-between transition-all duration-500 ${
        isFullscreen
          ? 'fixed inset-0 z-50 bg-[#12080b] p-6 sm:p-10 overflow-hidden'
          : 'min-h-[84vh] pb-12'
      }`}
    >
      {/* Dynamic Ambient Apple Music Fluid Gradient Orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10 select-none">
        <div
          className="apple-music-orb absolute top-[-10%] left-[15%] w-[45vw] h-[45vw] max-w-[650px] max-h-[650px] rounded-full opacity-30 blur-[90px] mix-blend-screen"
          style={{ background: 'radial-gradient(circle, #e49c98 0%, #b84d5f 60%, transparent 100%)' }}
        />
        <div
          className="apple-music-orb absolute bottom-[5%] right-[10%] w-[50vw] h-[50vw] max-w-[700px] max-h-[700px] rounded-full opacity-25 blur-[100px] mix-blend-screen"
          style={{ background: 'radial-gradient(circle, #7a233b 0%, #2f1019 70%, transparent 100%)' }}
        />
        <div
          className="absolute inset-0 bg-[var(--background)]/75 backdrop-blur-[24px]"
        />
      </div>

      {/* Hidden Native HTML5 Audio Element */}
      {activeAudioUrl && (
        <audio
          ref={audioRef}
          src={activeAudioUrl}
          preload="auto"
          onLoadedMetadata={(e) => {
            const dur = e.currentTarget.duration;
            if (dur && isFinite(dur)) {
              setAudioDurationSec(dur);
            }
            setIsAudioLoaded(true);
          }}
          onEnded={() => {
            setIsPlaying(false);
            setCurrentTimeMs(totalDurationMs);
          }}
          onError={() => {
            console.warn('Audio playback error, falling back to simulated playback clock.');
            setIsAudioLoaded(false);
          }}
        />
      )}

      {/* Top Header / Back / Source Badge / Audio Badge */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <button
            onClick={isFullscreen ? () => setIsFullscreen(false) : onBack}
            className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] px-3.5 py-2 text-xs font-bold text-[var(--foreground)] hover:border-[var(--accent)] transition-all active:scale-95 backdrop-blur-md"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Back'}</span>
          </button>

          {/* Audio Source Status Badge */}
          <button
            onClick={() => setIsAudioModalOpen(true)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all active:scale-95 ${
              activeAudioUrl
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                : 'border-[var(--border)] bg-[var(--card-bg)] text-[var(--foreground-muted)] hover:text-[var(--accent)] hover:border-[var(--accent)]'
            }`}
            title="Manage audio track for playback"
          >
            {activeAudioUrl ? (
              <Radio className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
            ) : (
              <Music className="h-3.5 w-3.5 text-[var(--accent)]" />
            )}
            <span>{activeAudioUrl ? 'Audio Linked' : '+ Add Audio'}</span>
          </button>
        </div>

        {/* Source Badge with Priority Attribution & Format Selector */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {lyricsData?.format === 'ttml' && (
            <span className="flex items-center gap-1 rounded-full bg-[#e49c98]/20 text-[#e49c98] border border-[#e49c98]/30 px-3 py-1 font-bold">
              <Sparkles className="h-3 w-3" />
              TTML Syllable-Sync
            </span>
          )}

          {lyricsData?.format === 'enhanced-lrc' && (
            <span className="flex items-center gap-1 rounded-full bg-[#1DB954]/20 text-[#1DB954] border border-[#1DB954]/30 px-3 py-1 font-bold">
              <Sparkles className="h-3 w-3" />
              Word-for-Word Sync
            </span>
          )}

          {lyricsData?.source === 'community' && (
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 font-bold">
              <span>{lyricsData.sourceLabel}</span>
            </div>
          )}

          {lyricsData?.source === 'lrclib' && (
            <a
              href="https://lrclib.net"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30 px-3 py-1 font-bold hover:bg-[var(--accent)]/25 transition-colors"
            >
              <span>{lyricsData.sourceLabel}</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}

          {lyricsData?.source === 'lrc.red' && (
            <a
              href={lyricsData.sourceUrl || 'https://lrc.red'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full bg-[#fa2d48]/20 text-[#ff6b7e] border border-[#fa2d48]/35 px-3 py-1 font-bold hover:bg-[#fa2d48]/30 transition-colors"
            >
              <span>{lyricsData.sourceLabel}</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}

          <button
            onClick={() => setFormatMode(formatMode === 'synced' ? 'raw' : 'synced')}
            className="flex items-center gap-1 rounded-full bg-[var(--card-bg)] border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] px-2.5 py-1 text-[11px] font-mono"
            title="Toggle between lyrics player and raw timed markup"
          >
            <FileCode className="h-3 w-3" />
            <span>{formatMode === 'synced' ? 'View Code' : 'View Player'}</span>
          </button>

          <button
            onClick={() => setIsContributeModalOpen(true)}
            className="flex items-center gap-1.5 rounded-full bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--foreground)] px-3 py-1 font-bold hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Contribute</span>
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Track Mini Lockup & Audio Track Banner */}
      <div className="my-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[#241218] shadow-xl">
            {track.albumCover ? (
              <img
                src={track.albumCover}
                alt={track.title}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            ) : (
              <Disc3 className="h-9 w-9 text-[var(--accent)] m-auto" />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl sm:text-3xl font-black text-[var(--foreground)] tracking-tight truncate">
              {track.title}
            </h2>
            <p
              onClick={() => {
                if (onSelectArtist && track.artists?.[0]?.id) {
                  onSelectArtist(track.artists[0].id);
                }
              }}
              className="text-sm font-bold text-[var(--accent)] hover:underline cursor-pointer truncate"
            >
              {track.artist}
            </p>
            <p
              onClick={() => {
                if (onSelectAlbum && track.albumId) {
                  onSelectAlbum(track.albumId);
                }
              }}
              className="text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)] cursor-pointer truncate"
            >
              {track.album}
            </p>
          </div>
        </div>

        {/* Audio Status Banner / Fast Add Button */}
        <div className="flex items-center gap-3 bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl px-4 py-2.5 backdrop-blur-md">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--foreground-muted)]">
              Playback Audio
            </p>
            <p className="text-xs font-semibold text-[var(--foreground)] truncate max-w-[200px] sm:max-w-[240px]">
              {audioSourceTitle || 'No audio file linked'}
            </p>
          </div>
          <button
            onClick={() => setIsAudioModalOpen(true)}
            className="shrink-0 px-3 py-1.5 rounded-xl bg-[var(--accent)]/15 hover:bg-[var(--accent)] text-[var(--accent)] hover:text-[#180b0f] font-bold text-xs transition-all active:scale-95"
          >
            {activeAudioUrl ? 'Change' : 'Add Audio'}
          </button>
        </div>
      </div>

      {/* RAW Code Display Mode */}
      {formatMode === 'raw' && lyricsData && (
        <div className="my-6 rounded-2xl border border-[var(--border)] bg-[#100609] p-4 sm:p-6 font-mono text-xs text-[var(--foreground)] overflow-x-auto max-h-[55vh]">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] text-[var(--foreground-muted)]">
            <span className="font-bold text-[var(--accent)] uppercase">{lyricsData.format} Timed Document</span>
            <span>{lyricsData.sourceLabel}</span>
          </div>
          <pre className="pt-4 whitespace-pre-wrap leading-relaxed">{lyricsData.content}</pre>
        </div>
      )}

      {/* Main Lyrics Display Window (Apple Music Aesthetic) */}
      {formatMode === 'synced' && (
        <div
          ref={linesContainerRef}
          className={`relative my-4 flex-1 overflow-y-auto no-scrollbar py-28 px-3 sm:px-8 space-y-8 sm:space-y-10 text-center sm:text-left transition-all ${
            isFullscreen ? 'max-h-[70vh]' : 'max-h-[55vh] min-h-[380px]'
          }`}
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
              <p className="text-sm text-[var(--foreground-muted)]">
                Fetching synchronized lyrics from LRCGlass, LRCLIB &amp; LRC.red...
              </p>
            </div>
          ) : !parsed || parsed.lines.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-72 text-center space-y-4 rounded-3xl border border-dashed border-[var(--border)] p-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
                <Disc3 className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-[var(--foreground)]">Lyrics are not available yet.</h3>
                <p className="text-sm text-[var(--foreground-muted)]">
                  Be the first to contribute synchronized lyrics for this song!
                </p>
              </div>
              <button
                onClick={() => setIsContributeModalOpen(true)}
                className="px-6 py-2.5 rounded-xl bg-[var(--accent)] text-[#180b0f] font-bold text-xs hover:brightness-110 active:scale-95 shadow-lg shadow-[var(--accent)]/20 transition-all"
              >
                Contribute Lyrics
              </button>
            </div>
          ) : (
            /* Synchronized Lyrics Render Loop (Apple Music Style) */
            parsed.lines.map((line, idx) => {
              const isActive = idx === activeLineIndex;
              const isPast = idx < activeLineIndex;

              return (
                <div
                  key={line.id}
                  ref={(el) => {
                    lineElementsRef.current[idx] = el;
                  }}
                  onClick={() => handleLineClick(line)}
                  className={`group transition-all duration-300 cursor-pointer select-none ${
                    isActive
                      ? 'opacity-100 scale-[1.03] transform'
                      : isPast
                      ? 'opacity-35 hover:opacity-75 blur-[0.6px] hover:blur-none'
                      : 'opacity-40 hover:opacity-80 blur-[0.6px] hover:blur-none'
                  }`}
                >
                  {line.isInstrumental ? (
                    /* Instrumental dots with breathing pulse animation */
                    <div className="flex items-center justify-center sm:justify-start gap-2.5 py-4">
                      <span className="h-3.5 w-3.5 rounded-full bg-[var(--accent)] instrumental-dot-1 shadow-lg shadow-[var(--accent)]/40" />
                      <span className="h-3.5 w-3.5 rounded-full bg-[var(--accent)] instrumental-dot-2 shadow-lg shadow-[var(--accent)]/40" />
                      <span className="h-3.5 w-3.5 rounded-full bg-[var(--accent)] instrumental-dot-3 shadow-lg shadow-[var(--accent)]/40" />
                    </div>
                  ) : line.words && line.words.length > 0 ? (
                    /* Word-for-Word Syllable Synchronized Line (Apple Music karaoke) */
                    <p className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight sm:leading-snug">
                      {line.words.map((word, wIdx) => {
                        const isWordActive = currentTimeMs >= word.startMs && currentTimeMs < word.endMs;
                        const isWordPast = currentTimeMs >= word.endMs;

                        return (
                          <span
                            key={`${line.id}-w-${wIdx}`}
                            className={`inline-block mr-2.5 transition-all duration-150 ${
                              isWordActive
                                ? word.isSustained
                                  ? 'text-[var(--accent)] lyric-sustained-wave scale-105 drop-shadow-[0_0_16px_var(--accent)]'
                                  : 'text-white brightness-150 drop-shadow-[0_0_12px_rgba(255,255,255,0.8)] scale-[1.03]'
                                : isWordPast
                                ? 'text-white/95'
                                : 'text-white/35 group-hover:text-white/60'
                            }`}
                          >
                            {word.text}
                          </span>
                        );
                      })}
                    </p>
                  ) : (
                    /* Standard Line-level synced lyric */
                    <p
                      className={`text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight sm:leading-snug transition-all duration-300 ${
                        isActive
                          ? 'text-white drop-shadow-[0_0_20px_rgba(228,156,152,0.45)]'
                          : 'text-[var(--foreground-muted)]'
                      }`}
                    >
                      {line.text}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Authoritative Music Player Controls Bar (Apple Music Aesthetic) */}
      <div className="sticky bottom-4 z-40 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-2xl backdrop-blur-2xl">
        {/* Scrubber Progress Bar */}
        <div className="space-y-1.5 mb-3">
          <input
            type="range"
            min={0}
            max={totalDurationMs}
            value={currentTimeMs}
            onChange={(e) => handleSeek(Number(e.target.value))}
            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-[var(--border)] accent-[var(--accent)]"
            aria-label="Seek track playback time"
          />
          <div className="flex items-center justify-between text-xs font-mono text-[var(--foreground-muted)]">
            <span>{formatTime(currentTimeMs)}</span>
            <div className="flex items-center gap-2">
              {activeAudioUrl && (
                <span className="text-[10px] uppercase font-bold text-emerald-400">Audio Sync</span>
              )}
              <span>{formatTime(totalDurationMs)}</span>
            </div>
          </div>
        </div>

        {/* Playback Controls Bar */}
        <div className="flex items-center justify-between gap-2">
          {/* Left: Quick seek buttons & Volume Slider */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => handleSeek(currentTimeMs - 5000)}
              className="p-2 rounded-xl text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
              title="Rewind 5 seconds"
              aria-label="Rewind 5 seconds"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleSeek(currentTimeMs + 5000)}
              className="p-2 rounded-xl text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
              title="Forward 5 seconds"
              aria-label="Forward 5 seconds"
            >
              <RotateCw className="h-4 w-4" />
            </button>

            {/* Volume control */}
            <div className="hidden sm:flex items-center gap-2 pl-2">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-4 w-4" />
                ) : volume < 0.5 ? (
                  <Volume1 className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setVolume(Number(e.target.value));
                  if (isMuted) setIsMuted(false);
                }}
                className="w-16 h-1 rounded-lg appearance-none cursor-pointer bg-[var(--border)] accent-[var(--accent)]"
                aria-label="Volume slider"
              />
            </div>
          </div>

          {/* Center: Big Play / Pause Button */}
          <button
            onClick={togglePlayPause}
            className="flex h-13 w-13 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-[var(--accent)] text-[#180b0f] shadow-lg shadow-[var(--accent)]/35 hover:scale-105 active:scale-95 transition-all"
            aria-label={isPlaying ? 'Pause playback' : 'Start playback'}
          >
            {isPlaying ? (
              <Pause className="h-6 w-6 fill-current" />
            ) : (
              <Play className="h-6 w-6 fill-current ml-1" />
            )}
          </button>

          {/* Right: Playback Speed Toggle & Audio Manager Trigger */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const rates = [0.75, 1, 1.25, 1.5];
                const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
                setPlaybackRate(rates[nextIdx]);
              }}
              className="px-2.5 py-1 rounded-xl border border-[var(--border)] text-xs font-mono font-bold text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-all"
              title="Change playback speed"
            >
              {playbackRate}x
            </button>

            <button
              onClick={() => setIsAudioModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] text-xs font-bold text-[var(--foreground)] hover:border-[var(--accent)] transition-all"
              title="Add or link an audio source for playback"
            >
              <Music className="h-3.5 w-3.5 text-[var(--accent)]" />
              <span className="hidden md:inline">Audio</span>
            </button>
          </div>
        </div>
      </div>

      {/* MODAL: Add / Link Audio for Playback */}
      {isAudioModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-xl rounded-3xl border border-[var(--border)] bg-[var(--background)] p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div>
                <h3 className="text-xl font-bold text-[var(--foreground)]">Audio Playback Source</h3>
                <p className="text-xs text-[var(--accent)] font-semibold mt-0.5">
                  {track.title} — {track.artist}
                </p>
              </div>
              <button
                onClick={() => setIsAudioModalOpen(false)}
                className="p-1.5 rounded-lg text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
              >
                ✕
              </button>
            </div>

            {audioSaveSuccess && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs">
                <Check className="h-4 w-4" />
                <span>Audio link saved successfully to Firebase Firestore!</span>
              </div>
            )}

            {audioInputError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs">
                <AlertCircle className="h-4 w-4" />
                <span>{audioInputError}</span>
              </div>
            )}

            {/* Option 1: URL Stream */}
            <form onSubmit={handleUrlAudioSubmit} className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--foreground-muted)]">
                Option 1: Paste Audio URL / Stream
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <LinkIcon className="absolute left-3 top-3 h-4 w-4 text-[var(--foreground-muted)]" />
                  <input
                    type="url"
                    value={inputAudioUrl}
                    onChange={(e) => setInputAudioUrl(e.target.value)}
                    placeholder="https://example.com/audio.mp3"
                    className="w-full h-11 pl-9 pr-3.5 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] text-xs text-[var(--foreground)] placeholder:text-[var(--foreground-muted)]/50 focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSavingAudio || !inputAudioUrl.trim()}
                  className="px-4 py-2.5 rounded-xl bg-[var(--accent)] text-[#180b0f] text-xs font-bold hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all shrink-0"
                >
                  {isSavingAudio ? 'Saving...' : 'Link & Play'}
                </button>
              </div>
              <input
                type="text"
                value={audioUploaderName}
                onChange={(e) => setAudioUploaderName(e.target.value)}
                placeholder="Your name or handle (for attribution)"
                className="w-full h-10 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] text-xs text-[var(--foreground)] placeholder:text-[var(--foreground-muted)]/50 focus:outline-none focus:border-[var(--accent)]"
              />
            </form>

            {/* Option 2: Upload local file */}
            <div className="space-y-2 pt-2 border-t border-[var(--border)]">
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--foreground-muted)]">
                Option 2: Play from Local File (Device)
              </label>
              <label className="flex items-center justify-center gap-2 w-full p-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card-bg)] hover:border-[var(--accent)] cursor-pointer transition-all">
                <Upload className="h-4 w-4 text-[var(--accent)]" />
                <span className="text-xs font-bold text-[var(--foreground)]">
                  Choose MP3, M4A, WAV or FLAC File
                </span>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Option 3: Instant Test Tone Synthesis */}
            <div className="space-y-2 pt-2 border-t border-[var(--border)]">
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--foreground-muted)]">
                Option 3: Quick Test Acoustic Tone
              </label>
              <button
                type="button"
                onClick={handleSynthesizeDemoAudio}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] hover:bg-[var(--surface-hover)] text-xs font-bold text-[var(--accent)] transition-all"
              >
                <Wand2 className="h-4 w-4" />
                <span>Synthesize Melodic Acoustic Preview (Instant Audio)</span>
              </button>
            </div>

            {/* Option 4: Community Saved Audios from Firestore */}
            {communityAudios.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--foreground-muted)]">
                  Community Sources for This Song ({communityAudios.length})
                </label>
                <div className="space-y-2 max-h-36 overflow-y-auto">
                  {communityAudios.map((aud) => (
                    <div
                      key={aud.id}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-semibold text-[var(--foreground)] truncate">
                          {aud.audioUrl}
                        </p>
                        <p className="text-[10px] text-[var(--foreground-muted)]">
                          Added by {aud.addedBy || 'Community'}
                        </p>
                      </div>
                      <button
                        onClick={() => selectCommunityAudio(aud)}
                        className="px-3 py-1 rounded-lg bg-[var(--accent)] text-[#180b0f] font-bold text-xs hover:brightness-110 active:scale-95 shrink-0"
                      >
                        Select
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsAudioModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contribute Lyrics Modal */}
      <ContributeLyricsModal
        track={track}
        isOpen={isContributeModalOpen}
        onClose={() => setIsContributeModalOpen(false)}
        onSubmitted={fetchLyrics}
      />
    </div>
  );
};
