import React, { useState } from 'react';
import { X, Check, AlertCircle, FileText, Upload } from 'lucide-react';
import { Track } from '../types.ts';
import { parseLyrics } from '../utils/lyrics-parser.ts';

interface ContributeLyricsModalProps {
  track: Track;
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

export const ContributeLyricsModal: React.FC<ContributeLyricsModalProps> = ({
  track,
  isOpen,
  onClose,
  onSubmitted,
}) => {
  const [format, setFormat] = useState<'lrc' | 'enhanced-lrc' | 'ttml' | 'plain'>('lrc');
  const [content, setContent] = useState('');
  const [contributor, setContributor] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleValidateAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!content.trim()) {
      setError('Please provide lyric content.');
      return;
    }

    // Validate parser
    const parsed = parseLyrics(content, format);
    if (parsed.lines.length === 0) {
      setError('Could not parse any valid lines from the provided lyrics text.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Submit to server API
      const res = await fetch('/api/lyrics/contribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackCode: track.code,
          trackTitle: track.title,
          artistName: track.artist,
          albumName: track.album,
          format,
          content: content.trim(),
          contributor: contributor.trim() || 'Anonymous Music Lover',
          hasWordSync: parsed.hasWordSync,
        }),
      });

      // 2. Also persist directly to Firebase Firestore
      try {
        const { addCommunityContribution } = await import('../lib/firebase.ts');
        await addCommunityContribution({
          trackCode: track.code,
          trackTitle: track.title,
          artistName: track.artist,
          albumName: track.album,
          format,
          content: content.trim(),
          contributor: contributor.trim() || 'Anonymous Music Lover',
          hasWordSync: parsed.hasWordSync,
        });
      } catch (fbErr) {
        console.warn('Firestore direct write warning:', fbErr);
      }

      if (!res.ok) throw new Error('Server returned an error');
      setSuccess(true);
      setTimeout(() => {
        onSubmitted();
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err?.message || 'Failed to submit lyrics');
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadSampleTemplate = (type: 'lrc' | 'enhanced-lrc' | 'ttml') => {
    setFormat(type);
    if (type === 'lrc') {
      setContent(`[ti:${track.title}]
[ar:${track.artist}]
[al:${track.album || ''}]
[00:04.00]First lyric line goes here
[00:08.50]Second lyric line goes here
[00:14.00]...
[00:18.00]Chorus starts here`);
    } else if (type === 'enhanced-lrc') {
      setContent(`[ti:${track.title}]
[ar:${track.artist}]
[00:05.00]<00:05.00>Word <00:05.80>level <00:06.50>karaoke <00:08.00>timing
[00:10.00]<00:10.00>Every <00:10.50>word <00:11.20>is <00:12.00>synchronized`);
    } else if (type === 'ttml') {
      setContent(`<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml">
  <body>
    <div>
      <p begin="00:04.00" end="00:09.00">
        <span begin="00:00.00" dur="00:01.20">Sing</span>
        <span begin="00:01.50" dur="00:02.00">synchronized</span>
      </p>
    </div>
  </body>
</tt>`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="relative w-full max-w-2xl rounded-3xl border border-[var(--border)] bg-[var(--background)] p-6 sm:p-8 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
          <div>
            <h3 className="text-xl font-bold text-[var(--foreground)]">Contribute Lyrics</h3>
            <p className="text-xs text-[var(--accent)] font-semibold mt-0.5">
              {track.title} — {track.artist}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {success ? (
          <div className="py-12 text-center space-y-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 mx-auto">
              <Check className="h-7 w-7" />
            </div>
            <h4 className="text-lg font-bold text-[var(--foreground)]">Lyrics Published!</h4>
            <p className="text-xs text-[var(--foreground-muted)]">
              Your contribution is now stored in the database with #1 priority.
            </p>
          </div>
        ) : (
          <form onSubmit={handleValidateAndSubmit} className="mt-5 space-y-4">
            {/* Format Selection Buttons */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--foreground-muted)] mb-2">
                Format
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['lrc', 'enhanced-lrc', 'ttml', 'plain'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => {
                      setFormat(fmt);
                      if (fmt !== 'plain' && !content) loadSampleTemplate(fmt as any);
                    }}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all ${
                      format === fmt
                        ? 'bg-[var(--accent)] text-[#180b0f] shadow-md shadow-[var(--accent)]/20'
                        : 'border border-[var(--border)] bg-[var(--card-bg)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Template loader presets */}
            <div className="flex items-center justify-between text-xs text-[var(--foreground-muted)]">
              <span>Enter lyrics text or timestamped code below:</span>
              <button
                type="button"
                onClick={() => loadSampleTemplate(format === 'plain' ? 'lrc' : (format as any))}
                className="text-[var(--accent)] font-semibold hover:underline"
              >
                Insert sample template
              </button>
            </div>

            {/* Content Textarea */}
            <div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="[00:12.34] Your lyric lines..."
                rows={9}
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-4 font-mono text-xs text-[var(--foreground)] placeholder:text-[var(--foreground-muted)]/50 focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>

            {/* Contributor Name Input */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--foreground-muted)] mb-1">
                Your Name / Handle (Optional)
              </label>
              <input
                type="text"
                value={contributor}
                onChange={(e) => setContributor(e.target.value)}
                placeholder="e.g. Alex M. or LRCGlass Enthusiast"
                className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] text-xs font-medium text-[var(--foreground)] placeholder:text-[var(--foreground-muted)]/50 focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-red-500/15 border border-red-500/30 p-3 text-xs text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[#180b0f] text-xs font-bold hover:brightness-110 active:scale-95 shadow-lg shadow-[var(--accent)]/20 transition-all disabled:opacity-50"
              >
                {isSubmitting ? 'Validating & Publishing...' : 'Submit Contribution'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
