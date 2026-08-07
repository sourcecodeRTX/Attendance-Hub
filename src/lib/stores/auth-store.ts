import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '@/lib/types/user';
import type { University } from '@/lib/types/university';
import { clearUidScopedStores, createUidStorage, setCurrentUid } from './uid-storage';

interface AuthState {
  user: User | null;
  university: University | null;
  isLoading: boolean;
  isHydrated: boolean;
  setUser: (user: User | null) => void;
  setUniversity: (university: University | null) => void;
  setLoading: (loading: boolean) => void;
  setHydrated: (hydrated: boolean) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      university: null,
      isLoading: true,
      isHydrated: false,
      setUser: (user) => set({ user }),
      setUniversity: (university) => set({ university }),
      setLoading: (isLoading) => set({ isLoading }),
      setHydrated: (isHydrated) => set({ isHydrated }),
      clearAuth: () => set({ user: null, university: null, isLoading: false }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => createUidStorage('auth-storage')),
      partialize: (state) => ({ user: state.user, university: state.university }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHydrated(true);
        }
      },
    }
  )
);

export function getAuthStorageKey(uid: string) {
  return `auth-storage-${uid}`;
}

// Clear all persisted store data from localStorage on logout
export function clearAllPersistedStores(uid?: string | null) {
  if (uid) {
    clearUidScopedStores(uid);
  }

  // Backward-compatible cleanup for legacy global keys.
  localStorage.removeItem('auth-storage');
  localStorage.removeItem('ui-storage');
  localStorage.removeItem('prefs-storage');
  setCurrentUid(null);
}
