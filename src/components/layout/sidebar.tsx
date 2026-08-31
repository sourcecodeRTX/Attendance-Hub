'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/auth-store';
import { signOut } from '@/lib/supabase/auth';
import { NAV_ITEMS } from '@/lib/constants/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  primary_teacher: 'Primary Teacher',
  regular_teacher: 'Regular Teacher',
  cr: 'Class Representative',
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, university, clearAuth } = useAuthStore();
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  if (!user) return null;

  const navItems = NAV_ITEMS[user.role] ?? [];

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await signOut();
      clearAuth();
      setShowSignOutConfirm(false);
      router.push('/login');
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <>
      <aside aria-label="Primary" className="hidden w-64 shrink-0 flex-col border-r bg-card lg:flex">
        <div className="flex h-14 items-center gap-2 px-4">
          <span className="truncate text-sm font-semibold">
            {university?.name ?? 'ATT Tracker'}
          </span>
        </div>

        <Separator />

        <nav aria-label="Primary navigation" className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Separator />

        <div className="p-3">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
              {(user.fullName?.trim().charAt(0) || user.email?.charAt(0) || '?').toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.fullName}</p>
              <Badge variant="secondary" className="mt-0.5">
                {ROLE_LABELS[user.role]}
              </Badge>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Sign out"
            className="mt-1 w-full justify-start gap-2 text-muted-foreground"
            onClick={() => setShowSignOutConfirm(true)}
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <Dialog open={showSignOutConfirm} onOpenChange={setShowSignOutConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Are you sure you want to sign out?</DialogTitle>
            <DialogDescription>
              You will be signed out of your session and redirected to the login page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowSignOutConfirm(false)}
              disabled={isSigningOut}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleSignOut}
              disabled={isSigningOut}
            >
              Confirm Sign out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
