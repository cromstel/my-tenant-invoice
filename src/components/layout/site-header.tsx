'use client';

import { Menu } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { MobileNav } from '@/components/layout/mobile-nav';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { navigationLinks } from '@/config/navigation';

const focusRing =
  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none';

/** Matches Tailwind's `lg` breakpoint exactly, including at a changed root font size. */
const DESKTOP_QUERY = '(min-width: 64rem)';

export function SiteHeader(): React.JSX.Element {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_QUERY);

    const handleChange = (event: MediaQueryListEvent): void => {
      if (event.matches) {
        setOpen(false);
      }
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* wordmark */}
        <Link
          href="/"
          className={`inline-flex min-h-11 items-center text-xl font-bold ${focusRing}`}
        >
          myTenant Invoice
        </Link>

        {/* desktop nav */}
        <nav aria-label="Main" className="hidden items-center gap-6 lg:flex">
          {navigationLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`inline-flex min-h-11 items-center text-sm font-medium transition-colors hover:text-primary ${focusRing}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* desktop actions */}
        <div className="hidden items-center gap-4 lg:flex">
          <Link
            href="/auth/login"
            className={`inline-flex min-h-11 items-center text-sm font-medium transition-colors hover:text-primary ${focusRing}`}
          >
            Log in
          </Link>
          <Link
            href="/auth/signup"
            className={`inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 ${focusRing}`}
          >
            Get Started
          </Link>
        </div>

        {/* mobile drawer */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            aria-label="Main menu"
            className={`inline-flex size-11 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-accent-foreground lg:hidden ${focusRing}`}
          >
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="right" showCloseButton={false}>
            <MobileNav onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
