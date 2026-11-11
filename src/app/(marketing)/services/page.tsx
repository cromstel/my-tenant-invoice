import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import * as React from 'react';

import { PlatformSection } from '@/components/marketing/platform-section';
import { ServiceSection } from '@/components/marketing/service-section';
import { Button } from '@/components/ui/button';
import { platformPrinciples, platformStats, serviceLines } from '@/config/services';

export const metadata: Metadata = {
  title: 'Services',
  description:
    'The six service lines behind myTenant Invoice: property and portfolio management, lease management, meter and consumption billing, the tariff and rating engine, invoicing and recurring billing, and payments, reconciliation and collections.',
  alternates: { canonical: '/services' },
  openGraph: {
    title: 'Services · myTenant Invoice',
    description:
      'Six service lines that run property and utility billing end to end, on one multi-tenant platform.',
    url: '/services',
  },
};

export default function ServicesPage(): React.JSX.Element {
  return (
    <>
      <section className="border-b bg-gradient-to-br from-slate-50 via-background to-brand-50 dark:from-slate-950 dark:via-background dark:to-slate-900">
        <div className="container mx-auto grid items-center gap-12 px-4 py-20 lg:grid-cols-2 lg:py-28">
          <div>
            <span className="inline-flex items-center rounded-full bg-brand-100 px-3 py-1 text-sm font-medium text-brand-800 dark:bg-brand-900 dark:text-brand-100">
              Services
            </span>
            <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Six service lines that run property billing end to end
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
              myTenant Invoice covers the whole arc of property and utility billing: the buildings
              you manage, the leases you sign, the meters you read, the tariffs you price, the
              invoices you issue and the payments you collect. One data model, one set of
              permissions, one audit trail.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/auth/signup">Get Started</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/contact">Talk to sales</Link>
              </Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border bg-white shadow-soft">
            <Image
              src="/illustrations/services-hero.png"
              alt="A property and utility billing pipeline: buildings and a meter feed a rating engine, which produces invoice sheets and a payment card."
              width={1600}
              height={900}
              preload
              className="h-auto w-full"
              sizes="(min-width: 1024px) 50vw, 100vw"
            />
          </div>
        </div>
      </section>

      <section className="border-b bg-muted/40">
        <div className="container mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            What each service line covers
          </h2>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            Each line has its own workflows and its own screens, and all six work against the same
            record of every property, lease, meter, tariff, invoice and payment.
          </p>
        </div>
      </section>

      <div>
        {serviceLines.map((service, index) => (
          <ServiceSection key={service.id} service={service} reversed={index % 2 === 1} />
        ))}
      </div>

      <PlatformSection principles={platformPrinciples} stats={platformStats} />

      <section className="container mx-auto px-4 py-20 text-center lg:py-24">
        <h2 className="mx-auto max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
          Put the whole billing cycle on one platform
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          Start with the service lines you need and add the rest as your portfolio grows. They share
          the same records, the same permissions and the same audit trail from the first invoice.
        </p>
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/auth/signup">Get Started</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/contact">Talk to sales</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
