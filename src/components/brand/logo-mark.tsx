import * as React from 'react';

import { cn } from '@/lib/utils';

export type LogoMarkProps = React.SVGProps<SVGSVGElement>;

/**
 * The product mark: a rounded square holding a letter M.
 *
 * The mark is drawn inline rather than loaded from `public/logo.svg` because
 * that file is a full lockup whose wordmark is baked in as Arial text in a
 * fixed near-black colour. An inline mark keeps the letterform independent of
 * the fonts installed on the machine, and lets the colours follow the active
 * theme.
 *
 * It is decorative: the product name always sits beside it and carries the
 * accessible name, so the mark is hidden from assistive technology.
 */
export function LogoMark({ className, ...props }: LogoMarkProps): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
      className={cn('size-8 shrink-0', className)}
      {...props}
    >
      <rect x="4" y="4" width="40" height="40" rx="8" className="fill-primary" />
      <path
        d="M17 33V14L24 26L31 14V33"
        fill="none"
        strokeWidth="5"
        strokeLinecap="butt"
        strokeLinejoin="miter"
        className="stroke-primary-foreground"
      />
    </svg>
  );
}
