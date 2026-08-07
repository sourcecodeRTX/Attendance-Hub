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

function migrateLegacyKey(baseKey: string) {
  if (!currentUid) return;

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
      migrateLegacyKey(baseKey);
      return localStorage.getItem(scopedKey(baseKey));
    },
    setItem: (_, value) => {
      localStorage.setItem(scopedKey(baseKey), value);
    },
    removeItem: () => {
      localStorage.removeItem(scopedKey(baseKey));
    },
  };
}

export function clearUidScopedStores(uid: string | null) {
  if (!uid) return;
  const suffix = `-${uid}`;
  const keysToDelete: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.endsWith(suffix)) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach((key) => localStorage.removeItem(key));
}
