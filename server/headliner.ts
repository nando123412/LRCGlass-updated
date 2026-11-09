import dotenv from 'dotenv';
import { db } from './db.ts';

dotenv.config();

const HEADLINER_API_BASE_URL = (process.env.HEADLINER_API_BASE_URL || 'https://headliner.nandoothjuuh.me').replace(/\/$/, '');
const HEADLINER_EMAIL = process.env.HEADLINER_CLIENT_EMAIL || 'nandovanderveen0669@gmail.com';

const HEADLINER_HEADERS = {
  'User-Agent': 'LRCGlass/1.0',
  'X-Client-Email': HEADLINER_EMAIL,
  'Accept': 'application/json',
};

export interface HeadlinerArtistData {
  artistName: string;
  appleMusicUrl?: string;
  headerVideo?: string;
  headerVideoMp4?: string;
  variants?: Array<{
    url: string;
    label?: string;
    width?: number;
    height?: number;
    type?: string;
    is16x9?: boolean;
    mp4?: string;
    hls?: string;
  }>;
  logoUrl?: string;
  staticArtwork?: string;
  dominantColor?: string;
}

export interface HeadlinerAlbumData {
  albumTitle: string;
  artistName: string;
  appleMusicUrl?: string;
  animatedVideoMp4?: string;
  animatedVideoHls?: string;
  staticArtwork?: string;
}

/**
 * Searches Headliner for an Apple Music artist and extracts animated headers and logo
 */
export async function getHeadlinerArtist(artistName: string, directAppleUrl?: string): Promise<HeadlinerArtistData | null> {
  const cacheKey = `headliner:artist:${artistName.toLowerCase().trim()}`;
  const cached = db.getCached<HeadlinerArtistData>(cacheKey);
  if (cached) return cached;

  try {
    let appleUrl = directAppleUrl;

    if (!appleUrl) {
      // 1. Search for artist on Headliner
      const searchRes = await fetch(`${HEADLINER_API_BASE_URL}/api/v1/artists/search?q=${encodeURIComponent(artistName)}`, {
        headers: HEADLINER_HEADERS,
      });
      if (!searchRes.ok) return null;
      const rawSearch = await searchRes.json();
      const payload = rawSearch.data || rawSearch;
      const artists = Array.isArray(payload) ? payload : payload.results || payload.artists || [];
      if (!artists.length) return null;

      // Match closest artist name
      const matched = artists.find((a: any) =>
        (a.name || a.artistName || '').toLowerCase() === artistName.toLowerCase()
      ) || artists[0];

      appleUrl = matched.url || matched.appleMusicUrl || matched.artistViewUrl || matched.link;
    }

    if (!appleUrl) return null;

    // 2. Extract artist assets
    const extractRes = await fetch(`${HEADLINER_API_BASE_URL}/api/v1/extract/artist?url=${encodeURIComponent(appleUrl)}`, {
      headers: HEADLINER_HEADERS,
    });
    if (!extractRes.ok) return null;
    const rawExtract = await extractRes.json();
    const extractData = rawExtract.data || rawExtract;

    // Find recommended 16:9 MP4 from variants (prioritize universally playable H.264)
    const rawVariants = extractData.variants || [];
    let best16x9Mp4 = '';

    // 1. Strongly prefer 16:9 H.264 MP4 (1080p/720p universal browser support)
    for (const v of rawVariants) {
      if (v.is16x9 && v.mp4 && (v.codec === 'H.264' || (v.label && v.label.includes('H.264')))) {
        best16x9Mp4 = v.mp4;
        break;
      }
    }
    // 2. Fallback to any H.264 MP4 variant
    if (!best16x9Mp4) {
      const anyH264 = rawVariants.find((v: any) => v.mp4 && v.codec === 'H.264');
      if (anyH264) best16x9Mp4 = anyH264.mp4;
    }
    // 3. Fallback to any 16:9 MP4 variant
    if (!best16x9Mp4) {
      const any16x9 = rawVariants.find((v: any) => v.is16x9 && v.mp4);
      if (any16x9) best16x9Mp4 = any16x9.mp4;
    }
    // 4. Fallback to headerVideoMp4 or headerVideo
    if (!best16x9Mp4) {
      const anyMp4 = rawVariants.find((v: any) => v.mp4 || (v.url && v.url.endsWith('.mp4')));
      if (anyMp4) best16x9Mp4 = anyMp4.mp4 || anyMp4.url;
    }

    const headerVideo = best16x9Mp4 || extractData.headerVideoMp4 || extractData.headerVideo;

    // Logo extraction
    let logoUrl = extractData.logoProxy;
    if (logoUrl && logoUrl.startsWith('/api/')) {
      logoUrl = `${HEADLINER_API_BASE_URL}${logoUrl}`;
    }
    if (!logoUrl) {
      logoUrl = extractData.logoUrl || extractData.artistLogo || extractData.logo;
    }

    const staticArtwork =
      extractData.staticArtwork ||
      extractData.artworkUrl ||
      extractData.heroImage ||
      (extractData.topImageCandidates && extractData.topImageCandidates[0]?.url);

    const result: HeadlinerArtistData = {
      artistName,
      appleMusicUrl: appleUrl,
      headerVideo,
      headerVideoMp4: best16x9Mp4 || extractData.headerVideoMp4 || headerVideo,
      variants: rawVariants,
      logoUrl,
      staticArtwork,
      dominantColor: extractData.dominantColor || extractData.backgroundColor,
    };

    db.setCached(cacheKey, result, 24 * 60 * 60 * 1000); // 24 hours
    return result;
  } catch (err) {
    console.warn('[Headliner Artist] Error:', err);
    return null;
  }
}

/**
 * Searches Headliner for an Apple Music album and extracts animated album artwork
 */
export async function getHeadlinerAlbum(albumTitle: string, artistName: string, directAppleUrl?: string): Promise<HeadlinerAlbumData | null> {
  const cacheKey = `headliner:album:${albumTitle.toLowerCase().trim()}:${artistName.toLowerCase().trim()}`;
  const cached = db.getCached<HeadlinerAlbumData>(cacheKey);
  if (cached) return cached;

  try {
    let appleUrl = directAppleUrl;

    if (!appleUrl) {
      const searchRes = await fetch(
        `${HEADLINER_API_BASE_URL}/api/v1/albums/search?q=${encodeURIComponent(`${albumTitle} ${artistName}`)}`,
        { headers: HEADLINER_HEADERS }
      );
      if (!searchRes.ok) return null;
      const rawSearch = await searchRes.json();
      const payload = rawSearch.data || rawSearch;
      const albums = Array.isArray(payload) ? payload : payload.results || payload.albums || [];
      if (!albums.length) return null;

      const matched = albums.find((a: any) =>
        (a.title || a.name || a.albumName || '').toLowerCase().includes(albumTitle.toLowerCase())
      ) || albums[0];

      appleUrl = matched.url || matched.appleMusicUrl || matched.collectionViewUrl || matched.link;
    }

    if (!appleUrl) return null;

    // Extract album assets
    const extractRes = await fetch(`${HEADLINER_API_BASE_URL}/api/v1/extract/album?url=${encodeURIComponent(appleUrl)}`, {
      headers: HEADLINER_HEADERS,
    });
    if (!extractRes.ok) return null;
    const rawExtract = await extractRes.json();
    const extractData = rawExtract.data || rawExtract;

    const result: HeadlinerAlbumData = {
      albumTitle,
      artistName,
      appleMusicUrl: appleUrl,
      animatedVideoMp4: extractData.animatedVideoMp4 || extractData.videoMp4 || extractData.videoUrl || (extractData.variants && extractData.variants[0]?.mp4),
      animatedVideoHls: extractData.animatedVideoHls || extractData.videoHls || (extractData.variants && extractData.variants[0]?.hls),
      staticArtwork: extractData.staticArtwork || extractData.coverUrl || extractData.artwork,
    };

    db.setCached(cacheKey, result, 24 * 60 * 60 * 1000);
    return result;
  } catch (err) {
    console.warn('[Headliner Album] Error:', err);
    return null;
  }
}
