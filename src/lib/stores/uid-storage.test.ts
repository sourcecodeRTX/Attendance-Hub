import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createUidStorage,
  setCurrentUid,
  getCurrentUid,
  clearUidScopedStores,
} from './uid-storage';

describe('uid-storage', () => {
  beforeEach(() => {
    localStorage.clear();
    setCurrentUid(null);
  });

  afterEach(() => {
    localStorage.clear();
    setCurrentUid(null);
  });

  describe('currentUid management', () => {
    it('sets and gets the current user ID', () => {
      expect(getCurrentUid()).toBeNull();
      setCurrentUid('user-123');
      expect(getCurrentUid()).toBe('user-123');
      setCurrentUid(null);
      expect(getCurrentUid()).toBeNull();
    });
  });

  describe('createUidStorage without active uid', () => {
    it('reads and writes to baseKey when currentUid is null', () => {
      const storage = createUidStorage('test-storage');

      expect(storage.getItem('test-storage')).toBeNull();

      storage.setItem('test-storage', JSON.stringify({ count: 1 }));
      expect(localStorage.getItem('test-storage')).toBe(JSON.stringify({ count: 1 }));
      expect(storage.getItem('test-storage')).toBe(JSON.stringify({ count: 1 }));

      storage.removeItem('test-storage');
      expect(localStorage.getItem('test-storage')).toBeNull();
      expect(storage.getItem('test-storage')).toBeNull();
    });
  });

  describe('createUidStorage with active uid', () => {
    it('scopes storage keys to the active user ID', () => {
      setCurrentUid('user-a');
      const storage = createUidStorage('prefs-storage');

      storage.setItem('prefs-storage', JSON.stringify({ sound: true }));
      expect(localStorage.getItem('prefs-storage-user-a')).toBe(JSON.stringify({ sound: true }));
      expect(localStorage.getItem('prefs-storage')).toBeNull();
      expect(storage.getItem('prefs-storage')).toBe(JSON.stringify({ sound: true }));

      // Switch user
      setCurrentUid('user-b');
      expect(storage.getItem('prefs-storage')).toBeNull();

      storage.setItem('prefs-storage', JSON.stringify({ sound: false }));
      expect(localStorage.getItem('prefs-storage-user-b')).toBe(JSON.stringify({ sound: false }));
      expect(localStorage.getItem('prefs-storage-user-a')).toBe(JSON.stringify({ sound: true }));
    });

    it('migrates legacy unscoped keys to scoped keys on read', () => {
      // Simulate legacy unscoped key from older app versions
      localStorage.setItem('prefs-storage', JSON.stringify({ migrated: true }));

      setCurrentUid('user-migrated');
      const storage = createUidStorage('prefs-storage');

      const value = storage.getItem('prefs-storage');
      expect(value).toBe(JSON.stringify({ migrated: true }));
      expect(localStorage.getItem('prefs-storage-user-migrated')).toBe(JSON.stringify({ migrated: true }));
      expect(localStorage.getItem('prefs-storage')).toBeNull();
    });

    it('does not overwrite existing scoped key during legacy migration', () => {
      localStorage.setItem('prefs-storage', JSON.stringify({ legacy: true }));
      localStorage.setItem('prefs-storage-user-1', JSON.stringify({ scoped: true }));

      setCurrentUid('user-1');
      const storage = createUidStorage('prefs-storage');

      const value = storage.getItem('prefs-storage');
      expect(value).toBe(JSON.stringify({ scoped: true }));
      // Legacy key was not touched because scoped already existed
      expect(localStorage.getItem('prefs-storage-user-1')).toBe(JSON.stringify({ scoped: true }));
    });
  });

  describe('clearUidScopedStores', () => {
    it('deletes all keys ending with -<uid> and leaves other keys intact', () => {
      localStorage.setItem('auth-storage-user-1', 'data1');
      localStorage.setItem('prefs-storage-user-1', 'data2');
      localStorage.setItem('ui-storage-user-1', 'data3');
      localStorage.setItem('auth-storage-user-2', 'data4');
      localStorage.setItem('global-config', 'data5');

      clearUidScopedStores('user-1');

      expect(localStorage.getItem('auth-storage-user-1')).toBeNull();
      expect(localStorage.getItem('prefs-storage-user-1')).toBeNull();
      expect(localStorage.getItem('ui-storage-user-1')).toBeNull();
      expect(localStorage.getItem('auth-storage-user-2')).toBe('data4');
      expect(localStorage.getItem('global-config')).toBe('data5');
    });

    it('handles null or empty uid cleanly as a no-op', () => {
      localStorage.setItem('key-1', 'val');
      clearUidScopedStores(null);
      clearUidScopedStores('');
      expect(localStorage.getItem('key-1')).toBe('val');
    });
  });
});
