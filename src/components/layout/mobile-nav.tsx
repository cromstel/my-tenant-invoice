'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Wordmark } from '@/components/brand/wordmark';
import { SheetClose, SheetTitle } from '@/components/ui/sheet';
import { navigationLinks } from '@/config/navigation';

export interface MobileNavProps {
  onNavigate: () => void;
}

export function MobileNav({ onNavigate }: MobileNavProps): React.JSX.Element {
  return (
    <>
      <div className="flex h-16 shrink-0 items-center justify-between border-b px-4">
        <SheetTitle asChild>
          <Wordmark markClassName="size-7 sm:size-8" />
        </SheetTitle>
        <SheetClose className="inline-flex size-11 items-center justify-center rounded-md text-foreground opacity-80 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none">
          <X className="size-5" />
          <span className="sr-only">Close menu</span>
        </SheetClose>
      </div>

      <nav aria-label="Mobile main" className="flex min-h-0 flex-col gap-1 overflow-y-auto p-4">
        {navigationLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className="flex min-h-11 items-center rounded-md px-3 text-base font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto flex shrink-0 flex-col gap-3 border-t p-4">
        <Link
          href="/auth/login"
          onClick={onNavigate}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-input bg-background text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Log in
        </Link>
        <Link
          href="/auth/signup"
          onClick={onNavigate}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Get Started
        </Link>
      </div>
    </>
  );
}
