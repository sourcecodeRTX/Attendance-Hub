import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Header } from '@/components/layout/header';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useUIStore } from '@/lib/stores/ui-store';
import type { User } from '@/lib/types/user';

const mockPush = vi.fn();
vi.mock('@/lib/supabase/auth', () => ({ signOut: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: mockPush }),
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
  vi.clearAllMocks();
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

  it('opens confirmation dialog on clicking sign out in dropdown and completes on confirm', async () => {
    const user = userEvent.setup();
    const auth = await import('@/lib/supabase/auth');
    useAuthStore.setState({ user: mockUser });
    render(<Header />);

    const menuTrigger = screen.getByRole('button', { name: 'Open account menu' });
    fireEvent.pointerDown(menuTrigger);
    fireEvent.click(menuTrigger);

    const signOutItem = await screen.findByRole('menuitem', { name: /Sign out/i });
    await user.click(signOutItem);

    expect(screen.getByText(/Are you sure you want to sign out\?/i)).toBeInTheDocument();
    expect(auth.signOut).not.toHaveBeenCalled();

    const confirmBtn = screen.getByRole('button', { name: 'Confirm Sign out' });
    await user.click(confirmBtn);

    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/login');
  });
});
