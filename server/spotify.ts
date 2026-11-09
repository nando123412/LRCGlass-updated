import dotenv from 'dotenv';
import { db } from './db.ts';

dotenv.config();

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';
const SPOTIFY_MARKET = process.env.SPOTIFY_MARKET || 'NL';

let cachedToken: { token: string; expiresAt: number } | null = null;
const artistImageCache = new Map<string, { url: string; genres: string[]; cachedAt: number }>();

export interface SpotifyTrack {
  id: string;
  code: string;
  title: string;
  artist: string;
  artists: Array<{ id: string; name: string }>;
  album: string;
  albumId: string;
  albumCover: string;
  artistPicture?: string;
  durationMs: number;
  durationFormatted: string;
  releaseDate?: string;
  explicit: boolean;
  spotifyUrl: string;
  isrc?: string;
}

export interface SpotifyAlbum {
  id: string;
  code: string;
  title: string;
  artist: string;
  artists: Array<{ id: string; name: string }>;
  albumCover: string;
  releaseDate: string;
  albumType: string;
  totalTracks: number;
  spotifyUrl: string;
}

export interface SpotifyArtist {
  id: string;
  code: string;
  name: string;
  profilePicture?: string;
  genres: string[];
  followers?: number;
  popularity?: number;
  spotifyUrl: string;
}

export interface SpotifySearchResults {
  tracks: SpotifyTrack[];
  albums: SpotifyAlbum[];
  artists: SpotifyArtist[];
  totalTracks: number;
  totalAlbums: number;
  totalArtists: number;
}

/**
 * Checks if Spotify credentials are configured
 */
export function isSpotifyConfigured(): boolean {
  return Boolean(
    SPOTIFY_CLIENT_ID &&
    SPOTIFY_CLIENT_SECRET &&
    SPOTIFY_CLIENT_ID !== 'YOUR_SPOTIFY_CLIENT_ID' &&
    SPOTIFY_CLIENT_SECRET !== 'YOUR_SPOTIFY_CLIENT_SECRET'
  );
}

/**
 * Obtains or refreshes Spotify access token using Client Credentials Flow
 */
async function getSpotifyToken(): Promise<string | null> {
  if (!isSpotifyConfigured()) {
    return null;
  }

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60000) {
    return cachedToken.token;
  }

  try {
    const creds = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn('[Spotify Auth] Failed to get token:', res.status, errText);
      return null;
    }

    const data = await res.json();
    cachedToken = {
      token: data.access_token,
      expiresAt: now + (data.expires_in || 3600) * 1000,
    };
    return cachedToken.token;
  } catch (err) {
    console.error('[Spotify Auth] Network error fetching token:', err);
    return null;
  }
}

/**
 * Retrieves artist profile image and genres, with short-lived cache
 */
export async function getArtistProfile(artistId: string, token: string): Promise<{ url?: string; genres: string[] }> {
  if (!artistId) return { genres: [] };
  const cached = artistImageCache.get(artistId);
  if (cached && Date.now() - cached.cachedAt < 3600000) {
    return { url: cached.url, genres: cached.genres };
  }

  try {
    const res = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { genres: [] };
    const data = await res.json();
    const url = data.images && data.images.length > 0 ? data.images[0].url : undefined;
    const genres = data.genres || [];
    artistImageCache.set(artistId, { url: url || '', genres, cachedAt: Date.now() });
    return { url, genres };
  } catch (err) {
    return { genres: [] };
  }
}

/**
 * Unified Spotify search across tracks, albums, and artists
 */
export async function searchSpotify(
  query: string,
  type: string = 'track,album,artist',
  limit = 10,
  offset = 0
): Promise<SpotifySearchResults> {
  const token = await getSpotifyToken();

  if (!token) {
    // If Spotify credentials are not set, return graceful public fallback search
    return getPublicFallbackSearch(query, type, limit);
  }

  const cacheKey = `search:${query}:${type}:${limit}:${offset}`;
  const cached = db.getCached<SpotifySearchResults>(cacheKey);
  if (cached) return cached;

  const url = new URL('https://api.spotify.com/v1/search');
  url.searchParams.set('q', query);
  url.searchParams.set('type', type);
  url.searchParams.set('market', SPOTIFY_MARKET);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    console.warn('[Spotify Search] API returned status:', res.status);
    return getPublicFallbackSearch(query, type, limit);
  }

  const data = await res.json();
  const rawTracks = data.tracks?.items || [];
  const rawAlbums = data.albums?.items || [];
  const rawArtists = data.artists?.items || [];

  // Extract unique artist IDs from tracks to fetch profile pictures concurrently
  const uniqueArtistIds = Array.from(
    new Set(rawTracks.map((t: any) => t.artists?.[0]?.id).filter(Boolean))
  ) as string[];

  // Concurrently fetch artist pictures
  await Promise.all(uniqueArtistIds.map((id) => getArtistProfile(id, token)));

  // Format tracks
  const tracks: SpotifyTrack[] = rawTracks.map((t: any) => {
    const primaryArtistId = t.artists?.[0]?.id || '';
    const artistCached = artistImageCache.get(primaryArtistId);
    const coverUrl = t.album?.images?.[0]?.url || '';
    const code = `sp:t:${t.id}`;

    // Upsert into compact database
    db.upsertEntity('track', t.id, t.name, t.artists?.[0]?.name);

    return {
      id: t.id,
      code,
      title: t.name,
      artist: t.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
      artists: t.artists?.map((a: any) => ({ id: a.id, name: a.name })) || [],
      album: t.album?.name || '',
      albumId: t.album?.id || '',
      albumCover: coverUrl,
      artistPicture: artistCached?.url || undefined,
      durationMs: t.duration_ms || 0,
      durationFormatted: formatMs(t.duration_ms || 0),
      releaseDate: t.album?.release_date,
      explicit: Boolean(t.explicit),
      spotifyUrl: t.external_urls?.spotify || `https://open.spotify.com/track/${t.id}`,
      isrc: t.external_ids?.isrc,
    };
  });

  // Format albums
  const albums: SpotifyAlbum[] = rawAlbums.map((a: any) => {
    const code = `sp:a:${a.id}`;
    db.upsertEntity('album', a.id, a.name, a.artists?.[0]?.name);
    return {
      id: a.id,
      code,
      title: a.name,
      artist: a.artists?.map((ar: any) => ar.name).join(', ') || 'Unknown Artist',
      artists: a.artists?.map((ar: any) => ({ id: ar.id, name: ar.name })) || [],
      albumCover: a.images?.[0]?.url || '',
      releaseDate: a.release_date || '',
      albumType: a.album_type || 'album',
      totalTracks: a.total_tracks || 0,
      spotifyUrl: a.external_urls?.spotify || `https://open.spotify.com/album/${a.id}`,
    };
  });

  // Format artists
  const artists: SpotifyArtist[] = rawArtists.map((ar: any) => {
    const code = `sp:ar:${ar.id}`;
    db.upsertEntity('artist', ar.id, ar.name);
    return {
      id: ar.id,
      code,
      name: ar.name,
      profilePicture: ar.images?.[0]?.url || undefined,
      genres: ar.genres || [],
      followers: ar.followers?.total,
      popularity: ar.popularity,
      spotifyUrl: ar.external_urls?.spotify || `https://open.spotify.com/artist/${ar.id}`,
    };
  });

  const result: SpotifySearchResults = {
    tracks,
    albums,
    artists,
    totalTracks: data.tracks?.total || tracks.length,
    totalAlbums: data.albums?.total || albums.length,
    totalArtists: data.artists?.total || artists.length,
  };

  db.setCached(cacheKey, result, 15 * 60 * 1000); // 15 mins cache
  return result;
}

/**
 * Retrieves full artist discography with studio albums, singles, EPs, and deduplicated tracks
 */
export async function getArtistDiscography(artistId: string): Promise<{
  artist: SpotifyArtist;
  popularTracks: SpotifyTrack[];
  albums: SpotifyAlbum[];
  singles: SpotifyAlbum[];
  compilations: SpotifyAlbum[];
  allTracks: SpotifyTrack[];
}> {
  if (artistId.startsWith('itunes-')) {
    return getPublicFallbackArtistDiscography(artistId);
  }

  const token = await getSpotifyToken();
  if (!token) {
    return getPublicFallbackArtistDiscography(artistId);
  }

  const cacheKey = `artist:discography:${artistId}`;
  const cached = db.getCached(cacheKey);
  if (cached) return cached;

  // 1. Fetch artist profile
  const artistRes = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!artistRes.ok) {
    return getPublicFallbackArtistDiscography(artistId);
  }
  const artistData = await artistRes.json();
  const artist: SpotifyArtist = {
    id: artistData.id || artistId,
    code: `sp:ar:${artistId}`,
    name: artistData.name || 'Artist',
    profilePicture: artistData.images?.[0]?.url,
    genres: artistData.genres || [],
    followers: artistData.followers?.total,
    popularity: artistData.popularity,
    spotifyUrl: artistData.external_urls?.spotify || `https://open.spotify.com/artist/${artistId}`,
  };

  // 2. Fetch artist top tracks
  let popularTracks: SpotifyTrack[] = [];
  try {
    const topRes = await fetch(
      `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=${SPOTIFY_MARKET}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (topRes.ok) {
      const topData = await topRes.json();
      popularTracks = (topData.tracks || []).map((t: any) => ({
        id: t.id,
        code: `sp:t:${t.id}`,
        title: t.name,
        artist: t.artists?.map((a: any) => a.name).join(', '),
        artists: t.artists || [],
        album: t.album?.name || '',
        albumId: t.album?.id || '',
        albumCover: t.album?.images?.[0]?.url || '',
        artistPicture: artist.profilePicture,
        durationMs: t.duration_ms,
        durationFormatted: formatMs(t.duration_ms),
        explicit: Boolean(t.explicit),
        spotifyUrl: t.external_urls?.spotify || '',
        isrc: t.external_ids?.isrc,
      }));
    }
  } catch (err) {
    console.warn('[Spotify] Error fetching top tracks:', err);
  }

  // 3. Fetch artist releases (albums, singles, appears_on, compilation)
  const albumUrl = new URL(`https://api.spotify.com/v1/artists/${artistId}/albums`);
  albumUrl.searchParams.set('include_groups', 'album,single,appears_on,compilation');
  albumUrl.searchParams.set('market', SPOTIFY_MARKET);
  albumUrl.searchParams.set('limit', '50');

  const albumsRes = await fetch(albumUrl.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  const rawReleases = albumsRes.ok ? (await albumsRes.json()).items || [] : [];
  const studioAlbums: SpotifyAlbum[] = [];
  const singles: SpotifyAlbum[] = [];
  const compilations: SpotifyAlbum[] = [];

  const seenAlbumNames = new Set<string>();

  for (const item of rawReleases) {
    const normalizedName = item.name.toLowerCase().trim();
    if (seenAlbumNames.has(normalizedName)) continue;
    seenAlbumNames.add(normalizedName);

    const formatted: SpotifyAlbum = {
      id: item.id,
      code: `sp:a:${item.id}`,
      title: item.name,
      artist: item.artists?.map((a: any) => a.name).join(', ') || artist.name,
      artists: item.artists || [],
      albumCover: item.images?.[0]?.url || '',
      releaseDate: item.release_date || '',
      albumType: item.album_group || item.album_type || 'album',
      totalTracks: item.total_tracks || 0,
      spotifyUrl: item.external_urls?.spotify || '',
    };

    if (item.album_group === 'album' || item.album_type === 'album') {
      studioAlbums.push(formatted);
    } else if (item.album_group === 'single' || item.album_type === 'single') {
      singles.push(formatted);
    } else {
      compilations.push(formatted);
    }
  }

  // 4. Concurrently fetch tracks for top albums and deduplicate
  const tracksMap = new Map<string, SpotifyTrack>();
  const albumsToFetch = [...studioAlbums.slice(0, 8), ...singles.slice(0, 8)];

  await Promise.all(
    albumsToFetch.map(async (alb) => {
      try {
        const tracksRes = await fetch(
          `https://api.spotify.com/v1/albums/${alb.id}/tracks?limit=50&market=${SPOTIFY_MARKET}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!tracksRes.ok) return;
        const tData = await tracksRes.json();
        for (const t of tData.items || []) {
          if (!tracksMap.has(t.id)) {
            tracksMap.set(t.id, {
              id: t.id,
              code: `sp:t:${t.id}`,
              title: t.name,
              artist: t.artists?.map((a: any) => a.name).join(', '),
              artists: t.artists || [],
              album: alb.title,
              albumId: alb.id,
              albumCover: alb.albumCover,
              artistPicture: artist.profilePicture,
              durationMs: t.duration_ms,
              durationFormatted: formatMs(t.duration_ms),
              explicit: Boolean(t.explicit),
              spotifyUrl: t.external_urls?.spotify || `https://open.spotify.com/track/${t.id}`,
            });
          }
        }
      } catch (err) {
        // Continue gracefully
      }
    })
  );

  const allTracks = Array.from(tracksMap.values());

  const result = {
    artist,
    popularTracks: popularTracks.length > 0 ? popularTracks : allTracks.slice(0, 10),
    albums: studioAlbums,
    singles,
    compilations,
    allTracks,
  };

  db.setCached(cacheKey, result, 30 * 60 * 1000);
  return result;
}

/**
 * Retrieves full album details and complete tracklist
 */
export async function getAlbumDetails(albumId: string): Promise<{
  album: SpotifyAlbum;
  tracks: SpotifyTrack[];
}> {
  if (albumId.startsWith('itunes-')) {
    return getPublicFallbackAlbumDetails(albumId);
  }

  const token = await getSpotifyToken();
  if (!token) {
    return getPublicFallbackAlbumDetails(albumId);
  }

  const cacheKey = `album:${albumId}`;
  const cached = db.getCached(cacheKey);
  if (cached) return cached;

  const res = await fetch(`https://api.spotify.com/v1/albums/${albumId}?market=${SPOTIFY_MARKET}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    return getPublicFallbackAlbumDetails(albumId);
  }

  const data = await res.json();
  const cover = data.images?.[0]?.url || '';
  const primaryArtistId = data.artists?.[0]?.id;
  const artistProfile = primaryArtistId ? await getArtistProfile(primaryArtistId, token) : undefined;

  const album: SpotifyAlbum = {
    id: data.id,
    code: `sp:a:${data.id}`,
    title: data.name,
    artist: data.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
    artists: data.artists || [],
    albumCover: cover,
    releaseDate: data.release_date || '',
    albumType: data.album_type || 'album',
    totalTracks: data.total_tracks || data.tracks?.items?.length || 0,
    spotifyUrl: data.external_urls?.spotify || '',
  };

  const tracks: SpotifyTrack[] = (data.tracks?.items || []).map((t: any) => ({
    id: t.id,
    code: `sp:t:${t.id}`,
    title: t.name,
    artist: t.artists?.map((a: any) => a.name).join(', ') || album.artist,
    artists: t.artists || [],
    album: album.title,
    albumId: album.id,
    albumCover: cover,
    artistPicture: artistProfile?.url,
    durationMs: t.duration_ms,
    durationFormatted: formatMs(t.duration_ms),
    explicit: Boolean(t.explicit),
    spotifyUrl: t.external_urls?.spotify || `https://open.spotify.com/track/${t.id}`,
    isrc: t.external_ids?.isrc,
  }));

  const result = { album, tracks };
  db.setCached(cacheKey, result, 60 * 60 * 1000);
  return result;
}

/**
 * Retrieves track details by ID
 */
export async function getTrackDetails(trackId: string): Promise<SpotifyTrack | null> {
  if (trackId.startsWith('itunes-')) {
    return getPublicFallbackTrack(trackId);
  }

  const token = await getSpotifyToken();
  if (!token) {
    return getPublicFallbackTrack(trackId);
  }

  const cacheKey = `track:${trackId}`;
  const cached = db.getCached<SpotifyTrack>(cacheKey);
  if (cached) return cached;

  const res = await fetch(`https://api.spotify.com/v1/tracks/${trackId}?market=${SPOTIFY_MARKET}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    return getPublicFallbackTrack(trackId);
  }

  const t = await res.json();
  const primaryArtistId = t.artists?.[0]?.id;
  const artistProfile = primaryArtistId ? await getArtistProfile(primaryArtistId, token) : undefined;

  const track: SpotifyTrack = {
    id: t.id,
    code: `sp:t:${t.id}`,
    title: t.name,
    artist: t.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
    artists: t.artists || [],
    album: t.album?.name || '',
    albumId: t.album?.id || '',
    albumCover: t.album?.images?.[0]?.url || '',
    artistPicture: artistProfile?.url,
    durationMs: t.duration_ms,
    durationFormatted: formatMs(t.duration_ms),
    releaseDate: t.album?.release_date,
    explicit: Boolean(t.explicit),
    spotifyUrl: t.external_urls?.spotify || `https://open.spotify.com/track/${t.id}`,
    isrc: t.external_ids?.isrc,
  };

  db.setCached(cacheKey, track, 60 * 60 * 1000);
  return track;
}

// --------------------------------------------------------------------------------
// Public Catalog Fallback (Active when Spotify credentials are not configured yet)
// Leverages iTunes Search API & LRCLIB metadata for seamless real-data discovery
// --------------------------------------------------------------------------------

async function getPublicFallbackSearch(
  query: string,
  type: string,
  limit: number
): Promise<SpotifySearchResults> {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song,album,musicArtist&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) {
      return { tracks: [], albums: [], artists: [], totalTracks: 0, totalAlbums: 0, totalArtists: 0 };
    }
    const data = await res.json();
    const results = data.results || [];

    const tracks: SpotifyTrack[] = [];
    const albums: SpotifyAlbum[] = [];
    const artists: SpotifyArtist[] = [];

    const seenTracks = new Set<string>();
    const seenArtists = new Set<string>();
    const seenAlbums = new Set<string>();

    for (const item of results) {
      if (item.kind === 'song' || item.wrapperType === 'track') {
        const id = `itunes-${item.trackId}`;
        if (seenTracks.has(id)) continue;
        seenTracks.add(id);

        const artwork = item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '600x600bb') : '';
        tracks.push({
          id,
          code: `sp:t:${id}`,
          title: item.trackName || '',
          artist: item.artistName || 'Unknown Artist',
          artists: [{ id: `itunes-${item.artistId}`, name: item.artistName }],
          album: item.collectionName || '',
          albumId: `itunes-${item.collectionId}`,
          albumCover: artwork,
          durationMs: item.trackTimeMillis || 0,
          durationFormatted: formatMs(item.trackTimeMillis || 0),
          releaseDate: item.releaseDate ? item.releaseDate.split('T')[0] : undefined,
          explicit: item.trackExplicitness === 'explicit',
          spotifyUrl: item.trackViewUrl || '',
        });

        // Collect unique artists & albums from songs
        const artistIdKey = String(item.artistId);
        if (item.artistName && item.artistId && !seenArtists.has(artistIdKey)) {
          seenArtists.add(artistIdKey);
          artists.push({
            id: `itunes-${item.artistId}`,
            code: `sp:ar:itunes-${item.artistId}`,
            name: item.artistName,
            genres: [item.primaryGenreName].filter(Boolean),
            spotifyUrl: item.artistViewUrl || '',
          });
        }

        const albumIdKey = String(item.collectionId);
        if (item.collectionName && item.collectionId && !seenAlbums.has(albumIdKey)) {
          seenAlbums.add(albumIdKey);
          albums.push({
            id: `itunes-${item.collectionId}`,
            code: `sp:a:itunes-${item.collectionId}`,
            title: item.collectionName,
            artist: item.artistName || '',
            artists: [{ id: `itunes-${item.artistId}`, name: item.artistName }],
            albumCover: artwork,
            releaseDate: item.releaseDate ? item.releaseDate.split('T')[0] : '',
            albumType: 'album',
            totalTracks: item.trackCount || 1,
            spotifyUrl: item.collectionViewUrl || '',
          });
        }
      }
    }

    return {
      tracks,
      albums,
      artists,
      totalTracks: tracks.length,
      totalAlbums: albums.length,
      totalArtists: artists.length,
    };
  } catch (err) {
    console.error('[Fallback Search] Error:', err);
    return { tracks: [], albums: [], artists: [], totalTracks: 0, totalAlbums: 0, totalArtists: 0 };
  }
}

async function getPublicFallbackArtistDiscography(artistId: string) {
  // Query iTunes for artist discography by ID or name
  const cleanId = artistId.replace('itunes-', '');
  try {
    const res = await fetch(`https://itunes.apple.com/lookup?id=${cleanId}&entity=album,song&limit=50`);
    if (!res.ok) throw new Error('Failed to lookup artist');
    const data = await res.json();
    const results = data.results || [];
    const artistItem = results[0] || {};

    const artist: SpotifyArtist = {
      id: artistId,
      code: `sp:ar:${artistId}`,
      name: artistItem.artistName || 'Artist',
      genres: [artistItem.primaryGenreName].filter(Boolean),
      spotifyUrl: artistItem.artistLinkUrl || '',
    };

    const albums: SpotifyAlbum[] = [];
    const tracks: SpotifyTrack[] = [];

    for (let i = 1; i < results.length; i++) {
      const item = results[i];
      if (item.wrapperType === 'collection') {
        const cover = item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '600x600bb') : '';
        albums.push({
          id: `itunes-${item.collectionId}`,
          code: `sp:a:itunes-${item.collectionId}`,
          title: item.collectionName,
          artist: item.artistName,
          artists: [{ id: artistId, name: item.artistName }],
          albumCover: cover,
          releaseDate: item.releaseDate ? item.releaseDate.split('T')[0] : '',
          albumType: item.collectionType === 'Single' ? 'single' : 'album',
          totalTracks: item.trackCount || 1,
          spotifyUrl: item.collectionViewUrl || '',
        });
      } else if (item.wrapperType === 'track') {
        const cover = item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '600x600bb') : '';
        tracks.push({
          id: `itunes-${item.trackId}`,
          code: `sp:t:itunes-${item.trackId}`,
          title: item.trackName,
          artist: item.artistName,
          artists: [{ id: artistId, name: item.artistName }],
          album: item.collectionName,
          albumId: `itunes-${item.collectionId}`,
          albumCover: cover,
          durationMs: item.trackTimeMillis,
          durationFormatted: formatMs(item.trackTimeMillis),
          explicit: item.trackExplicitness === 'explicit',
          spotifyUrl: item.trackViewUrl || '',
        });
      }
    }

    return {
      artist,
      popularTracks: tracks.slice(0, 10),
      albums: albums.filter((a) => a.albumType !== 'single'),
      singles: albums.filter((a) => a.albumType === 'single'),
      compilations: [],
      allTracks: tracks,
    };
  } catch (err) {
    return {
      artist: { id: artistId, code: `sp:ar:${artistId}`, name: 'Artist', genres: [], spotifyUrl: '' },
      popularTracks: [],
      albums: [],
      singles: [],
      compilations: [],
      allTracks: [],
    };
  }
}

async function getPublicFallbackAlbumDetails(albumId: string) {
  const cleanId = albumId.replace('itunes-', '');
  try {
    const res = await fetch(`https://itunes.apple.com/lookup?id=${cleanId}&entity=song&limit=50`);
    if (!res.ok) throw new Error('Failed to lookup album');
    const data = await res.json();
    const results = data.results || [];
    const albItem = results[0] || {};
    const cover = albItem.artworkUrl100 ? albItem.artworkUrl100.replace('100x100bb', '600x600bb') : '';

    const album: SpotifyAlbum = {
      id: albumId,
      code: `sp:a:${albumId}`,
      title: albItem.collectionName || 'Album',
      artist: albItem.artistName || 'Artist',
      artists: [{ id: `itunes-${albItem.artistId}`, name: albItem.artistName }],
      albumCover: cover,
      releaseDate: albItem.releaseDate ? albItem.releaseDate.split('T')[0] : '',
      albumType: 'album',
      totalTracks: albItem.trackCount || results.length - 1,
      spotifyUrl: albItem.collectionViewUrl || '',
    };

    const tracks: SpotifyTrack[] = [];
    for (let i = 1; i < results.length; i++) {
      const item = results[i];
      if (item.wrapperType === 'track') {
        tracks.push({
          id: `itunes-${item.trackId}`,
          code: `sp:t:itunes-${item.trackId}`,
          title: item.trackName,
          artist: item.artistName,
          artists: [{ id: `itunes-${item.artistId}`, name: item.artistName }],
          album: album.title,
          albumId: album.id,
          albumCover: cover,
          durationMs: item.trackTimeMillis,
          durationFormatted: formatMs(item.trackTimeMillis),
          explicit: item.trackExplicitness === 'explicit',
          spotifyUrl: item.trackViewUrl || '',
        });
      }
    }

    return { album, tracks };
  } catch (err) {
    return {
      album: {
        id: albumId,
        code: `sp:a:${albumId}`,
        title: 'Album',
        artist: 'Artist',
        artists: [],
        albumCover: '',
        releaseDate: '',
        albumType: 'album',
        totalTracks: 0,
        spotifyUrl: '',
      },
      tracks: [],
    };
  }
}

async function getPublicFallbackTrack(trackId: string): Promise<SpotifyTrack | null> {
  const cleanId = trackId.replace('itunes-', '');
  try {
    const res = await fetch(`https://itunes.apple.com/lookup?id=${cleanId}`);
    if (!res.ok) return null;
    const data = await res.json();
    const item = data.results?.[0];
    if (!item) return null;
    const cover = item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '600x600bb') : '';

    return {
      id: trackId,
      code: `sp:t:${trackId}`,
      title: item.trackName,
      artist: item.artistName,
      artists: [{ id: `itunes-${item.artistId}`, name: item.artistName }],
      album: item.collectionName,
      albumId: `itunes-${item.collectionId}`,
      albumCover: cover,
      durationMs: item.trackTimeMillis,
      durationFormatted: formatMs(item.trackTimeMillis),
      releaseDate: item.releaseDate ? item.releaseDate.split('T')[0] : '',
      explicit: item.trackExplicitness === 'explicit',
      spotifyUrl: item.trackViewUrl || '',
    };
  } catch (err) {
    return null;
  }
}

function formatMs(ms: number): string {
  if (!ms) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}
