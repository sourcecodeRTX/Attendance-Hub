import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from '@/components/layout/sidebar';
import { useAuthStore } from '@/lib/stores/auth-store';
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
  vi.clearAllMocks();
});

describe('Sidebar navigation semantics (a11y)', () => {
  it('marks the current route with aria-current="page"', () => {
    useAuthStore.setState({ user: mockUser });
    render(<Sidebar />);

    const dashboardLink = screen.getByRole('link', { name: /Dashboard/ });
    expect(dashboardLink).toHaveAttribute('aria-current', 'page');
  });

  it('leaves non-current links without aria-current', () => {
    useAuthStore.setState({ user: mockUser });
    render(<Sidebar />);

    const attendanceLink = screen.getByRole('link', { name: /Attendance/ });
    expect(attendanceLink).not.toHaveAttribute('aria-current');
  });

  it('gives the complementary landmark an accessible name', () => {
    useAuthStore.setState({ user: mockUser });
    render(<Sidebar />);

    expect(
      screen.getByRole('complementary', { name: 'Primary' })
    ).toBeInTheDocument();
  });

  it('opens confirmation dialog on clicking sign out and completes sign out on confirm', async () => {
    const user = userEvent.setup();
    const auth = await import('@/lib/supabase/auth');
    useAuthStore.setState({ user: mockUser });
    render(<Sidebar />);

    const signOutBtn = screen.getByRole('button', { name: 'Sign out' });
    await user.click(signOutBtn);

    expect(screen.getByText(/Are you sure you want to sign out\?/i)).toBeInTheDocument();
    expect(auth.signOut).not.toHaveBeenCalled();

    const confirmBtn = screen.getByRole('button', { name: 'Confirm Sign out' });
    await user.click(confirmBtn);

    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('cancels sign out when clicking cancel in confirmation dialog', async () => {
    const user = userEvent.setup();
    const auth = await import('@/lib/supabase/auth');
    useAuthStore.setState({ user: mockUser });
    render(<Sidebar />);

    const signOutBtn = screen.getByRole('button', { name: 'Sign out' });
    await user.click(signOutBtn);

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelBtn);

    expect(auth.signOut).not.toHaveBeenCalled();
    expect(screen.queryByText(/Are you sure you want to sign out\?/i)).not.toBeInTheDocument();
  });
});
