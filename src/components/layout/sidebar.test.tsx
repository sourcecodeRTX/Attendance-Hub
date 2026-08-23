import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from '@/components/layout/sidebar';
import { useAuthStore } from '@/lib/stores/auth-store';
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
});
