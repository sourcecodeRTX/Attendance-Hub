import { render, screen, cleanup, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Header } from '@/components/layout/header';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useUIStore } from '@/lib/stores/ui-store';
import type { User } from '@/lib/types/user';

vi.mock('@/lib/supabase/auth', () => ({ signOut: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn() }),
}));

const mockUser: User = {
  id: 'user-1',
  email: 'teacher@example.edu',
  fullName: 'Test Teacher',
  role: 'regular_teacher',
  universityId: 'uni-1',
} as unknown as User;

afterEach(() => {
  cleanup();
  useAuthStore.setState({ user: null });
  useUIStore.setState({ syncStatus: 'synced' });
});

describe('Header sync-status announcements', () => {
  it('renders the sync chip as a link named with the current status', () => {
    useAuthStore.setState({ user: mockUser });
    useUIStore.setState({ syncStatus: 'failed' });
    render(<Header />);

    expect(
      screen.getByRole('link', { name: 'Sync status: Failed' })
    ).toHaveAttribute('href', '/sync');
  });

  it('exposes a status live region whose content reflects the current sync state', () => {
    useAuthStore.setState({ user: mockUser });
    useUIStore.setState({ syncStatus: 'failed' });
    render(<Header />);

    expect(screen.getByRole('status')).toHaveTextContent('Failed');
  });

  it('updates the live-region content when the sync status changes', () => {
    useAuthStore.setState({ user: mockUser });
    useUIStore.setState({ syncStatus: 'pending' });
    render(<Header />);

    expect(screen.getByRole('status')).toHaveTextContent('Pending');

    act(() => {
      useUIStore.setState({ syncStatus: 'synced' });
    });
    expect(screen.getByRole('status')).toHaveTextContent('Synced');
  });

  it('renders no live region when there is no user', () => {
    useAuthStore.setState({ user: null });
    render(<Header />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
