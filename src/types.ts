export interface Track {
  id: string;
  code: string;
  title: string;
  artist: string;
  artists?: Array<{ id: string; name: string }>;
  album: string;
  albumId?: string;
  albumCover: string;
  artistPicture?: string;
  durationMs: number;
  durationFormatted: string;
  releaseDate?: string;
  explicit: boolean;
  spotifyUrl: string;
  isrc?: string;
}

export interface Album {
  id: string;
  code: string;
  title: string;
  artist: string;
  artists?: Array<{ id: string; name: string }>;
  albumCover: string;
  releaseDate: string;
  albumType: string;
  totalTracks: number;
  spotifyUrl: string;
}

export interface Artist {
  id: string;
  code: string;
  name: string;
  profilePicture?: string;
  genres: string[];
  followers?: number;
  popularity?: number;
  spotifyUrl: string;
}

export interface LyricsData {
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

export interface CommunityContribution {
  id: string;
  trackCode: string;
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

export interface TrackAudio {
  id: string;
  trackCode: string;
  trackTitle?: string;
  artistName?: string;
  audioUrl: string;
  audioType?: string;
  addedBy?: string;
  authorUid?: string;
  createdAt: number;
}

export type ViewMode = 'search' | 'artist' | 'album' | 'player' | 'community' | 'status';
