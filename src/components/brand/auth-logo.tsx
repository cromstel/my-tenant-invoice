import Link from 'next/link';

import { cn } from '@/lib/utils';

const focusRing =
  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none';

export interface AuthLogoProps {
  imgClassName?: string;
}

/** Branded logo on authentication pages; returns to the public landing page. */
export function AuthLogo({ imgClassName }: AuthLogoProps): React.JSX.Element {
  return (
    <Link
      href="/"
      aria-label="myTenant Invoice home"
      className={cn('inline-flex min-h-11 items-center rounded-md', focusRing)}
    >
      <img
        src="/logo.svg"
        alt="myTenant Invoice"
        width={200}
        height={48}
        className={imgClassName}
      />
    </Link>
  );
}
