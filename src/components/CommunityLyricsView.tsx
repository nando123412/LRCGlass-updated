import React, { useEffect, useState } from 'react';
import { Sparkles, ThumbsUp, Calendar, User, FileCode, Play, Loader2 } from 'lucide-react';
import { CommunityContribution, Track } from '../types.ts';

import { subscribeCommunityContributions } from '../lib/firebase.ts';

interface CommunityLyricsViewProps {
  onSelectTrack: (track: Track) => void;
}

export const CommunityLyricsView: React.FC<CommunityLyricsViewProps> = ({ onSelectTrack }) => {
  const [contributions, setContributions] = useState<CommunityContribution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Initial fetch from API
    fetch('/api/lyrics/community')
      .then((res) => (res.ok ? res.json() : []))
      .then((list) => {
        setContributions((prev) => (prev.length === 0 ? list : prev));
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // 2. Real-time live Firestore subscription
    let unsub: (() => void) | undefined;
    try {
      unsub = subscribeCommunityContributions((liveList) => {
        if (liveList.length > 0) {
          setContributions(liveList);
        }
        setLoading(false);
      });
    } catch (e) {
      console.warn('Firestore subscription fallback:', e);
    }

    return () => {
      if (unsub) unsub();
    };
  }, []);

  return (
    <div className="w-full space-y-6 pb-16">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <h2 className="text-2xl font-black text-[var(--foreground)]">
            Community Contributed Lyrics
          </h2>
        </div>
        <p className="text-sm text-[var(--foreground-muted)]">
          LRCGlass community-contributed lyrics have <strong className="text-[var(--accent)] font-bold">#1 priority</strong> over all external music providers.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-[var(--accent)]" />
          <p className="text-xs text-[var(--foreground-muted)]">Loading community database...</p>
        </div>
      ) : contributions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-12 text-center space-y-2">
          <p className="font-bold text-[var(--foreground)]">No community contributions yet.</p>
          <p className="text-xs text-[var(--foreground-muted)]">
            Search for any song and click &quot;Contribute Lyrics&quot; to add your own synchronized lyrics.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {contributions.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-5 hover:border-[var(--border-focus)] transition-all space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-bold text-lg text-[var(--foreground)] leading-snug">
                    {c.trackTitle}
                  </h4>
                  <p className="text-sm font-semibold text-[var(--accent)]">{c.artistName}</p>
                  {c.albumName && (
                    <p className="text-xs text-[var(--foreground-muted)]">{c.albumName}</p>
                  )}
                </div>

                <span className="shrink-0 rounded-lg bg-[var(--accent)]/15 border border-[var(--accent)]/30 px-2.5 py-1 text-[11px] font-mono font-bold uppercase text-[var(--accent)]">
                  {c.format}
                </span>
              </div>

              {/* Snippet preview */}
              <div className="rounded-xl bg-[#14080c] p-3 font-mono text-[11px] text-[var(--foreground-muted)] line-clamp-3 leading-relaxed border border-[var(--border)]">
                {c.content}
              </div>

              {/* Metadata footer */}
              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--foreground-muted)]">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-[var(--accent)]" />
                    <span>{c.contributor}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ThumbsUp className="h-3 w-3" />
                    <span>{c.votes}</span>
                  </div>
                </div>

                <button
                  onClick={() =>
                    onSelectTrack({
                      id: c.trackCode.replace('sp:t:', ''),
                      code: c.trackCode,
                      title: c.trackTitle,
                      artist: c.artistName,
                      album: c.albumName || '',
                      albumCover: '',
                      durationMs: 180000,
                      durationFormatted: '3:00',
                      explicit: false,
                      spotifyUrl: '',
                    })
                  }
                  className="flex items-center gap-1 rounded-lg bg-[var(--accent)] text-[#180b0f] px-3 py-1.5 font-bold text-xs hover:brightness-110 active:scale-95 transition-all"
                >
                  <Play className="h-3 w-3 fill-current ml-0.5" />
                  <span>Open Lyrics</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
