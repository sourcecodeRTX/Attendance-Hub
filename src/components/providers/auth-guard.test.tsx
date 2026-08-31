import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AuthGuard } from './auth-guard';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { User } from '@/lib/types/user';

const replaceMock = vi.fn();
let currentPathname = '/dashboard';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
  usePathname: () => currentPathname,
}));

const mockSuperAdmin: User = {
  id: 'sa-1',
  universityId: 'uni-1',
  role: 'super_admin',
  fullName: 'Super Admin',
  staffId: 'ADMIN-001',
  email: 'admin@uni.edu',
  departmentId: null,
  isActive: true,
  mustChangePassword: false,
  createdAt: '2026-08-01T00:00:00Z',
  createdBy: null,
};

const mockTeacher: User = {
  id: 'tch-1',
  universityId: 'uni-1',
  role: 'primary_teacher',
  fullName: 'Teacher One',
  staffId: 'STF-001',
  email: 'teacher@uni.edu',
  departmentId: 'dept-1',
  isActive: true,
  mustChangePassword: false,
  createdAt: '2026-08-01T00:00:00Z',
  createdBy: null,
};

describe('AuthGuard (F-021)', () => {
  beforeEach(() => {
    cleanup();
    replaceMock.mockClear();
    currentPathname = '/dashboard';
    useAuthStore.setState({
      user: null,
      university: null,
      isLoading: false,
      isHydrated: true,
      isVerified: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders loading spinner and blocks content when user is hydrated from localStorage but NOT verified', () => {
    // Simulating localStorage rehydration: user object present, but isVerified=false
    useAuthStore.setState({
      user: mockSuperAdmin,
      isLoading: false,
      isHydrated: true,
      isVerified: false,
    });

    render(
      <AuthGuard>
        <div data-testid="protected-content">Secret Admin Area</div>
      </AuthGuard>
    );

    expect(screen.queryByTestId('protected-content')).toBeNull();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('renders children when user is verified and authorized for the route', () => {
    currentPathname = '/dashboard';
    useAuthStore.setState({
      user: mockSuperAdmin,
      isLoading: false,
      isHydrated: true,
      isVerified: true,
    });

    render(
      <AuthGuard>
        <div data-testid="protected-content">Dashboard Content</div>
      </AuthGuard>
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('redirects unauthorized role to /dashboard when route is forbidden', async () => {
    currentPathname = '/departments'; // super_admin only
    useAuthStore.setState({
      user: mockTeacher, // primary_teacher
      isLoading: false,
      isHydrated: true,
      isVerified: true,
    });

    render(
      <AuthGuard>
        <div data-testid="protected-content">Departments Content</div>
      </AuthGuard>
    );

    expect(replaceMock).toHaveBeenCalledWith('/dashboard');
  });

  it('redirects unauthenticated verified=true but user=null to /login', () => {
    useAuthStore.setState({
      user: null,
      isLoading: false,
      isHydrated: true,
      isVerified: true,
    });

    render(
      <AuthGuard>
        <div data-testid="protected-content">Should Not Render</div>
      </AuthGuard>
    );

    expect(replaceMock).toHaveBeenCalledWith('/login');
  });

  it('redirects to /change-password if mustChangePassword=true and not already on /change-password', () => {
    currentPathname = '/dashboard';
    useAuthStore.setState({
      user: { ...mockTeacher, mustChangePassword: true },
      isLoading: false,
      isHydrated: true,
      isVerified: true,
    });

    render(
      <AuthGuard>
        <div data-testid="protected-content">Dashboard</div>
      </AuthGuard>
    );

    expect(replaceMock).toHaveBeenCalledWith('/change-password');
  });

  it('redirects unauthorized role to /dashboard when accessing /backup without super_admin role', () => {
    currentPathname = '/backup';
    useAuthStore.setState({
      user: mockTeacher, // primary_teacher
      isLoading: false,
      isHydrated: true,
      isVerified: true,
    });

    render(
      <AuthGuard>
        <div data-testid="protected-content">Backup Content</div>
      </AuthGuard>
    );

    expect(replaceMock).toHaveBeenCalledWith('/dashboard');
  });
});

