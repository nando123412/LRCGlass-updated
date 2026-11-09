import dotenv from 'dotenv';
import { db } from './db.ts';

dotenv.config();

const LRCLIB_USER_AGENT = process.env.LRCLIB_APP_ID || 'LRCGlass/1.0.0 (https://lrcglass.app)';
const GENIUS_ACCESS_TOKEN = process.env.GENIUS_ACCESS_TOKEN || '';

export interface LyricsResponse {
  trackTitle: string;
  artistName: string;
  source: 'community' | 'lrclib' | 'lrc.red' | 'genius' | 'none';
  sourceLabel: string;
  sourceUrl?: string;
  format: 'plain' | 'lrc' | 'enhanced-lrc' | 'ttml';
  content: string;
  hasWordSync: boolean;
  hasLineSync: boolean;
  contributor?: string;
  version?: number;
  isInstrumental?: boolean;
}

/**
 * Normalizes title string for accurate matching (strips (Remastered), (feat. ...), etc.)
 */
function normalizeTitle(t: string): string {
  return (t || '')
    .toLowerCase()
    .replace(/\s*[\(\[](feat|ft|with|remastered|deluxe|version|live)[\.\s\S]*?[\)\]]/gi, '')
    .replace(/[^\w\s]/gi, '')
    .trim();
}

/**
 * Priority 1: Check LRCGlass Community Lyrics
 */
function findCommunityLyrics(title: string, artist: string, trackCode?: string): LyricsResponse | null {
  const contributions = db.getContributionsForTrack(title, artist, trackCode);
  if (contributions.length > 0) {
    const top = contributions[0];
    return {
      trackTitle: top.trackTitle,
      artistName: top.artistName,
      source: 'community',
      sourceLabel: `LRCGlass Community (#1 Priority · by ${top.contributor})`,
      format: top.format,
      content: top.content,
      hasWordSync: top.hasWordSync,
      hasLineSync: top.format !== 'plain',
      contributor: top.contributor,
      version: top.version,
    };
  }
  return null;
}

/**
 * Priority 2: Query LRCLIB (Direct signature + Search fallback)
 */
async function fetchLrclibLyrics(
  title: string,
  artist: string,
  album?: string,
  durationSec?: number
): Promise<LyricsResponse | null> {
  const normTitle = normalizeTitle(title);
  const cleanArtist = artist.split(',')[0].trim();

  // Try direct signature endpoint first
  if (durationSec && durationSec > 0) {
    try {
      const url = new URL('https://lrclib.net/api/get');
      url.searchParams.set('track_name', title);
      url.searchParams.set('artist_name', cleanArtist);
      if (album) url.searchParams.set('album_name', album);
      url.searchParams.set('duration', String(Math.round(durationSec)));

      const res = await fetch(url.toString(), {
        headers: { 'User-Agent': LRCLIB_USER_AGENT },
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.syncedLyrics || data.plainLyrics;
        if (content) {
          const hasWordSync = Boolean(data.hasWordSync || (data.syncedLyrics && /<\d{1,2}:\d{2}/.test(data.syncedLyrics)));
          return {
            trackTitle: data.trackName || title,
            artistName: data.artistName || artist,
            source: 'lrclib',
            sourceLabel: 'LRCLIB (Verified)',
            sourceUrl: 'https://lrclib.net',
            format: hasWordSync ? 'enhanced-lrc' : data.syncedLyrics ? 'lrc' : 'plain',
            content,
            hasWordSync,
            hasLineSync: Boolean(data.syncedLyrics),
            isInstrumental: Boolean(data.instrumental),
          };
        }
      }
    } catch (err) {
      console.warn('[Lyrics LRCLIB] Direct lookup error:', err);
    }
  }

  // Fallback to search endpoint
  try {
    const sUrl = new URL('https://lrclib.net/api/search');
    sUrl.searchParams.set('track_name', normTitle);
    sUrl.searchParams.set('artist_name', cleanArtist);

    const sRes = await fetch(sUrl.toString(), {
      headers: { 'User-Agent': LRCLIB_USER_AGENT },
    });

    if (sRes.ok) {
      const list = await sRes.json();
      if (Array.isArray(list) && list.length > 0) {
        // Find best match with synced lyrics
        const best = list.find((item: any) => item.syncedLyrics) || list[0];
        const content = best.syncedLyrics || best.plainLyrics;
        if (content) {
          const hasWordSync = Boolean(best.hasWordSync || (best.syncedLyrics && /<\d{1,2}:\d{2}/.test(best.syncedLyrics)));
          return {
            trackTitle: best.trackName || title,
            artistName: best.artistName || artist,
            source: 'lrclib',
            sourceLabel: 'LRCLIB (Search Match)',
            sourceUrl: 'https://lrclib.net',
            format: hasWordSync ? 'enhanced-lrc' : best.syncedLyrics ? 'lrc' : 'plain',
            content,
            hasWordSync,
            hasLineSync: Boolean(best.syncedLyrics),
            isInstrumental: Boolean(best.instrumental),
          };
        }
      }
    }
  } catch (err) {
    console.warn('[Lyrics LRCLIB] Search error:', err);
  }

  return null;
}

/**
 * Priority 3: Query LRC.red
 */
async function fetchLrcRedLyrics(title: string, artist: string, isrc?: string): Promise<LyricsResponse | null> {
  const cleanTitle = normalizeTitle(title);
  const cleanArtist = artist.split(',')[0].trim();

  try {
    // If exact ISRC available, query directly
    if (isrc) {
      const isrcRes = await fetch(`https://lrc.red/s/${isrc}.json`, {
        headers: { 'User-Agent': 'LRCGlass/1.0', 'X-Client-ID': 'LRCGlass-Web' },
      });
      if (isrcRes.ok) {
        const isrcData = await isrcRes.json();
        // Check available lyric files: ttml, lrc, etc.
        if (isrcData.files?.ttml) {
          const ttmlRes = await fetch(isrcData.files.ttml);
          if (ttmlRes.ok) {
            const xml = await ttmlRes.text();
            return {
              trackTitle: isrcData.title || title,
              artistName: isrcData.artist || artist,
              source: 'lrc.red',
              sourceLabel: 'LRC.red (TTML Syllable-Sync)',
              sourceUrl: isrcData.page || 'https://lrc.red',
              format: 'ttml',
              content: xml,
              hasWordSync: true,
              hasLineSync: true,
            };
          }
        }
        if (isrcData.files?.lrc) {
          const lrcRes = await fetch(isrcData.files.lrc);
          if (lrcRes.ok) {
            const lrcText = await lrcRes.text();
            return {
              trackTitle: isrcData.title || title,
              artistName: isrcData.artist || artist,
              source: 'lrc.red',
              sourceLabel: 'LRC.red (LRC Synced)',
              sourceUrl: isrcData.page || 'https://lrc.red',
              format: 'lrc',
              content: lrcText,
              hasWordSync: false,
              hasLineSync: true,
            };
          }
        }
      }
    }

    // Search query
    const searchUrl = `https://lrc.red/search.json?q=${encodeURIComponent(`${cleanTitle} ${cleanArtist}`)}`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'User-Agent': 'LRCGlass/1.0', 'X-Client-ID': 'LRCGlass-Web' },
    });

    if (searchRes.ok) {
      const results = await searchRes.json();
      const list = Array.isArray(results) ? results : results.results || [];
      if (list.length > 0) {
        const match = list[0];
        if (match.isrc) {
          return fetchLrcRedLyrics(title, artist, match.isrc);
        }
      }
    }
  } catch (err) {
    console.warn('[Lyrics LRC.red] Error:', err);
  }

  return null;
}

/**
 * Priority 4: Authorized Genius Lookup for Song Identification & Page Reference
 */
async function fetchGeniusDiscovery(title: string, artist: string): Promise<{ url?: string; headerImage?: string } | null> {
  if (!GENIUS_ACCESS_TOKEN) return null;
  try {
    const res = await fetch(`https://api.genius.com/search?q=${encodeURIComponent(`${title} ${artist}`)}`, {
      headers: { Authorization: `Bearer ${GENIUS_ACCESS_TOKEN}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const hit = data.response?.hits?.[0]?.result;
    if (hit) {
      return {
        url: hit.url,
        headerImage: hit.header_image_url,
      };
    }
  } catch (err) {
    console.warn('[Genius Discovery] Error:', err);
  }
  return null;
}

/**
 * Master Lyrics Discovery Function
 * Strict priority: 1) LRCGlass Community, 2) LRCLIB, 3) LRC.red, 4) Genius
 */
export async function getLyricsForTrack(params: {
  title: string;
  artist: string;
  album?: string;
  durationMs?: number;
  trackCode?: string;
  isrc?: string;
}): Promise<LyricsResponse> {
  const { title, artist, album, durationMs, trackCode, isrc } = params;
  const durationSec = durationMs ? durationMs / 1000 : undefined;

  // 1. Priority 1: LRCGlass Community Contributions
  const communityResult = findCommunityLyrics(title, artist, trackCode);
  if (communityResult) {
    return communityResult;
  }

  // 2. Priority 2: LRCLIB
  const lrclibResult = await fetchLrclibLyrics(title, artist, album, durationSec);
  if (lrclibResult) {
    return lrclibResult;
  }

  // 3. Priority 3: LRC.red
  const lrcRedResult = await fetchLrcRedLyrics(title, artist, isrc);
  if (lrcRedResult) {
    return lrcRedResult;
  }

  // 4. Priority 4: Authorized Genius discovery link
  const geniusInfo = await fetchGeniusDiscovery(title, artist);

  // Fallback: No lyrics found yet
  return {
    trackTitle: title,
    artistName: artist,
    source: 'none',
    sourceLabel: 'No lyrics available yet',
    sourceUrl: geniusInfo?.url,
    format: 'plain',
    content: '',
    hasWordSync: false,
    hasLineSync: false,
  };
}
