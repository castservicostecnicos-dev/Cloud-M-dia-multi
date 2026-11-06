// IndexedDB Storage Engine for Local Media Files with Firestore Cloud Synchronization
// Allows storing hundreds of megabytes of media on client devices without exceeding Firestore 1MB limits or localStorage 5MB quotas.
// Synchronizes media across all devices (phone, PC, smart TVs) using Firestore binary chunking.

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore/lite';

const DB_NAME = 'IndoorMediaStorage';
const DB_VERSION = 1;
const STORE_NAME = 'media_files';

const PRIMARY_FIRESTORE_CONFIG = {
  projectId: 'deep-freedom-8szp9',
  apiKey: 'AIzaSyCzP6rv9WIneoF9OUDTRppATOsCLOS-vvQ',
  appId: '1:676316244483:web:bc8f3491e953b884c9fc36',
  authDomain: 'deep-freedom-8szp9.firebaseapp.com',
  firestoreDatabaseId: 'ai-studio-remixmdiaindoor2-b21786e5-9cc2-4541-8854-9ca7fb6c84ba',
};

function getClientFirestore() {
  const appName = 'indoor-media-firestore-client';
  const existingApp = getApps().find((a) => a.name === appName);
  const app = existingApp ? existingApp : initializeApp(PRIMARY_FIRESTORE_CONFIG, appName);
  return getFirestore(app, PRIMARY_FIRESTORE_CONFIG.firestoreDatabaseId);
}

// In-memory cache for ultra-fast synchronous lookup when rendering player and thumbnails
const memoryCache = new Map<string, string>();
const activeCloudFetches = new Map<string, Promise<string | null>>();

function sanitizeDocKey(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
}

function openMediaDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return reject(new Error('IndexedDB não suportado neste ambiente.'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function getMediaCandidateKeys(input: any): string[] {
  if (!input) return [];
  const rawKeys: string[] = [];

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return [];
    rawKeys.push(trimmed);
    const withoutPrefix = trimmed.replace(/^idb:/, '').replace(/^\/uploads\//, '').replace(/^\//, '');
    rawKeys.push(withoutPrefix);
    const basename = trimmed.split('/').pop() || '';
    if (basename) {
      rawKeys.push(basename.replace(/^idb:/, ''));
    }
  } else if (typeof input === 'object') {
    if (input.file_url && typeof input.file_url === 'string') {
      const u = input.file_url.trim();
      const withoutPrefix = u.replace(/^idb:/, '').replace(/^\/uploads\//, '').replace(/^\//, '');
      rawKeys.push(withoutPrefix);
      const basename = u.split('/').pop() || '';
      if (basename) rawKeys.push(basename.replace(/^idb:/, ''));
    }
    if (input.id && typeof input.id === 'string') {
      rawKeys.push(input.id.trim().replace(/^idb:/, ''));
    }
    if (input.local_url && typeof input.local_url === 'string') {
      const basename = input.local_url.split('/').pop() || '';
      if (basename) rawKeys.push(basename.replace(/^idb:/, ''));
    }
    if (input.name && typeof input.name === 'string') {
      rawKeys.push(input.name.trim());
    }
  }

  const seen = new Set<string>();
  const sanitized: string[] = [];

  for (const k of rawKeys) {
    if (!k) continue;
    const clean = sanitizeDocKey(k);
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      sanitized.push(clean);
    }
  }

  return sanitized;
}

export async function saveIndexedDbMedia(id: string, dataUrl: string, secondaryFilename?: string): Promise<void> {
  if (!id || !dataUrl) return;
  const cleanId = id.replace(/^idb:/, '');
  const candidateKeys = getMediaCandidateKeys({ id, file_url: secondaryFilename });

  for (const k of candidateKeys) {
    memoryCache.set(k, dataUrl);
  }

  try {
    const db = await openMediaDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({ id: cleanId, dataUrl, updatedAt: Date.now() });

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Erro ao salvar mídia localmente:', err);
  }

  // Backup to cloud chunks so other devices (e.g. PC logging into same account) can access it
  saveMediaBinaryToFirestoreCloud(cleanId, dataUrl).catch(() => {});
  if (secondaryFilename && secondaryFilename !== cleanId) {
    saveMediaBinaryToFirestoreCloud(secondaryFilename, dataUrl).catch(() => {});
  }
}

export async function saveMediaBinaryToFirestoreCloud(keyOrId: string, dataUrl: string): Promise<boolean> {
  try {
    if (!dataUrl || !dataUrl.startsWith('data:')) return false;
    const cleanKey = sanitizeDocKey(keyOrId.replace(/^idb:/, '').replace(/^\/uploads\//, ''));
    if (!cleanKey) return false;

    const parts = dataUrl.split(',');
    if (parts.length < 2) return false;

    const mimeMatch = parts[0].match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const base64Data = parts[1];

    // Limit Firestore binary chunking to files <= 35 MB
    if (base64Data.length > 35 * 1024 * 1024) return false;

    const fs = getClientFirestore();
    const CHUNK_LEN = 700000; // ~700 KB per Firestore doc (well under 1 MB limit)
    const totalChunks = Math.ceil(base64Data.length / CHUNK_LEN);
    const now = new Date().toISOString();

    for (let i = 0; i < totalChunks; i++) {
      const chunkStr = base64Data.slice(i * CHUNK_LEN, (i + 1) * CHUNK_LEN);
      await setDoc(doc(fs, 'app_data', `mbin_${cleanKey}_${i}`), {
        version: 1,
        updated_at: now,
        data: chunkStr,
      });
    }

    await setDoc(doc(fs, 'app_data', `mmeta_${cleanKey}`), {
      version: 1,
      updated_at: now,
      data: JSON.stringify({
        key: cleanKey,
        mimeType,
        totalChunks,
        size: base64Data.length,
      }),
    });

    return true;
  } catch (err: any) {
    console.warn('[Cloud Sync] Não foi possível salvar chunk da mídia no Firestore:', err?.message || err);
    return false;
  }
}

export async function fetchMediaBinaryFromFirestoreCloud(keyOrIdOrMedia: any): Promise<string | null> {
  const candidates = getMediaCandidateKeys(keyOrIdOrMedia);
  if (candidates.length === 0) return null;

  const primaryKey = candidates[0];
  if (activeCloudFetches.has(primaryKey)) {
    return activeCloudFetches.get(primaryKey)!;
  }

  const fetchPromise = (async () => {
    try {
      const fs = getClientFirestore();

      // Try finding the metadata document across all candidates
      let foundMeta: any = null;
      let matchedKey: string | null = null;

      for (const candidate of candidates) {
        try {
          const metaSnap = await getDoc(doc(fs, 'app_data', `mmeta_${candidate}`));
          if (metaSnap.exists()) {
            const raw = metaSnap.data()?.data;
            if (raw) {
              foundMeta = JSON.parse(raw);
              matchedKey = candidate;
              break;
            }
          }
        } catch {}
      }

      if (!foundMeta || !matchedKey) {
        return null;
      }

      const totalChunks = Number(foundMeta.totalChunks || 0);
      if (totalChunks <= 0) return null;

      const parts: string[] = [];
      for (let i = 0; i < totalChunks; i++) {
        const chunkSnap = await getDoc(doc(fs, 'app_data', `mbin_${matchedKey}_${i}`));
        if (!chunkSnap.exists()) return null;
        parts.push(chunkSnap.data()?.data || '');
      }

      const fullBase64 = parts.join('');
      const dataUrl = `data:${foundMeta.mimeType || 'image/jpeg'};base64,${fullBase64}`;

      // Save into local IndexedDB and memoryCache under all candidates so future renders are instant
      for (const c of candidates) {
        memoryCache.set(c, dataUrl);
      }
      try {
        const db = await openMediaDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        for (const c of candidates) {
          store.put({ id: c, dataUrl, updatedAt: Date.now() });
        }
      } catch {}

      return dataUrl;
    } catch (err: any) {
      console.warn('[Cloud Sync] Erro ao recuperar mídia do Firestore Cloud:', err?.message || err);
      return null;
    } finally {
      activeCloudFetches.delete(primaryKey);
    }
  })();

  activeCloudFetches.set(primaryKey, fetchPromise);
  return fetchPromise;
}

export async function getIndexedDbMedia(keyOrIdOrMedia: any): Promise<string | null> {
  if (!keyOrIdOrMedia) return null;
  const candidates = getMediaCandidateKeys(keyOrIdOrMedia);
  if (candidates.length === 0) return null;

  // 1. Check memory cache first
  for (const c of candidates) {
    if (memoryCache.has(c)) {
      return memoryCache.get(c)!;
    }
  }

  // 2. Check local browser IndexedDB
  try {
    const db = await openMediaDB();
    for (const c of candidates) {
      const localResult = await new Promise<string | null>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(c);

          req.onsuccess = () => {
            if (req.result?.dataUrl) {
              resolve(req.result.dataUrl);
            } else {
              resolve(null);
            }
          };
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });

      if (localResult) {
        for (const k of candidates) {
          memoryCache.set(k, localResult);
        }
        return localResult;
      }
    }
  } catch {}

  // 3. Not found locally: this device (PC or another phone) needs the cloud backup!
  // Reconstruct seamlessly from Firestore cloud binary chunks
  const cloudResult = await fetchMediaBinaryFromFirestoreCloud(keyOrIdOrMedia);
  return cloudResult;
}

export function getCachedIndexedDbMediaSync(keyOrIdOrMedia: any): string | null {
  const candidates = getMediaCandidateKeys(keyOrIdOrMedia);
  for (const c of candidates) {
    const cached = memoryCache.get(c);
    if (cached) return cached;
  }
  return null;
}

export async function deleteIndexedDbMedia(keyOrIdOrMedia: any): Promise<void> {
  if (!keyOrIdOrMedia) return;
  const candidates = getMediaCandidateKeys(keyOrIdOrMedia);
  if (typeof keyOrIdOrMedia === 'string') {
    const raw = keyOrIdOrMedia.trim();
    if (raw) {
      candidates.push(raw);
      candidates.push(raw.replace(/^idb:/, '').replace(/^\/uploads\//, ''));
    }
  }

  for (const c of candidates) {
    memoryCache.delete(c);
  }

  try {
    const db = await openMediaDB();
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        for (const c of candidates) {
          store.delete(c);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {}
}

