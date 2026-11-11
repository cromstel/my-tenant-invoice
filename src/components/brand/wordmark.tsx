import * as React from 'react';

import { LogoMark } from '@/components/brand/logo-mark';
import { cn } from '@/lib/utils';

export interface WordmarkProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Classes applied to the product name. */
  nameClassName?: string;
  /** Classes applied to the mark. */
  markClassName?: string;
}

/**
 * The product lockup: the mark followed by the product name.
 *
 * The name is real text rather than part of an image, so it stays selectable,
 * inherits the type system and follows the active theme.
 */
export const Wordmark = React.forwardRef<HTMLSpanElement, WordmarkProps>(function Wordmark(
  { className, nameClassName, markClassName, ...props },
  ref,
) {
  return (
    <span ref={ref} className={cn('inline-flex items-center gap-2', className)} {...props}>
      <LogoMark className={cn('size-8 shrink-0', markClassName)} />
      <span className={cn('text-xl font-bold whitespace-nowrap', nameClassName)}>
        myTenant Invoice
      </span>
    </span>
  );
});

Wordmark.displayName = 'Wordmark';
