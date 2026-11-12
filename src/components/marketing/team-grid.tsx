import { CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import * as React from 'react';

import type { TeamPod } from '@/config/about';

export interface TeamGridProps {
  pods: readonly TeamPod[];
}

/**
 * The teams that build and run the product, described by function.
 *
 * The portraits are decorative: the pod name sits directly beside each one,
 * so an empty `alt` avoids repeating the same words twice for a screen
 * reader. The images sit on a fixed white surface, because the artwork has a
 * light background of its own and would lose its edge on a dark page.
 */
export function TeamGrid({ pods }: TeamGridProps): React.JSX.Element {
  return (
    <ul className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {pods.map(({ id, name, remit, focus, image, imageAlt, icon: Icon }) => (
        <li
          key={id}
          id={id}
          className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-soft"
        >
          <Image
            src={image}
            alt={imageAlt}
            width={600}
            height={600}
            loading="lazy"
            className="h-auto w-full border-b bg-white"
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          />
          <div className="flex flex-1 flex-col p-6">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-primary dark:bg-brand-900/40 dark:text-brand-200">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <h3 className="text-lg font-semibold">{name}</h3>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{remit}</p>
            <ul className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground">
              {focus.map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </li>
      ))}
    </ul>
  );
}
