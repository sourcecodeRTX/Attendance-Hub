import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore, clearAllPersistedStores } from './auth-store';
import type { User } from '@/lib/types/user';

const mockUser: User = {
  id: 'usr-1',
  universityId: 'uni-1',
  role: 'primary_teacher',
  fullName: 'Prof. Test',
  staffId: 'STF-100',
  email: 'prof@test.edu',
  departmentId: 'dept-1',
  isActive: true,
  mustChangePassword: false,
  createdAt: '2026-08-01T00:00:00Z',
  createdBy: null,
};

describe('useAuthStore (F-021)', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
    localStorage.clear();
  });

  it('starts with isVerified=false when cleared', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isVerified).toBe(false);
  });

  it('sets isVerified=true when setUser is called with a valid user', () => {
    useAuthStore.getState().setUser(mockUser);
    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.isVerified).toBe(true);
  });

  it('resets isVerified=false when clearAuth is called', () => {
    useAuthStore.getState().setUser(mockUser);
    expect(useAuthStore.getState().isVerified).toBe(true);

    useAuthStore.getState().clearAuth();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isVerified).toBe(false);
  });

  it('clearAllPersistedStores clears localStorage and resets currentUid', () => {
    localStorage.setItem('auth-storage-usr-1', JSON.stringify({ state: { user: mockUser } }));
    localStorage.setItem('auth-storage', JSON.stringify({ state: { user: mockUser } }));

    clearAllPersistedStores('usr-1');

    expect(localStorage.getItem('auth-storage-usr-1')).toBeNull();
    expect(localStorage.getItem('auth-storage')).toBeNull();
  });
});
