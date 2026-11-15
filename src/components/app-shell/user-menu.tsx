'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';
import { TOUCH_TARGET_CLASS } from '@/lib/format';
import { cn } from '@/lib/utils';

interface UserMenuProps {
  name: string | null;
  email: string;
  orgName: string | null;
}

/**
 * Authenticated user menu: avatar button opens a dropdown with the
 * account identity and a working sign-out action.
 */
export function UserMenu({ name, email, orgName }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  async function handleSignOut() {
    await authClient.signOut();
    router.push('/auth/login');
    router.refresh();
  }

  const initials = name
    ? name
        .split(' ')
        .map((part) => part.charAt(0))
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        aria-label="User menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(!open)}
        className={cn(TOUCH_TARGET_CLASS)}
      >
        <span className="text-sm font-medium" aria-hidden="true">
          {initials}
        </span>
      </Button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 z-50 mt-2 w-64 rounded-md border border-border bg-popover p-3 shadow-lg"
        >
          <p className="truncate text-sm font-medium">{name ?? email}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
          {orgName && <p className="mt-1 truncate text-xs text-muted-foreground">{orgName}</p>}
          <hr className="my-2 border-border" />
          <Button
            variant="outline"
            className={cn('w-full justify-start', TOUCH_TARGET_CLASS)}
            onClick={handleSignOut}
          >
            Sign out
          </Button>
        </div>
      )}
    </div>
  );
}
