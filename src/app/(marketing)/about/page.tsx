import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import * as React from 'react';

import { FactList } from '@/components/marketing/fact-list';
import { TeamGrid } from '@/components/marketing/team-grid';
import { ValueGrid } from '@/components/marketing/value-grid';
import { Button } from '@/components/ui/button';
import { companyFacts, companyValues, teamPods } from '@/config/about';
import { platformStats } from '@/config/services';

export const metadata: Metadata = {
  title: 'About',
  description:
    'myTenant Invoice is built by CromStel IT Group, a technology company delivering enterprise-grade software for property management, billing and financial operations.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About · myTenant Invoice',
    description:
      'The company behind myTenant Invoice: what we build, the commitments we hold the product to, and the teams that ship it.',
    url: '/about',
  },
};

export default function AboutPage(): React.JSX.Element {
  return (
    <>
      <section className="border-b bg-gradient-to-br from-slate-50 via-background to-brand-50 dark:from-slate-950 dark:via-background dark:to-slate-900">
        <div className="container mx-auto grid items-center gap-12 px-4 py-20 lg:grid-cols-2 lg:py-28">
          <div>
            <span className="inline-flex items-center rounded-full bg-brand-100 px-3 py-1 text-sm font-medium text-brand-800 dark:bg-brand-900 dark:text-brand-100">
              About CromStel IT Group
            </span>
            <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              We build the billing layer property teams rely on
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
              myTenant Invoice is a production-grade, multi-tenant platform for property and utility
              billing, built by CromStel IT Group. One data model, one set of permissions and one
              audit trail — from the buildings you manage to the payments you collect.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/features">Explore the platform</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/contact">Talk to us</Link>
              </Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border bg-white shadow-soft">
            <Image
              src="/illustrations/about-hero.png"
              alt="An abstract illustration of a company and the people it serves: buildings on the left and a group of people on the right, joined by a flowing ribbon."
              width={1600}
              height={900}
              preload
              className="h-auto w-full"
              sizes="(min-width: 1024px) 50vw, 100vw"
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="about-stats-heading" className="border-b bg-muted/40">
        <div className="container mx-auto px-4 py-14">
          <div className="mx-auto max-w-3xl text-center">
            <h2 id="about-stats-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
              The platform in numbers
            </h2>
            <p className="mt-3 text-muted-foreground">
              These counts are taken from the source rather than from marketing copy, so each one
              can be checked against the repository that builds the product.
            </p>
          </div>
          <dl className="mt-10 grid gap-8 border-y py-10 sm:grid-cols-2 lg:grid-cols-4">
            {platformStats.map((stat) => (
              <div key={stat.label}>
                <dt className="text-sm font-medium text-muted-foreground">{stat.label}</dt>
                <dd className="mt-2 text-4xl font-bold tracking-tight text-primary">
                  {stat.value}
                </dd>
                <dd className="mt-2 text-sm text-muted-foreground">{stat.detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section aria-labelledby="about-story-heading" className="border-b">
        <div className="container mx-auto grid gap-10 px-4 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:gap-16 lg:py-24">
          <div>
            <p className="text-sm font-semibold tracking-wide text-primary uppercase">Our story</p>
            <h2
              id="about-story-heading"
              className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl"
            >
              Billing that survives an audit
            </h2>
            <div className="mt-10 overflow-hidden rounded-xl border bg-white shadow-soft">
              <Image
                src="/illustrations/about-auditor.png"
                alt="An illustrated auditor reviewing a billing document through a magnifying glass, with a verified check badge beside it."
                width={800}
                height={600}
                className="h-auto w-full"
                sizes="(min-width: 1024px) 38vw, 100vw"
              />
            </div>
          </div>
          <div className="flex flex-col gap-5 text-lg text-muted-foreground">
            <p>
              The hard part of property billing is not issuing an invoice. It is agreeing what the
              number should be. A meter reading, a tariff, a rounding rule and a lease term all have
              to line up before a statement is defensible, and that is where most billing systems
              quietly come apart.
            </p>
            <p>
              myTenant Invoice covers the whole arc: the buildings you manage, the leases you sign,
              the meters you read, the tariffs you price, the invoices you issue and the payments
              you collect. Those stages share one data model, one permission system and one audit
              trail, which is what keeps a figure traceable from the reading that produced it to the
              payment that settled it.
            </p>
            <p>
              It is built for property managers, landlords, housing associations, utility operators
              and the finance teams behind them — organisations that need tenancy separation, exact
              money and a report they can hand to an auditor, rather than a spreadsheet with a login
              screen.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="about-mission-heading" className="border-b bg-muted/40">
        <div className="container mx-auto px-4 py-16 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <h2
              id="about-mission-heading"
              className="text-3xl font-bold tracking-tight sm:text-4xl"
            >
              Our mission
            </h2>
            <p className="mt-5 text-lg text-muted-foreground">
              To give organisations a secure, scalable and intuitive platform for invoicing,
              property billing and tenant relationships — on the premise that billing should be
              simple, accurate and transparent.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="about-values-heading" className="border-b">
        <div className="container mx-auto px-4 py-16 lg:py-24">
          <div className="max-w-3xl">
            <h2 id="about-values-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
              What we hold the product to
            </h2>
            <p className="mt-3 text-muted-foreground">
              Four commitments that shape how the platform is designed, built and reviewed.
            </p>
          </div>
          <ValueGrid values={companyValues} />
        </div>
      </section>

      <section id="team" aria-labelledby="about-team-heading" className="border-b bg-muted/40">
        <div className="container mx-auto px-4 py-16 lg:py-24">
          <div className="max-w-3xl">
            <h2 id="about-team-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
              The teams behind the platform
            </h2>
            <p className="mt-3 text-muted-foreground">
              myTenant Invoice is built by six functions inside CromStel IT Group. We describe them
              by what they own rather than by who is in them, because the work is the part you can
              hold us to.
            </p>
          </div>
          <TeamGrid pods={teamPods} />
          <p className="mt-10 text-muted-foreground">
            Every team is reachable at{' '}
            <a
              href="mailto:hello@cromstelit.com"
              className="text-primary underline-offset-4 hover:underline"
            >
              hello@cromstelit.com
            </a>
            . Security reports go to{' '}
            <a
              href="mailto:security@cromstelit.com"
              className="text-primary underline-offset-4 hover:underline"
            >
              security@cromstelit.com
            </a>
            .
          </p>
        </div>
      </section>

      <section aria-labelledby="about-facts-heading" className="border-b">
        <div className="container mx-auto grid gap-10 px-4 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:gap-16 lg:py-24">
          <div>
            <h2 id="about-facts-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
              At a glance
            </h2>
            <p className="mt-3 text-muted-foreground">
              The company and the product, without the gloss. Nothing here is a certification claim.
            </p>
          </div>
          <FactList facts={companyFacts} />
        </div>
      </section>

      <section className="container mx-auto px-4 py-20 text-center lg:py-24">
        <h2 className="mx-auto max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
          See what the platform does with your estate
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          Start with the service lines, or talk to us about how your billing works today.
        </p>
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/services">Explore the services</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/contact">Contact us</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
