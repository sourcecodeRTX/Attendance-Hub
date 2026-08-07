import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createUidStorage } from './uid-storage';

interface PreferencesState {
  sortOrder: 'original' | 'roll_number' | 'name';
  sortDirection: 'asc' | 'desc';
  soundEnabled: boolean;
  setSortOrder: (order: 'original' | 'roll_number' | 'name') => void;
  setSortDirection: (direction: 'asc' | 'desc') => void;
  setSoundEnabled: (enabled: boolean) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      sortOrder: 'original',
      sortDirection: 'asc',
      soundEnabled: true,
      setSortOrder: (sortOrder) => set({ sortOrder }),
      setSortDirection: (sortDirection) => set({ sortDirection }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
    }),
    {
      name: 'prefs-storage',
      storage: createJSONStorage(() => createUidStorage('prefs-storage')),
      partialize: (state) => ({
        sortOrder: state.sortOrder,
        sortDirection: state.sortDirection,
        soundEnabled: state.soundEnabled,
      }),
    }
  )
);
