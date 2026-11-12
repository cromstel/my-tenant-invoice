import * as React from 'react';

import type { CompanyFact } from '@/config/about';

export interface FactListProps {
  facts: readonly CompanyFact[];
}

/**
 * Company and product facts as a definition list.
 *
 * A fact carrying an `href` renders as a link, so contact details and the
 * public profile are usable rather than just readable.
 */
export function FactList({ facts }: FactListProps): React.JSX.Element {
  return (
    <dl className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
      {facts.map(({ label, value, href }) => (
        <div key={label} className="border-t pt-4">
          <dt className="text-sm font-semibold">{label}</dt>
          <dd className="mt-1 text-muted-foreground">
            {href ? (
              // A standalone link rather than one inside a sentence, so it
              // carries the full 44px touch target on its own.
              <a
                href={href}
                className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline"
              >
                {value}
              </a>
            ) : (
              value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
