import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Database, Music, Video, Sparkles, Loader2 } from 'lucide-react';

export const StatusView: React.FC = () => {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStatus() {
      try {
        const res = await fetch('/api/status');
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
        }
      } catch (err) {
        console.error('Failed to load status:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStatus();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-[var(--accent)]" />
        <p className="text-xs text-[var(--foreground-muted)]">Checking system integrations...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-16">
      <div className="space-y-1">
        <h2 className="text-2xl font-black text-[var(--foreground)]">System Diagnostics & Integrations</h2>
        <p className="text-sm text-[var(--foreground-muted)]">
          Real-time status of connected music providers, APIs, and the compact database.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Spotify Web API Integration */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1DB954]/20 text-[#1DB954]">
                <Music className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-[var(--foreground)]">Spotify Web API</h4>
                <p className="text-xs text-[var(--foreground-muted)]">Primary Music Catalog</p>
              </div>
            </div>
            {status?.spotifyConfigured ? (
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> Connected
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-bold text-amber-400">
                <AlertTriangle className="h-4 w-4" /> Public Fallback Active
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--foreground-muted)] leading-relaxed">
            {status?.spotifyConfigured
              ? 'OAuth 2.0 Client Credentials active. Discovering artists, albums, discographies, and real profile photos.'
              : 'SPOTIFY_CLIENT_ID & SPOTIFY_CLIENT_SECRET not configured in .env. Falling back seamlessly to public metadata services.'}
          </p>
        </div>

        {/* Headliner Animated Artwork */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)]/20 text-[var(--accent)]">
                <Video className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-[var(--foreground)]">Headliner API</h4>
                <p className="text-xs text-[var(--foreground-muted)]">Animated Headers & Covers</p>
              </div>
            </div>
            <span className="flex items-center gap-1 text-xs font-bold text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Active
            </span>
          </div>
          <p className="text-xs text-[var(--foreground-muted)] font-mono truncate">
            {status?.headlinerBaseUrl}
          </p>
          <p className="text-xs text-[var(--foreground-muted)] leading-relaxed">
            Provides Apple Music 16:9 animated video headers, artist logos, and square animated album artwork.
          </p>
        </div>

        {/* Lyrics Discovery Hierarchy */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-[var(--foreground)]">Lyrics Priority Pipeline</h4>
              <p className="text-xs text-[var(--foreground-muted)]">Multi-Tier Resolution</p>
            </div>
          </div>
          <ol className="text-xs space-y-1.5 text-[var(--foreground-muted)] pt-1">
            <li className="font-bold text-emerald-400">1. LRCGlass Community Contributions (Highest)</li>
            <li className="font-semibold text-[var(--foreground)]">2. LRCLIB (Direct signature & duration match)</li>
            <li className="font-semibold text-[var(--foreground)]">3. LRC.red (ISRC lookup & TTML Syllable sync)</li>
            <li className="text-[var(--foreground-muted)]">4. Authorized Genius Discovery Links</li>
          </ol>
        </div>

        {/* Compact Database & Cache */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-[var(--foreground)]">Compact Database Store</h4>
                <p className="text-xs text-[var(--foreground-muted)]">sp:t: / sp:a: / sp:ar:</p>
              </div>
            </div>
            <span className="flex items-center gap-1 text-xs font-bold text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Operational
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-[var(--foreground-muted)] pt-1">
            <div className="p-2.5 rounded-xl bg-[#14080c] border border-[var(--border)]">
              <span className="font-bold text-base text-[var(--foreground)] block tabular-nums">
                {status?.totalEntitiesStored || 0}
              </span>
              <span>Saved Entities</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#14080c] border border-[var(--border)]">
              <span className="font-bold text-base text-[var(--foreground)] block tabular-nums">
                {status?.communityContributions || 0}
              </span>
              <span>Community Lyrics</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
