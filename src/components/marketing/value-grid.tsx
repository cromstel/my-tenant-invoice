import * as React from 'react';

import type { CompanyValue } from '@/config/about';

export interface ValueGridProps {
  values: readonly CompanyValue[];
}

/**
 * The commitments the product is held to, as a two-column card grid.
 *
 * Each card keeps its `id` so a value can be linked to directly from
 * elsewhere on the site.
 */
export function ValueGrid({ values }: ValueGridProps): React.JSX.Element {
  return (
    <ul className="mt-12 grid gap-6 sm:grid-cols-2">
      {values.map(({ id, title, description, icon: Icon }) => (
        <li key={id} id={id} className="rounded-xl border bg-card p-6 shadow-card">
          <span className="inline-flex size-11 items-center justify-center rounded-lg bg-brand-50 text-primary dark:bg-brand-900/40 dark:text-brand-200">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <h3 className="mt-4 text-lg font-semibold">{title}</h3>
          <p className="mt-2 text-muted-foreground">{description}</p>
        </li>
      ))}
    </ul>
  );
}
