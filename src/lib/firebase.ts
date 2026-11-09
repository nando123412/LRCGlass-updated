import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import {
  getAuth,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { CommunityContribution } from '../types.ts';

// -----------------------------------------------------------------------------
// Firebase Initialization
// -----------------------------------------------------------------------------
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

/* CRITICAL: Use configured firestoreDatabaseId as required */
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// -----------------------------------------------------------------------------
// Error Handling Context
// -----------------------------------------------------------------------------
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('[Firestore Error Details]:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// -----------------------------------------------------------------------------
// Community Lyric Contribution Types & Firestore Services
// -----------------------------------------------------------------------------
export interface FirestoreContribution {
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
  authorUid?: string;
  version: number;
  status: 'published' | 'pending';
  votes: number;
  createdAt: any;
  updatedAt: any;
}

export async function fetchCommunityContributions(trackCode?: string): Promise<CommunityContribution[]> {
  const collPath = 'contributions';
  try {
    const collRef = collection(db, collPath);
    const snap = await getDocs(collRef);
    const results: CommunityContribution[] = [];

    snap.forEach((d) => {
      const data = d.data() as FirestoreContribution;
      if (!trackCode || data.trackCode === trackCode) {
        results.push({
          id: d.id,
          trackCode: data.trackCode || '',
          trackTitle: data.trackTitle || '',
          artistName: data.artistName || '',
          albumName: data.albumName,
          format: data.format || 'lrc',
          content: data.content || '',
          language: data.language || 'en',
          hasWordSync: Boolean(data.hasWordSync),
          contributor: data.contributor || 'Community Member',
          version: data.version || 1,
          status: data.status || 'published',
          votes: data.votes || 0,
          createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
          updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : Date.now(),
        });
      }
    });

    return results.sort((a, b) => b.votes - a.votes || b.updatedAt - a.updatedAt);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, collPath);
  }
}

export function subscribeCommunityContributions(
  callback: (contributions: CommunityContribution[]) => void
): () => void {
  const collPath = 'contributions';
  const collRef = collection(db, collPath);

  return onSnapshot(
    collRef,
    (snapshot) => {
      const results: CommunityContribution[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as FirestoreContribution;
        results.push({
          id: d.id,
          trackCode: data.trackCode || '',
          trackTitle: data.trackTitle || '',
          artistName: data.artistName || '',
          albumName: data.albumName,
          format: data.format || 'lrc',
          content: data.content || '',
          language: data.language || 'en',
          hasWordSync: Boolean(data.hasWordSync),
          contributor: data.contributor || 'Community Member',
          version: data.version || 1,
          status: data.status || 'published',
          votes: data.votes || 0,
          createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
          updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : Date.now(),
        });
      });
      results.sort((a, b) => b.votes - a.votes || b.updatedAt - a.updatedAt);
      callback(results);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, collPath);
    }
  );
}

export async function addCommunityContribution(params: {
  trackCode: string;
  trackTitle: string;
  artistName: string;
  albumName?: string;
  format: 'plain' | 'lrc' | 'enhanced-lrc' | 'ttml';
  content: string;
  contributor: string;
  hasWordSync?: boolean;
}): Promise<string> {
  const safeId = `c_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const path = `contributions/${safeId}`;

  const payload = {
    id: safeId,
    trackCode: params.trackCode.slice(0, 128),
    trackTitle: params.trackTitle.slice(0, 200),
    artistName: params.artistName.slice(0, 200),
    albumName: (params.albumName || '').slice(0, 200),
    format: params.format,
    content: params.content.slice(0, 50000),
    hasWordSync: Boolean(params.hasWordSync),
    contributor: (params.contributor || 'Community Member').slice(0, 100),
    authorUid: auth.currentUser?.uid || 'anon',
    version: 1,
    status: 'published',
    votes: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const docRef = doc(db, 'contributions', safeId);
    await setDoc(docRef, payload);
    return safeId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

// -----------------------------------------------------------------------------
// Track Audio Playback Sources (Firestore Persistence)
// -----------------------------------------------------------------------------
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

export async function getTrackAudios(trackCode: string): Promise<TrackAudio[]> {
  const collPath = 'track_audios';
  try {
    const collRef = collection(db, collPath);
    const snap = await getDocs(collRef);
    const results: TrackAudio[] = [];

    snap.forEach((d) => {
      const data = d.data();
      if (data.trackCode === trackCode) {
        results.push({
          id: d.id,
          trackCode: data.trackCode,
          trackTitle: data.trackTitle,
          artistName: data.artistName,
          audioUrl: data.audioUrl,
          audioType: data.audioType,
          addedBy: data.addedBy,
          authorUid: data.authorUid,
          createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
        });
      }
    });

    return results.sort((a, b) => b.createdAt - a.createdAt);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, collPath);
  }
}

export function subscribeTrackAudios(
  trackCode: string,
  callback: (audios: TrackAudio[]) => void
): () => void {
  const collPath = 'track_audios';
  const collRef = collection(db, collPath);

  return onSnapshot(
    collRef,
    (snapshot) => {
      const results: TrackAudio[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.trackCode === trackCode) {
          results.push({
            id: d.id,
            trackCode: data.trackCode,
            trackTitle: data.trackTitle,
            artistName: data.artistName,
            audioUrl: data.audioUrl,
            audioType: data.audioType,
            addedBy: data.addedBy,
            authorUid: data.authorUid,
            createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
          });
        }
      });
      results.sort((a, b) => b.createdAt - a.createdAt);
      callback(results);
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, collPath);
    }
  );
}

export async function saveTrackAudio(params: {
  trackCode: string;
  trackTitle?: string;
  artistName?: string;
  audioUrl: string;
  audioType?: string;
  addedBy?: string;
}): Promise<TrackAudio> {
  const safeId = `audio_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const path = `track_audios/${safeId}`;

  const audioItem: TrackAudio = {
    id: safeId,
    trackCode: params.trackCode.slice(0, 128),
    trackTitle: (params.trackTitle || '').slice(0, 200),
    artistName: (params.artistName || '').slice(0, 200),
    audioUrl: params.audioUrl.slice(0, 2000),
    audioType: (params.audioType || 'audio/mpeg').slice(0, 50),
    addedBy: (params.addedBy || 'Music Lover').slice(0, 100),
    authorUid: auth.currentUser?.uid || 'anon',
    createdAt: Date.now(),
  };

  try {
    const docRef = doc(db, 'track_audios', safeId);
    await setDoc(docRef, audioItem);
    return audioItem;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}
