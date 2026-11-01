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

export async function saveIndexedDbMedia(id: string, dataUrl: string): Promise<void> {
  if (!id || !dataUrl) return;
  const cleanId = id.replace(/^idb:/, '');
  memoryCache.set(cleanId, dataUrl);

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
}

export async function saveMediaBinaryToFirestoreCloud(keyOrId: string, dataUrl: string): Promise<boolean> {
  try {
    if (!dataUrl || !dataUrl.startsWith('data:')) return false;
    const cleanKey = sanitizeDocKey(keyOrId.replace(/^idb:/, ''));
    const parts = dataUrl.split(',');
    if (parts.length < 2) return false;

    const mimeMatch = parts[0].match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const base64Data = parts[1];

    // Limit Firestore binary chunking to files <= 15 MB
    if (base64Data.length > 20 * 1024 * 1024) return false;

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

export async function fetchMediaBinaryFromFirestoreCloud(keyOrId: string): Promise<string | null> {
  const cleanKey = sanitizeDocKey(keyOrId.replace(/^idb:/, '').replace(/^\/uploads\//, ''));
  if (activeCloudFetches.has(cleanKey)) {
    return activeCloudFetches.get(cleanKey)!;
  }

  const fetchPromise = (async () => {
    try {
      const fs = getClientFirestore();
      const metaSnap = await getDoc(doc(fs, 'app_data', `mmeta_${cleanKey}`));
      if (!metaSnap.exists()) return null;

      const metaRaw = metaSnap.data()?.data;
      if (!metaRaw) return null;
      const meta = JSON.parse(metaRaw);
      const totalChunks = Number(meta.totalChunks || 0);
      if (totalChunks <= 0) return null;

      const parts: string[] = [];
      for (let i = 0; i < totalChunks; i++) {
        const chunkSnap = await getDoc(doc(fs, 'app_data', `mbin_${cleanKey}_${i}`));
        if (!chunkSnap.exists()) return null;
        parts.push(chunkSnap.data()?.data || '');
      }

      const fullBase64 = parts.join('');
      const dataUrl = `data:${meta.mimeType || 'application/octet-stream'};base64,${fullBase64}`;

      // Save into local IndexedDB and memoryCache so subsequent renders are instantaneous
      memoryCache.set(cleanKey, dataUrl);
      try {
        const db = await openMediaDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put({ id: cleanKey, dataUrl, updatedAt: Date.now() });
      } catch {}

      return dataUrl;
    } catch (err: any) {
      console.warn('[Cloud Sync] Erro ao recuperar mídia do Firestore Cloud:', err?.message || err);
      return null;
    } finally {
      activeCloudFetches.delete(cleanKey);
    }
  })();

  activeCloudFetches.set(cleanKey, fetchPromise);
  return fetchPromise;
}

export async function getIndexedDbMedia(id: string): Promise<string | null> {
  if (!id) return null;
  const cleanId = id.replace(/^idb:/, '').replace(/^\/uploads\//, '');

  if (memoryCache.has(cleanId)) {
    return memoryCache.get(cleanId)!;
  }

  try {
    const db = await openMediaDB();
    const localResult = await new Promise<string | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(cleanId);

      req.onsuccess = () => {
        if (req.result?.dataUrl) {
          memoryCache.set(cleanId, req.result.dataUrl);
          resolve(req.result.dataUrl);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });

    if (localResult) return localResult;
  } catch {}

  // If not found in local IndexedDB (e.g. user uploaded from phone, now viewing on PC),
  // recover directly from Firestore cloud chunks!
  const cloudResult = await fetchMediaBinaryFromFirestoreCloud(cleanId);
  return cloudResult;
}

export function getCachedIndexedDbMediaSync(id: string): string | null {
  const cleanId = id.replace(/^idb:/, '').replace(/^\/uploads\//, '');
  return memoryCache.get(cleanId) || null;
}

export async function deleteIndexedDbMedia(id: string): Promise<void> {
  const cleanId = id.replace(/^idb:/, '').replace(/^\/uploads\//, '');
  memoryCache.delete(cleanId);

  try {
    const db = await openMediaDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(cleanId);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {}
}
