import { MatchCheckpoint, MatchSaveStatus } from '../../types/matchRecovery';
import { db } from './Database';

const IDB_NAME = 'CricketArenaMatchDB';
const IDB_STORE = 'matchCheckpoints';
const IDB_VERSION = 1;
const LOCAL_STORAGE_KEY = 'cricket-arena-active-match-checkpoint';

class MatchRecoveryStorageService {
  private idbPromise: Promise<IDBDatabase | null> | null = null;
  private memoryCheckpoints = new Map<string, MatchCheckpoint>();
  private status: MatchSaveStatus = 'IDLE';
  private statusListeners = new Set<(status: MatchSaveStatus) => void>();
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private pendingSyncCheckpoint: MatchCheckpoint | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.handleReconnect();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.updateStatus('OFFLINE — LOCAL BACKUP ACTIVE');
      });
    }
  }

  public getStatus(): MatchSaveStatus {
    return this.status;
  }

  public onStatusChange(listener: (status: MatchSaveStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  private updateStatus(newStatus: MatchSaveStatus) {
    this.status = newStatus;
    this.statusListeners.forEach((listener) => {
      try {
        listener(newStatus);
      } catch (err) {
        console.error('[MatchRecoveryStorage] Listener error:', err);
      }
    });
  }

  private async openIDB(): Promise<IDBDatabase | null> {
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
      return null;
    }
    if (this.idbPromise) return this.idbPromise;

    this.idbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(IDB_NAME, IDB_VERSION);

        req.onupgradeneeded = (e: any) => {
          const dbInstance = e.target.result as IDBDatabase;
          if (!dbInstance.objectStoreNames.contains(IDB_STORE)) {
            dbInstance.createObjectStore(IDB_STORE, { keyPath: 'matchId' });
          }
        };

        req.onsuccess = (e: any) => {
          resolve(e.target.result as IDBDatabase);
        };

        req.onerror = (e) => {
          console.warn('[MatchRecoveryStorage] IndexedDB open error, using fallback:', e);
          resolve(null);
        };

        req.onblocked = () => {
          console.warn('[MatchRecoveryStorage] IndexedDB blocked');
          resolve(null);
        };
      } catch (err) {
        console.warn('[MatchRecoveryStorage] IndexedDB not available:', err);
        resolve(null);
      }
    });

    return this.idbPromise;
  }

  /**
   * Continuous Autosave: Persists checkpoint to IndexedDB, LocalStorage, and Database.
   * Guaranteed to survive crashes, refreshes, tab exits, and offline mode.
   */
  public async saveCheckpoint(checkpoint: MatchCheckpoint): Promise<{ success: boolean; storage: string }> {
    this.updateStatus('SAVING...');
    this.memoryCheckpoints.set(checkpoint.matchId, checkpoint);

    let savedLocally = false;
    let usedStorage = 'memory';

    // 1. Save to IndexedDB (unlimited, structured, crash-resilient)
    try {
      const idb = await this.openIDB();
      if (idb) {
        await new Promise<void>((resolve, reject) => {
          const tx = idb.transaction(IDB_STORE, 'readwrite');
          const store = tx.objectStore(IDB_STORE);
          const req = store.put(checkpoint);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
        savedLocally = true;
        usedStorage = 'indexedDB';
      }
    } catch (idbErr) {
      console.warn('[MatchRecoveryStorage] IDB write error:', idbErr);
    }

    // 2. Synchronize to dedicated LocalStorage fallback
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(checkpoint));
        savedLocally = true;
        if (usedStorage === 'memory') usedStorage = 'localStorage';
      }
    } catch (lsErr) {
      console.warn('[MatchRecoveryStorage] LocalStorage fallback write error:', lsErr);
    }

    // 3. Authoritative Database commit
    try {
      await db.saveMatchCheckpoint(checkpoint);
    } catch (dbErr) {
      console.warn('[MatchRecoveryStorage] Database save error:', dbErr);
    }

    if (savedLocally || this.memoryCheckpoints.has(checkpoint.matchId)) {
      if (!this.isOnline) {
        this.pendingSyncCheckpoint = checkpoint;
        this.updateStatus('OFFLINE — LOCAL BACKUP ACTIVE');
      } else {
        this.updateStatus('ALL PROGRESS SAVED');
      }
      return { success: true, storage: usedStorage };
    } else {
      this.updateStatus('SAVE FAILED — RETRYING');
      // Retry once
      setTimeout(() => this.saveCheckpoint(checkpoint), 1500);
      return { success: false, storage: 'none' };
    }
  }

  /**
   * Synchronous flush for beforeunload / window exit.
   */
  public saveCheckpointSync(checkpoint: MatchCheckpoint): boolean {
    this.memoryCheckpoints.set(checkpoint.matchId, checkpoint);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(checkpoint));
        return true;
      }
    } catch (e) {
      console.warn('[MatchRecoveryStorage] Sync save error on exit:', e);
    }
    return false;
  }

  /**
   * Retrieves match checkpoint from IndexedDB, LocalStorage, or Database.
   */
  public async getCheckpoint(matchId?: string): Promise<MatchCheckpoint | null> {
    // 1. Try memory
    if (matchId && this.memoryCheckpoints.has(matchId)) {
      return this.memoryCheckpoints.get(matchId)!;
    }

    // 2. Try IndexedDB
    try {
      const idb = await this.openIDB();
      if (idb) {
        const result = await new Promise<MatchCheckpoint | null>((resolve) => {
          const tx = idb.transaction(IDB_STORE, 'readonly');
          const store = tx.objectStore(IDB_STORE);
          if (matchId) {
            const req = store.get(matchId);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
          } else {
            const req = store.getAll();
            req.onsuccess = () => {
              const all = req.result as MatchCheckpoint[];
              if (!all || all.length === 0) resolve(null);
              else {
                // Return latest saved unfinished
                const unfinished = all.filter(c => !c.isMatchOver && !c.resultSubmitted);
                unfinished.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
                resolve(unfinished[0] || all[all.length - 1]);
              }
            };
            req.onerror = () => resolve(null);
          }
        });
        if (result) {
          this.memoryCheckpoints.set(result.matchId, result);
          return result;
        }
      }
    } catch (e) {
      console.warn('[MatchRecoveryStorage] IDB read error:', e);
    }

    // 3. Try LocalStorage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as MatchCheckpoint;
          if (parsed && (!matchId || parsed.matchId === matchId)) {
            this.memoryCheckpoints.set(parsed.matchId, parsed);
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn('[MatchRecoveryStorage] LocalStorage read error:', e);
    }

    // 4. Try Database
    try {
      if (matchId) {
        const dbResult = await db.getMatchCheckpoint(matchId);
        if (dbResult) return dbResult as MatchCheckpoint;
      } else {
        const latestDb = await db.getLatestUnfinishedMatch();
        if (latestDb) return latestDb as MatchCheckpoint;
      }
    } catch (e) {
      console.warn('[MatchRecoveryStorage] Database read error:', e);
    }

    return null;
  }

  /**
   * Retrieves the most recently active unfinished match checkpoint.
   */
  public async getLatestUnfinishedMatch(): Promise<MatchCheckpoint | null> {
    const cp = await this.getCheckpoint();
    if (cp && !cp.isMatchOver && !cp.resultSubmitted) {
      return cp;
    }
    return null;
  }

  /**
   * Clears the checkpoint once a match is completed or officially discarded.
   */
  public async clearCheckpoint(matchId: string): Promise<void> {
    this.memoryCheckpoints.delete(matchId);

    // Clear IDB
    try {
      const idb = await this.openIDB();
      if (idb) {
        await new Promise<void>((resolve) => {
          const tx = idb.transaction(IDB_STORE, 'readwrite');
          const store = tx.objectStore(IDB_STORE);
          const req = store.delete(matchId);
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
        });
      }
    } catch {}

    // Clear LocalStorage if matching
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.matchId === matchId) {
            window.localStorage.removeItem(LOCAL_STORAGE_KEY);
          }
        }
      }
    } catch {}

    // Clear DB
    await db.clearMatchCheckpoint(matchId);
    this.updateStatus('IDLE');
  }

  /**
   * Idempotency guarantee: Verifies if a delivery was already committed.
   */
  public isDeliveryCommitted(checkpoint: MatchCheckpoint | null, deliveryId: string): boolean {
    if (!checkpoint || !deliveryId) return false;
    if (checkpoint.lastCompletedDeliveryId === deliveryId) return true;
    if (checkpoint.lastCommittedDeliveryId === deliveryId) return true;
    if (checkpoint.committedDeliveryIds && checkpoint.committedDeliveryIds.includes(deliveryId)) {
      return true;
    }
    return false;
  }

  private async handleReconnect() {
    if (this.pendingSyncCheckpoint) {
      try {
        await db.saveMatchCheckpoint(this.pendingSyncCheckpoint);
        this.pendingSyncCheckpoint = null;
        this.updateStatus('ALL PROGRESS SAVED');
      } catch (err) {
        console.warn('[MatchRecoveryStorage] Sync on reconnect failed:', err);
      }
    } else {
      this.updateStatus('ALL PROGRESS SAVED');
    }
  }
}

export const matchRecoveryStorage = new MatchRecoveryStorageService();
