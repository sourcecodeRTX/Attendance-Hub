import type { StateStorage } from 'zustand/middleware';

let currentUid: string | null = null;

export function setCurrentUid(uid: string | null) {
  currentUid = uid;
}

export function getCurrentUid() {
  return currentUid;
}

function scopedKey(baseKey: string): string {
  return currentUid ? `${baseKey}-${currentUid}` : baseKey;
}

function isStorageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function migrateLegacyKey(baseKey: string) {
  if (!currentUid || !isStorageAvailable()) return;

  const oldKey = baseKey;
  const newKey = `${baseKey}-${currentUid}`;

  try {
    const legacy = localStorage.getItem(oldKey);
    const scoped = localStorage.getItem(newKey);

    if (legacy && !scoped) {
      localStorage.setItem(newKey, legacy);
      localStorage.removeItem(oldKey);
    }
  } catch (error) {
    console.warn(`Failed migrating legacy storage key: ${baseKey}`, error);
  }
}

export function createUidStorage(baseKey: string): StateStorage {
  return {
    getItem: () => {
      if (!isStorageAvailable()) return null;
      migrateLegacyKey(baseKey);
      try {
        return localStorage.getItem(scopedKey(baseKey));
      } catch {
        return null;
      }
    },
    setItem: (_, value) => {
      if (!isStorageAvailable()) return;
      try {
        localStorage.setItem(scopedKey(baseKey), value);
      } catch (error) {
        console.warn(`Failed setting storage key: ${baseKey}`, error);
      }
    },
    removeItem: () => {
      if (!isStorageAvailable()) return;
      try {
        localStorage.removeItem(scopedKey(baseKey));
      } catch (error) {
        console.warn(`Failed removing storage key: ${baseKey}`, error);
      }
    },
  };
}

export function clearUidScopedStores(uid: string | null) {
  if (!uid || !isStorageAvailable()) return;
  const suffix = `-${uid}`;
  const keysToDelete: string[] = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.endsWith(suffix)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.warn('Failed clearing uid scoped stores', error);
  }
}
