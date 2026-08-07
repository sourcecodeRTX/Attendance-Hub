'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useUIStore } from '@/lib/stores/ui-store';
import { signOut } from '@/lib/supabase/auth';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  primary_teacher: 'Primary Teacher',
  regular_teacher: 'Regular Teacher',
  cr: 'Class Representative',
};

const SYNC_CONFIG: Record<string, { color: string; label: string }> = {
  synced: { color: 'bg-green-500', label: 'Synced' },
  pending: { color: 'bg-amber-500', label: 'Pending' },
  failed: { color: 'bg-red-500', label: 'Failed' },
};

function derivePageTitle(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return 'Dashboard';
  const last = segments[segments.length - 1];
  return last
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, university, clearAuth } = useAuthStore();
  const { syncStatus } = useUIStore();

  if (!user) return null;

  const pageTitle = derivePageTitle(pathname);
  const sync = SYNC_CONFIG[syncStatus] ?? SYNC_CONFIG.synced;
  const initials = user.fullName
    .split(' ')
    .map((n) => n.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);

  async function handleSignOut() {
    await signOut();
    clearAuth();
    router.push('/login');
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold">{pageTitle}</h1>
        {university && (
          <p className="truncate text-xs text-muted-foreground lg:hidden">
            {university.name}
          </p>
        )}
      </div>

      <Link
        href="/sync"
        aria-label={`Sync status: ${sync.label}`}
        className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
      >
        <span className={cn('inline-block size-2 rounded-full', sync.color)} />
        <span className="hidden sm:inline">{sync.label}</span>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Open account menu"
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'icon' }),
            'rounded-full'
          )}
        >
          <Avatar size="sm">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8}>
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">{user.fullName}</p>
                <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
