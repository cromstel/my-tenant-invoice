import Link from 'next/link';

import { TOUCH_TARGET_CLASS } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Table row link shared by every dashboard list page: 44px touch target,
 * primary styling, and a visible focus underline for keyboard users.
 */
export function RowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        TOUCH_TARGET_CLASS,
        'inline-flex items-center text-primary underline-offset-4 hover:underline focus-visible:underline',
      )}
    >
      {children}
    </Link>
  );
}
