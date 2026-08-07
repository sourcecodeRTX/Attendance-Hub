'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/auth-store';
import { NAV_ITEMS } from '@/lib/constants/navigation';
import { MoreHorizontal } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

const MAX_VISIBLE_INLINE_TABS = 4;

export function MobileNav() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  if (!user) return null;

  const navItems = NAV_ITEMS[user.role] ?? [];
  const visibleItems = navItems.slice(0, MAX_VISIBLE_INLINE_TABS);
  const overflowItems = navItems.slice(MAX_VISIBLE_INLINE_TABS);

  const isItemActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  return (
    <nav aria-label="Mobile navigation" className="flex shrink-0 items-center border-t bg-card lg:hidden">
      {visibleItems.map((item) => {
        const isActive = isItemActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setIsMoreOpen(false)}
            className={cn(
              'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
              isActive
                ? 'text-primary'
                : 'text-muted-foreground'
            )}
          >
            <item.icon className={cn('size-5', isActive && 'text-primary')} />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}

      {overflowItems.length > 0 && (
        <Sheet open={isMoreOpen} onOpenChange={setIsMoreOpen}>
          <SheetTrigger
            aria-label="Open more navigation options"
            className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <MoreHorizontal className="size-5" />
            <span>More</span>
          </SheetTrigger>
          <SheetContent side="bottom" showCloseButton>
            <SheetHeader>
              <SheetTitle>More Options</SheetTitle>
            </SheetHeader>
            <div className="space-y-1 px-4 pb-4">
              {overflowItems.map((item) => {
                const isActive = isItemActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMoreOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground hover:bg-muted'
                    )}
                  >
                    <item.icon className="size-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </nav>
  );
}
