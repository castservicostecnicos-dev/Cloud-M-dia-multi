import { initializeApp, getApps, getApp, setLogLevel as setAppLogLevel } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  setLogLevel as setFirestoreLogLevel,
  Firestore,
} from 'firebase/firestore/lite';
import fs from 'fs';
import path from 'path';

// Silence internal Firebase SDK warnings (such as idle gRPC stream disconnects)
try {
  setAppLogLevel('silent');
  setFirestoreLogLevel('silent');
} catch {
  // Ignore if log level setting fails
}

let firestoreInstance: Firestore | null = null;
let lastSyncTimestamp: string | null = null;
let lastSyncError: string | null = null;
let isSyncing = false;
let isSyncEnabled = false;
let pendingDataToSync: any = null;
let syncDebounceTimer: NodeJS.Timeout | null = null;

export interface FirebaseConfigShape {
  projectId: string;
  apiKey: string;
  appId?: string;
  authDomain?: string;
  firestoreDatabaseId?: string;
}

export type FirestoreLoadResult =
  | { status: 'found'; data: any }
  | { status: 'not_found' }
  | { status: 'error'; error: string }
  | { status: 'unconfigured' };

const PRIMARY_FIRESTORE_CONFIG: FirebaseConfigShape = {
  projectId: 'deep-freedom-8szp9',
  apiKey: 'AIzaSyCzP6rv9WIneoF9OUDTRppATOsCLOS-vvQ',
  appId: '1:676316244483:web:bc8f3491e953b884c9fc36',
  authDomain: 'deep-freedom-8szp9.firebaseapp.com',
  firestoreDatabaseId: 'ai-studio-remixmdiaindoor2-b21786e5-9cc2-4541-8854-9ca7fb6c84ba',
};

/**
 * Retrieve Firebase credentials from environment variables or primary Firestore configuration
 */
export function getFirebaseConfig(): FirebaseConfigShape | null {
  // 1. Try individual env variables if explicitly set to a custom Firestore project
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_API_KEY) {
    return {
      projectId: process.env.FIREBASE_PROJECT_ID,
      apiKey: process.env.FIREBASE_API_KEY,
      appId: process.env.FIREBASE_APP_ID || PRIMARY_FIRESTORE_CONFIG.appId,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || `${process.env.FIREBASE_PROJECT_ID}.firebaseapp.com`,
      firestoreDatabaseId:
        process.env.FIRESTORE_DATABASE_ID || PRIMARY_FIRESTORE_CONFIG.firestoreDatabaseId,
    };
  }

  // 2. Always return the persistent Firestore database configuration (deep-freedom-8szp9)
  return PRIMARY_FIRESTORE_CONFIG;
}

export function getFirestoreDb(): Firestore | null {
  if (firestoreInstance) {
    return firestoreInstance;
  }

  try {
    const config = getFirebaseConfig();
    if (!config) {
      console.warn('[Firebase] No Firebase credentials found in file or environment variables.');
      return null;
    }

    const appName = 'indoor-media-firestore-server';
    const existingApp = getApps().find((a) => a.name === appName);
    const app = existingApp
      ? existingApp
      : initializeApp(
          {
            projectId: config.projectId,
            apiKey: config.apiKey,
            appId: config.appId,
            authDomain: config.authDomain,
          },
          appName
        );

    const dbId =
      config.firestoreDatabaseId ||
      'ai-studio-remixmdiaindoor2-b21786e5-9cc2-4541-8854-9ca7fb6c84ba';
    firestoreInstance = dbId
      ? getFirestore(app, dbId)
      : getFirestore(app);

    console.log(`[Firebase Firestore] Connected to project: ${config.projectId} (${dbId || 'default'})`);
    return firestoreInstance;
  } catch (err: any) {
    console.error('[Firebase Firestore] Failed to initialize Firestore:', err?.message || err);
    lastSyncError = err?.message || 'Initialization failed';
    return null;
  }
}

/**
 * Enable live two-way sync after server boot completes
 */
export function enableFirestoreSync() {
  isSyncEnabled = true;
  console.log('[Firebase Firestore] Live synchronization is now ACTIVE.');
}

export const FIRESTORE_DOCUMENT_ID =
  process.env.FIRESTORE_DOCUMENT_ID || 'indoor_media_cloudflare_db';

/**
 * Load database snapshot from Firebase Firestore with explicit status
 */
export async function loadDatabaseFromFirestore(): Promise<FirestoreLoadResult> {
  const db = getFirestoreDb();
  if (!db) {
    return { status: 'unconfigured' };
  }

  try {
    const targetDoc = doc(db, 'app_data', FIRESTORE_DOCUMENT_ID);
    const snap = await Promise.race([
      getDoc(targetDoc),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Firestore read timeout after 5s')), 5000)
      ),
    ]);

    if (!snap.exists()) {
      console.log(`[Firebase Firestore] Document app_data/${FIRESTORE_DOCUMENT_ID} does not exist yet (first initialization).`);
      return { status: 'not_found' };
    }

    const docData = snap.data();
    if (!docData || !docData.data) {
      console.warn('[Firebase Firestore] Snapshot document is empty.');
      return { status: 'not_found' };
    }

    const parsed = JSON.parse(docData.data);
    lastSyncTimestamp = docData.updated_at || new Date().toISOString();
    console.log(`[Firebase Firestore] Successfully retrieved data snapshot! Companies: ${parsed.companies?.length || 0}, Players: ${parsed.players?.length || 0}, Users: ${parsed.users?.length || 0}`);
    return { status: 'found', data: parsed };
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.warn('[Firebase Firestore] Cloud read skipped or failed (using local database):', msg);
    lastSyncError = msg;
    return { status: 'error', error: msg };
  }
}

/**
 * Save database snapshot directly to Firebase Firestore
 */
export async function saveDatabaseToFirestoreNow(data: any): Promise<boolean> {
  const db = getFirestoreDb();
  if (!db) return false;

  // Safety validation: verify minimum database structure to prevent accidental empty overwrites
  if (
    !data ||
    !Array.isArray(data.users) ||
    !data.users.some((u: any) => u.role === 'admin') ||
    !Array.isArray(data.companies) ||
    data.companies.length === 0
  ) {
    console.error('[Firebase Firestore] ABORTED save to Firestore: data is invalid, missing admin user, or has 0 companies!');
    return false;
  }

  try {
    const targetDoc = doc(db, 'app_data', FIRESTORE_DOCUMENT_ID);
    const sanitized = JSON.parse(JSON.stringify(data));
    const now = new Date().toISOString();

    await setDoc(targetDoc, {
      version: 1,
      updated_at: now,
      stats: {
        companies: sanitized.companies?.length || 0,
        company_stores: sanitized.company_stores?.length || 0,
        players: sanitized.players?.length || 0,
        users: sanitized.users?.length || 0,
        playlists: sanitized.playlists?.length || 0,
        media: sanitized.media?.length || 0,
      },
      data: JSON.stringify(sanitized),
    });

    lastSyncTimestamp = now;
    lastSyncError = null;
    console.log(`[Firebase Firestore] Database synced successfully at ${now} (Companies: ${sanitized.companies?.length || 0}, Stores: ${sanitized.company_stores?.length || 0})`);
    return true;
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    console.warn('[Firebase Firestore] Cloud sync skipped or failed (local persistence remains active):', errMsg);
    lastSyncError = errMsg;
    return false;
  }
}

/**
 * Queue debounced background sync to Firestore
 */
export function queueFirestoreSync(data: any) {
  if (!isSyncEnabled) {
    console.log('[Firebase Firestore] Sync is paused during initial startup.');
    return;
  }

  pendingDataToSync = data;

  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
  }

  syncDebounceTimer = setTimeout(async () => {
    if (isSyncing || !pendingDataToSync) return;

    isSyncing = true;
    const toSave = pendingDataToSync;
    pendingDataToSync = null;

    try {
      await saveDatabaseToFirestoreNow(toSave);
    } finally {
      isSyncing = false;
      // If new data arrived while saving, trigger another sync
      if (pendingDataToSync && isSyncEnabled) {
        queueFirestoreSync(pendingDataToSync);
      }
    }
  }, 1000);
}

export function getFirestoreSyncStatus() {
  const isConfigured = !!getFirestoreDb();
  return {
    configured: isConfigured,
    provider: 'Firebase Firestore',
    lastSyncTimestamp,
    lastSyncError,
    isSyncing,
    isSyncEnabled,
  };
}

function sanitizeDocKey(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
}

/**
 * Backup uploaded media binary in Firestore chunks (up to 15 MB) so files survive container redeployments
 */
export async function saveMediaBinaryToFirestore(
  filename: string,
  mimeType: string,
  buffer: Buffer
): Promise<boolean> {
  const db = getFirestoreDb();
  if (!db) return false;

  // Limit Firestore binary chunking to files <= 15 MB (larger videos rely on Google Drive or disk)
  if (buffer.length > 15 * 1024 * 1024) {
    return false;
  }

  try {
    const base64 = buffer.toString('base64');
    const CHUNK_LEN = 700000; // ~700 KB per Firestore doc (well under 1 MB limit)
    const totalChunks = Math.ceil(base64.length / CHUNK_LEN);
    const key = sanitizeDocKey(filename);
    const now = new Date().toISOString();

    for (let i = 0; i < totalChunks; i++) {
      const chunkStr = base64.slice(i * CHUNK_LEN, (i + 1) * CHUNK_LEN);
      await setDoc(doc(db, 'app_data', `mbin_${key}_${i}`), {
        version: 1,
        updated_at: now,
        data: chunkStr,
      });
    }

    await setDoc(doc(db, 'app_data', `mmeta_${key}`), {
      version: 1,
      updated_at: now,
      data: JSON.stringify({
        filename,
        mimeType,
        size: buffer.length,
        totalChunks,
      }),
    });

    return true;
  } catch (err: any) {
    console.warn('[Firebase Firestore] Could not backup media binary to cloud:', err?.message || err);
    return false;
  }
}

/**
 * Restore uploaded media binary from Firestore chunks if missing from local /uploads after a deploy
 */
export async function loadMediaBinaryFromFirestore(filename: string): Promise<Buffer | null> {
  const db = getFirestoreDb();
  if (!db) return null;

  try {
    const key = sanitizeDocKey(filename);
    const metaSnap = await getDoc(doc(db, 'app_data', `mmeta_${key}`));
    if (!metaSnap.exists()) return null;

    const metaRaw = metaSnap.data()?.data;
    if (!metaRaw) return null;
    const meta = JSON.parse(metaRaw);
    const totalChunks = Number(meta.totalChunks || 0);
    if (totalChunks <= 0) return null;

    const parts: string[] = [];
    for (let i = 0; i < totalChunks; i++) {
      const chunkSnap = await getDoc(doc(db, 'app_data', `mbin_${key}_${i}`));
      if (!chunkSnap.exists()) return null;
      parts.push(chunkSnap.data()?.data || '');
    }

    return Buffer.from(parts.join(''), 'base64');
  } catch (err: any) {
    console.warn('[Firebase Firestore] Failed to restore media binary from cloud:', err?.message || err);
    return null;
  }
}

