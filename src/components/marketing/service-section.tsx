import { CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import * as React from 'react';

import type { ServiceLine } from '@/config/services';

export interface ServiceSectionProps {
  service: ServiceLine;
  /** Places the illustration first, for the alternating layout. */
  reversed?: boolean;
}

/**
 * One service line: the copy on one side, its illustration on the other.
 *
 * The illustration sits on a fixed white surface rather than the themed card
 * colour, because the artwork itself has a light background and would lose
 * its edge against a dark page.
 */
export function ServiceSection({
  service,
  reversed = false,
}: ServiceSectionProps): React.JSX.Element {
  const Icon = service.icon;

  return (
    <section id={service.id} className="border-b last:border-b-0">
      <div className="container mx-auto grid gap-10 px-4 py-16 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-24">
        <div className={reversed ? 'lg:order-2' : undefined}>
          <span className="inline-flex size-12 items-center justify-center rounded-xl bg-brand-50 text-primary dark:bg-brand-900/40 dark:text-brand-200">
            <Icon className="size-6" aria-hidden="true" />
          </span>
          <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">{service.title}</h2>
          <p className="mt-4 text-lg text-muted-foreground">{service.summary}</p>
          <ul className="mt-7 flex flex-col gap-3">
            {service.capabilities.map((capability) => (
              <li key={capability} className="flex gap-3 text-muted-foreground">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <span>{capability}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className={reversed ? 'lg:order-1' : undefined}>
          <div className="overflow-hidden rounded-xl border bg-white shadow-soft">
            <Image
              src={service.image}
              alt={service.imageAlt}
              width={800}
              height={600}
              loading="lazy"
              className="h-auto w-full"
              sizes="(min-width: 1024px) 50vw, 100vw"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
