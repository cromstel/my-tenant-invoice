'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { TOUCH_TARGET_CLASS } from '@/lib/format';
import { cn } from '@/lib/utils';

export type NavItem = {
  href: string;
  label: string;
};

/**
 * Primary navigation for authenticated portals. Highlights the section
 * matching the current path; fully keyboard accessible via native links.
 */
export function AppNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-6">
        {items.map((item) => {
          const active =
            item.href === '/dashboard'
              ? pathname === '/dashboard' || pathname.startsWith('/dashboard/')
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex shrink-0 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors',
                TOUCH_TARGET_CLASS,
                active
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-input hover:text-foreground',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
