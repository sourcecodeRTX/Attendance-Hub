'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';
import { UserRole } from '@/lib/types';

const ROUTE_PERMISSIONS: Record<string, UserRole[]> = {
  '/dashboard': ['super_admin', 'admin', 'primary_teacher', 'regular_teacher', 'cr'],
  '/departments': ['super_admin'],
  '/settings': ['super_admin', 'admin', 'primary_teacher', 'regular_teacher', 'cr'],
  '/activity-logs': ['super_admin', 'admin'],
  '/export': ['super_admin', 'admin', 'primary_teacher'],
  '/branches': ['admin'],
  '/specialisations': ['admin'],
  '/sections': ['admin'],
  '/teachers': ['admin'],
  '/students': ['super_admin', 'admin', 'primary_teacher', 'regular_teacher', 'cr'],
  '/subjects': ['admin'], // Changed: Admin only - primary teachers no longer have access
  '/attendance': ['primary_teacher', 'regular_teacher', 'cr'],
  '/cr-management': ['primary_teacher'],
  '/sync': ['super_admin', 'admin', 'primary_teacher', 'regular_teacher', 'cr'],
  '/change-password': ['super_admin', 'admin', 'primary_teacher', 'regular_teacher', 'cr'],
};

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, isHydrated, clearAuth } = useAuthStore();

  useEffect(() => {
    if (!isHydrated || isLoading) return;

    let cancelled = false;

    const verifyAndGuard = async () => {
      if (cancelled) return;

      if (!user) {
        clearAuth();
        router.replace('/login');
        return;
      }

      if (!user.isActive) {
        router.replace('/login');
        return;
      }

      if (user.mustChangePassword && pathname !== '/change-password') {
        router.replace('/change-password');
        return;
      }

      if (pathname === '/change-password') return;

      const routeKey = '/' + pathname.split('/')[1];
      const allowedRoles = ROUTE_PERMISSIONS[routeKey];

      if (allowedRoles && !allowedRoles.includes(user.role)) {
        router.replace('/dashboard');
      }
    };

    void verifyAndGuard();

    return () => {
      cancelled = true;
    };
  }, [user, isLoading, isHydrated, pathname, router, clearAuth]);

  if (!isHydrated || isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user || !user.isActive) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
