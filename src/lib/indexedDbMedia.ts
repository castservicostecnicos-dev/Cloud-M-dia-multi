// IndexedDB Storage Engine for Local Media Files
// Allows storing hundreds of megabytes of media on client devices without exceeding Firestore 1MB limits or localStorage 5MB quotas.

const DB_NAME = 'IndoorMediaStorage';
const DB_VERSION = 1;
const STORE_NAME = 'media_files';

// In-memory cache for ultra-fast synchronous lookup when rendering player and thumbnails
const memoryCache = new Map<string, string>();

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
  memoryCache.set(id, dataUrl);

  try {
    const db = await openMediaDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({ id, dataUrl, updatedAt: Date.now() });

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Erro ao salvar mídia localmente:', err);
  }
}

export async function getIndexedDbMedia(id: string): Promise<string | null> {
  if (!id) return null;
  const cleanId = id.replace(/^idb:/, '');

  if (memoryCache.has(cleanId)) {
    return memoryCache.get(cleanId)!;
  }

  try {
    const db = await openMediaDB();
    return await new Promise<string | null>((resolve) => {
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
  } catch {
    return null;
  }
}

export function getCachedIndexedDbMediaSync(id: string): string | null {
  const cleanId = id.replace(/^idb:/, '');
  return memoryCache.get(cleanId) || null;
}

export async function deleteIndexedDbMedia(id: string): Promise<void> {
  const cleanId = id.replace(/^idb:/, '');
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
