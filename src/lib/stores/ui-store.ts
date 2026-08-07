import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createUidStorage } from './uid-storage';

interface UIState {
  syncStatus: 'synced' | 'pending' | 'failed';
  isOffline: boolean;
  setSyncStatus: (status: 'synced' | 'pending' | 'failed') => void;
  setOffline: (offline: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      syncStatus: 'synced',
      isOffline: false,
      setSyncStatus: (syncStatus) => set({ syncStatus }),
      setOffline: (isOffline) => set({ isOffline }),
    }),
    {
      name: 'ui-storage',
      storage: createJSONStorage(() => createUidStorage('ui-storage')),
      partialize: (state) => ({ syncStatus: state.syncStatus }),
    }
  )
);
