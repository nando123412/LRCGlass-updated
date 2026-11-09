import fs from 'node:fs';
import path from 'node:path';

/**
 * Compact entity structure as specified in Section 6:
 * sp:t:{id} -> Spotify Track
 * sp:a:{id} -> Spotify Album
 * sp:ar:{id} -> Spotify Artist
 */
export interface CompactEntity {
  code: string;
  provider: 'spotify';
  type: 'track' | 'album' | 'artist';
  providerId: string;
  title?: string;
  artistName?: string;
  firstSeenAt: number;
  lastAccessedAt: number;
}

export interface CachedMetadata {
  code: string;
  data: any;
  cachedAt: number;
  expiresAt: number; // TTL expiration
}

export interface CommunityLyricContribution {
  id: string;
  trackCode: string; // e.g. sp:t:4iV5W9uYEdYUVa79Axb7Rh
  trackTitle: string;
  artistName: string;
  albumName?: string;
  format: 'plain' | 'lrc' | 'enhanced-lrc' | 'ttml';
  content: string;
  language?: string;
  hasWordSync: boolean;
  contributor: string;
  version: number;
  status: 'published' | 'pending';
  votes: number;
  createdAt: number;
  updatedAt: number;
}

export interface ImageFeedback {
  id: string;
  artistName: string;
  imageUrl: string;
  likes: number;
  dislikes: number;
  lastUpdated: number;
}

interface DatabaseSchema {
  entities: Record<string, CompactEntity>;
  metadataCache: Record<string, CachedMetadata>;
  contributions: CommunityLyricContribution[];
  imageFeedbacks: Record<string, ImageFeedback>;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'lrcglass_store.json');

// 1-hour cache TTL for external provider metadata (Spotify terms compliance)
const CACHE_TTL_MS = 60 * 60 * 1000;

class CompactDatabase {
  private data: DatabaseSchema = {
    entities: {},
    metadataCache: {},
    contributions: [],
    imageFeedbacks: {},
  };
  private isLoaded = false;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
        // Prune expired cache entries upon load
        this.pruneExpiredCache();
      } else {
        // Initialize with default seeds if empty
        this.seedInitialData();
        this.saveSync();
      }
      this.isLoaded = true;
    } catch (err) {
      console.warn('[LRCGlass DB] Failed to load store, initializing fresh memory store:', err);
      this.seedInitialData();
      this.isLoaded = true;
    }
  }

  private seedInitialData() {
    // Seed sample verified community lyrics contribution for demonstration
    this.data.contributions = [
      {
        id: 'contrib-seed-ordinary',
        trackCode: 'sp:t:4iV5W9uYEdYUVa79Axb7Rh',
        trackTitle: 'Ordinary',
        artistName: 'Alex Warren',
        albumName: 'You Will Be Alright Kid',
        format: 'enhanced-lrc',
        content: `[ti:Ordinary]
[ar:Alex Warren]
[al:You Will Be Alright Kid]
[00:08.50]<00:08.50>I <00:08.80>used <00:09.10>to <00:09.40>think <00:09.80>that <00:10.20>love <00:10.60>was <00:11.20>blind
[00:12.80]<00:12.80>And <00:13.20>I <00:13.50>would <00:13.90>never <00:14.50>find <00:15.10>someone <00:15.80>like <00:16.40>you
[00:17.20]<00:17.20>In <00:17.50>this <00:17.90>crowded <00:18.50>room <00:19.20>tonight
[00:21.00]<00:21.00>You <00:21.40>make <00:21.80>the <00:22.20>ordinary <00:23.50>shine <00:24.20>so <00:25.00>bright`,
        language: 'en',
        hasWordSync: true,
        contributor: 'LRCGlass Editor Team',
        version: 1,
        status: 'published',
        votes: 14,
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now() - 86400000,
      },
    ];
  }

  private scheduleSave() {
    if (this.saveTimeout) return;
    this.saveTimeout = setTimeout(() => {
      this.saveSync();
      this.saveTimeout = null;
    }, 1000);
  }

  private saveSync() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[LRCGlass DB] Error writing store file:', err);
    }
  }

  private pruneExpiredCache() {
    const now = Date.now();
    for (const [key, item] of Object.entries(this.data.metadataCache)) {
      if (item.expiresAt && item.expiresAt < now) {
        delete this.data.metadataCache[key];
      }
    }
  }

  // --- Entity Operations ---
  public upsertEntity(type: 'track' | 'album' | 'artist', providerId: string, title?: string, artistName?: string): CompactEntity {
    const code = `sp:${type === 'track' ? 't' : type === 'album' ? 'a' : 'ar'}:${providerId}`;
    const now = Date.now();
    if (!this.data.entities[code]) {
      this.data.entities[code] = {
        code,
        provider: 'spotify',
        type,
        providerId,
        title,
        artistName,
        firstSeenAt: now,
        lastAccessedAt: now,
      };
    } else {
      this.data.entities[code].lastAccessedAt = now;
      if (title) this.data.entities[code].title = title;
      if (artistName) this.data.entities[code].artistName = artistName;
    }
    this.scheduleSave();
    return this.data.entities[code];
  }

  public getEntity(code: string): CompactEntity | null {
    return this.data.entities[code] || null;
  }

  public listEntities(type?: 'track' | 'album' | 'artist', limit = 50): CompactEntity[] {
    const all = Object.values(this.data.entities);
    const filtered = type ? all.filter((e) => e.type === type) : all;
    return filtered.sort((a, b) => b.lastAccessedAt - a.lastAccessedAt).slice(0, limit);
  }

  // --- Temporary Cache Operations ---
  public getCached<T = any>(cacheKey: string): T | null {
    const entry = this.data.metadataCache[cacheKey];
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      delete this.data.metadataCache[cacheKey];
      return null;
    }
    return entry.data as T;
  }

  public setCached(cacheKey: string, data: any, ttlMs = CACHE_TTL_MS): void {
    const now = Date.now();
    this.data.metadataCache[cacheKey] = {
      code: cacheKey,
      data,
      cachedAt: now,
      expiresAt: now + ttlMs,
    };
    this.scheduleSave();
  }

  // --- Community Lyrics Contributions (Priority 1) ---
  public getContributionsForTrack(title: string, artist: string, trackCode?: string): CommunityLyricContribution[] {
    const norm = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanTitle = norm(title);
    const cleanArtist = norm(artist);

    return this.data.contributions.filter((c) => {
      if (trackCode && c.trackCode === trackCode) return true;
      const cTitle = norm(c.trackTitle);
      const cArtist = norm(c.artistName);
      return (
        (cTitle.includes(cleanTitle) || cleanTitle.includes(cTitle)) &&
        (cArtist.includes(cleanArtist) || cleanArtist.includes(cArtist))
      );
    }).sort((a, b) => b.votes - a.votes || b.updatedAt - a.updatedAt);
  }

  public addContribution(params: {
    trackCode?: string;
    trackTitle: string;
    artistName: string;
    albumName?: string;
    format: 'plain' | 'lrc' | 'enhanced-lrc' | 'ttml';
    content: string;
    contributor?: string;
    hasWordSync?: boolean;
    language?: string;
  }): CommunityLyricContribution {
    const now = Date.now();
    const id = `contrib-${now}-${Math.random().toString(36).substring(2, 7)}`;
    const newContrib: CommunityLyricContribution = {
      id,
      trackCode: params.trackCode || `custom:${normStr(params.trackTitle)}-${normStr(params.artistName)}`,
      trackTitle: params.trackTitle,
      artistName: params.artistName,
      albumName: params.albumName,
      format: params.format,
      content: params.content,
      language: params.language || 'en',
      hasWordSync: params.hasWordSync ?? (params.format === 'enhanced-lrc' || params.format === 'ttml'),
      contributor: params.contributor || 'Community Contributor',
      version: 1,
      status: 'published',
      votes: 1,
      createdAt: now,
      updatedAt: now,
    };

    this.data.contributions.unshift(newContrib);
    this.scheduleSave();
    return newContrib;
  }

  public getAllContributions(): CommunityLyricContribution[] {
    return [...this.data.contributions];
  }

  // --- Image Feedback (Like / Dislike) ---
  public recordImageFeedback(artistName: string, imageUrl: string, action: 'like' | 'dislike'): ImageFeedback {
    const key = `${artistName.toLowerCase().trim()}:${imageUrl}`;
    if (!this.data.imageFeedbacks[key]) {
      this.data.imageFeedbacks[key] = {
        id: key,
        artistName,
        imageUrl,
        likes: action === 'like' ? 1 : 0,
        dislikes: action === 'dislike' ? 1 : 0,
        lastUpdated: Date.now(),
      };
    } else {
      if (action === 'like') this.data.imageFeedbacks[key].likes += 1;
      if (action === 'dislike') this.data.imageFeedbacks[key].dislikes += 1;
      this.data.imageFeedbacks[key].lastUpdated = Date.now();
    }
    this.scheduleSave();
    return this.data.imageFeedbacks[key];
  }

  public getImageFeedback(artistName: string, imageUrl: string): ImageFeedback | null {
    const key = `${artistName.toLowerCase().trim()}:${imageUrl}`;
    return this.data.imageFeedbacks[key] || null;
  }
}

function normStr(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export const db = new CompactDatabase();
