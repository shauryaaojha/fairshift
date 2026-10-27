export type OutboxKind = 'checkin' | 'checkout' | 'hazard' | 'feedback';

export interface OutboxItem<T = unknown> {
  id: string; // clientId (crypto.randomUUID())
  workerId: string;
  kind: OutboxKind;
  payload: T;
  capturedAt: string; // ISO string
  attempts: number;
}

export interface OutboxStore {
  put(item: OutboxItem): Promise<void>;
  list(workerId?: string): Promise<OutboxItem[]>;
  remove(id: string): Promise<void>;
}

const DB_NAME = 'fairshift-outbox';
const DB_VERSION = 1;
const STORE_NAME = 'outbox';
const WORKER_ID_KEY = 'fairshift:worker-id';

function notifyChange(): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(new CustomEvent('fairshift:outbox-change'));
    } catch {
      // Ignore in non-DOM or restricted environments
    }
  }
}

export class IndexedDbOutboxStore implements OutboxStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
        return reject(new Error('IndexedDB is not available'));
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('workerId', 'workerId', { unique: false });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onclose = () => {
          this.dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        this.dbPromise = null;
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  async put(item: OutboxItem): Promise<void> {
    const db = await this.getDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(item);
      req.onsuccess = () => {
        notifyChange();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  async list(workerId?: string): Promise<OutboxItem[]> {
    const db = await this.getDb();
    return new Promise<OutboxItem[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result || []) as OutboxItem[];
        if (workerId) {
          resolve(items.filter((item) => item.workerId === workerId));
        } else {
          resolve(items);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async remove(id: string): Promise<void> {
    const db = await this.getDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => {
        notifyChange();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }
}

export function createIndexedDbOutboxStore(): OutboxStore {
  return new IndexedDbOutboxStore();
}

export class MemoryOutboxStore implements OutboxStore {
  private items = new Map<string, OutboxItem>();

  async put(item: OutboxItem): Promise<void> {
    this.items.set(item.id, { ...item });
    notifyChange();
  }

  async list(workerId?: string): Promise<OutboxItem[]> {
    const all = Array.from(this.items.values()).map((i) => ({ ...i }));
    if (workerId) {
      return all.filter((i) => i.workerId === workerId);
    }
    return all;
  }

  async remove(id: string): Promise<void> {
    this.items.delete(id);
    notifyChange();
  }

  clear(): void {
    this.items.clear();
    notifyChange();
  }
}

let singletonStore: OutboxStore | null = null;

export function getOutboxStore(): OutboxStore {
  if (singletonStore) return singletonStore;

  if (typeof window !== 'undefined' && typeof indexedDB !== 'undefined') {
    try {
      singletonStore = createIndexedDbOutboxStore();
      return singletonStore;
    } catch {
      // Fall back to MemoryOutboxStore if indexedDB creation fails
    }
  }

  singletonStore = new MemoryOutboxStore();
  return singletonStore;
}

export function setOutboxStoreForTesting(store: OutboxStore | null): void {
  singletonStore = store;
}

export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getActiveWorkerId(): string {
  if (typeof localStorage !== 'undefined') {
    try {
      return localStorage.getItem(WORKER_ID_KEY) || '';
    } catch {
      return '';
    }
  }
  return '';
}

export function setActiveWorkerId(id: string): void {
  if (typeof localStorage !== 'undefined') {
    try {
      if (id) {
        localStorage.setItem(WORKER_ID_KEY, id);
      } else {
        localStorage.removeItem(WORKER_ID_KEY);
      }
    } catch {
      // ignore
    }
  }
}
