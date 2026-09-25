/**
 * RentVault Client-Side Binary Document Storage
 * 
 * Uses browser native IndexedDB to store raw Blob / File binary data
 * with virtually unlimited quota, preventing QuotaExceededError in localStorage.
 * 
 * Provides instant blob URLs (URL.createObjectURL) so users can view and download
 * the exact PDF / image files they uploaded.
 */

const DB_NAME = 'RentVaultDocsDB';
const DB_VERSION = 1;
const STORE_NAME = 'document_files';

export interface StoredDocumentBinary {
  key: string;
  blob: Blob;
  mimeType: string;
  fileName: string;
  updatedAt: number;
}

// In-memory fallback if IndexedDB is unavailable
const memoryFallback = new Map<string, StoredDocumentBinary>();

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Stores a file or blob in IndexedDB under a unique key (or multiple keys, like docId and storagePath).
 */
export async function storeDocumentFile(
  key: string,
  fileOrBlob: Blob | File,
  fileName?: string,
  mimeType?: string
): Promise<void> {
  const name = fileName || (fileOrBlob instanceof File ? fileOrBlob.name : 'document.pdf');
  const type = mimeType || fileOrBlob.type || 'application/pdf';

  const entry: StoredDocumentBinary = {
    key,
    blob: fileOrBlob,
    mimeType: type,
    fileName: name,
    updatedAt: Date.now(),
  };

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(entry);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Falling back to in-memory document storage:', err);
    memoryFallback.set(key, entry);
  }
}

/**
 * Retrieves a stored file binary from IndexedDB.
 */
export async function getDocumentFile(key: string): Promise<StoredDocumentBinary | null> {
  if (!key) return null;

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result as StoredDocumentBinary);
        } else {
          resolve(memoryFallback.get(key) || null);
        }
      };
      request.onerror = () => {
        resolve(memoryFallback.get(key) || null);
      };
    });
  } catch {
    return memoryFallback.get(key) || null;
  }
}

/**
 * Returns a working URL for the document:
 * Creates a browser blob: URL if the binary exists in IndexedDB, or null if not found.
 */
export async function getDocumentBlobUrl(key: string): Promise<string | null> {
  const stored = await getDocumentFile(key);
  if (!stored || !stored.blob) return null;

  try {
    return URL.createObjectURL(stored.blob);
  } catch (e) {
    console.warn('Failed to create object URL:', e);
    return null;
  }
}

/**
 * Deletes a stored document file from IndexedDB.
 */
export async function deleteDocumentFile(key: string): Promise<void> {
  memoryFallback.delete(key);
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  } catch {
    // Ignore error
  }
}

/**
 * Helper to convert a File/Blob to Base64 data URL for small files (< 3MB).
 */
export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
