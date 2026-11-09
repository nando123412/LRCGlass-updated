import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import {
  searchSpotify,
  getArtistDiscography,
  getAlbumDetails,
  getTrackDetails,
  isSpotifyConfigured,
} from './server/spotify.ts';
import { getHeadlinerArtist, getHeadlinerAlbum } from './server/headliner.ts';
import { getLyricsForTrack } from './server/lyrics.ts';
import { db } from './server/db.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isDev = process.env.NODE_ENV !== 'production';

app.use(express.json());

// -----------------------------------------------------------------------------
// API Endpoints
// -----------------------------------------------------------------------------

// System Status & Diagnostics
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    spotifyConfigured: isSpotifyConfigured(),
    headlinerBaseUrl: process.env.HEADLINER_API_BASE_URL || 'https://headliner.nandoothjuuh.me',
    totalEntitiesStored: db.listEntities(undefined, 1000).length,
    communityContributions: db.getAllContributions().length,
  });
});

// Spotify Unified Search
app.get('/api/spotify/search', async (req, res) => {
  try {
    const q = (req.query.q as string) || '';
    const type = (req.query.type as string) || 'track,album,artist';
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 12));
    const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);

    if (!q.trim()) {
      return res.json({
        tracks: [],
        albums: [],
        artists: [],
        totalTracks: 0,
        totalAlbums: 0,
        totalArtists: 0,
      });
    }

    const results = await searchSpotify(q, type, limit, offset);
    res.json(results);
  } catch (err: any) {
    console.error('[API Spotify Search] Error:', err);
    res.status(500).json({ error: 'Search failed', message: err?.message });
  }
});

// Spotify Artist Discography
app.get('/api/spotify/artist/:id', async (req, res) => {
  try {
    const artistId = req.params.id;
    if (!artistId) return res.status(400).json({ error: 'Artist ID required' });
    const discography = await getArtistDiscography(artistId);
    res.json(discography);
  } catch (err: any) {
    console.error('[API Artist Discography] Error:', err);
    res.status(500).json({ error: 'Failed to retrieve artist discography', message: err?.message });
  }
});

// Spotify Album Details
app.get('/api/spotify/album/:id', async (req, res) => {
  try {
    const albumId = req.params.id;
    if (!albumId) return res.status(400).json({ error: 'Album ID required' });
    const album = await getAlbumDetails(albumId);
    res.json(album);
  } catch (err: any) {
    console.error('[API Album Details] Error:', err);
    res.status(500).json({ error: 'Failed to retrieve album details', message: err?.message });
  }
});

// Spotify Single Track Details
app.get('/api/spotify/track/:id', async (req, res) => {
  try {
    const trackId = req.params.id;
    if (!trackId) return res.status(400).json({ error: 'Track ID required' });
    const track = await getTrackDetails(trackId);
    if (!track) return res.status(404).json({ error: 'Track not found' });
    res.json(track);
  } catch (err: any) {
    console.error('[API Track Details] Error:', err);
    res.status(500).json({ error: 'Failed to retrieve track details', message: err?.message });
  }
});

// Headliner Artist Animated Assets
app.get('/api/headliner/artist', async (req, res) => {
  try {
    const name = req.query.name as string;
    const appleUrl = req.query.appleUrl as string;
    if (!name && !appleUrl) return res.status(400).json({ error: 'Name or Apple Music URL required' });
    const data = await getHeadlinerArtist(name || '', appleUrl);
    res.json(data || {});
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch Headliner artist assets', message: err?.message });
  }
});

// Headliner Album Animated Assets
app.get('/api/headliner/album', async (req, res) => {
  try {
    const album = req.query.album as string;
    const artist = (req.query.artist as string) || '';
    const appleUrl = req.query.appleUrl as string;
    if (!album && !appleUrl) return res.status(400).json({ error: 'Album title required' });
    const data = await getHeadlinerAlbum(album || '', artist, appleUrl);
    res.json(data || {});
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch Headliner album assets', message: err?.message });
  }
});

// Headliner Media Proxy (Secure Proxy for Apple Video Content)
app.get('/api/headliner/proxy', async (req, res) => {
  try {
    const mediaUrl = req.query.url as string;
    if (!mediaUrl) return res.status(400).send('Missing url');

    const parsed = new URL(mediaUrl);
    // Validate domain to prevent open proxying
    const allowed = ['apple.com', 'mzstatic.com', 'headliner.nandoothjuuh.me'];
    if (!allowed.some((d) => parsed.hostname.endsWith(d))) {
      return res.status(403).send('Forbidden domain');
    }

    const upstream = await fetch(mediaUrl);
    res.setHeader('Content-Type', upstream.headers.get('Content-Type') || 'video/mp4');
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);
  } catch (err) {
    res.status(502).send('Proxy error');
  }
});

// Lyrics Discovery Endpoint (Community > LRCLIB > LRC.red > Genius)
app.get('/api/lyrics', async (req, res) => {
  try {
    const title = req.query.title as string;
    const artist = req.query.artist as string;
    const album = req.query.album as string;
    const durationMs = parseInt(req.query.duration as string, 10) || undefined;
    const trackCode = req.query.trackCode as string;
    const isrc = req.query.isrc as string;

    if (!title || !artist) {
      return res.status(400).json({ error: 'title and artist parameters are required' });
    }

    const lyrics = await getLyricsForTrack({
      title,
      artist,
      album,
      durationMs,
      trackCode,
      isrc,
    });

    res.json(lyrics);
  } catch (err: any) {
    console.error('[API Lyrics] Error:', err);
    res.status(500).json({ error: 'Failed to discover lyrics', message: err?.message });
  }
});

// Community Lyrics Contribution Submission
app.post('/api/lyrics/contribute', (req, res) => {
  try {
    const { trackTitle, artistName, albumName, format, content, contributor, trackCode, hasWordSync, language } = req.body;
    if (!trackTitle || !artistName || !content) {
      return res.status(400).json({ error: 'trackTitle, artistName, and content are required' });
    }

    const contribution = db.addContribution({
      trackCode,
      trackTitle,
      artistName,
      albumName,
      format: format || 'lrc',
      content,
      contributor,
      hasWordSync,
      language,
    });

    res.json({ success: true, contribution });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to save contribution', message: err?.message });
  }
});

// List Community Contributions
app.get('/api/lyrics/community', (req, res) => {
  const contributions = db.getAllContributions();
  res.json(contributions);
});

// Fallback Image Feedback
app.post('/api/feedback/image', (req, res) => {
  try {
    const { artistName, imageUrl, action } = req.body;
    if (!artistName || !imageUrl || !action) {
      return res.status(400).json({ error: 'artistName, imageUrl, action required' });
    }
    const feedback = db.recordImageFeedback(artistName, imageUrl, action);
    res.json({ success: true, feedback });
  } catch (err: any) {
    res.status(500).json({ error: 'Feedback failed', message: err?.message });
  }
});

app.get('/api/feedback/image', (req, res) => {
  const artistName = req.query.artist as string;
  const imageUrl = req.query.url as string;
  if (!artistName || !imageUrl) return res.status(400).json({ error: 'Parameters missing' });
  const feedback = db.getImageFeedback(artistName, imageUrl);
  res.json(feedback || { likes: 0, dislikes: 0 });
});

// Database Compact Entities
app.get('/api/database/entities', (req, res) => {
  const type = req.query.type as 'track' | 'album' | 'artist' | undefined;
  const entities = db.listEntities(type, 100);
  res.json(entities);
});

// -----------------------------------------------------------------------------
// Vite Middleware / Static File Serving
// -----------------------------------------------------------------------------

async function startServer() {
  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[LRCGlass Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[LRCGlass Server] Failed to start:', err);
});
