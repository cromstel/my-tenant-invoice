import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';

export default async function MarketingHomePage(): Promise<React.ReactNode> {
  const user = await getCurrentUser();

  if (user) {
    redirect('/dashboard');
  }

  return (
    <>
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          Smart Invoicing &amp; Property Billing
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          myTenant Invoice is a production-grade SaaS platform for multi-tenant invoicing, property
          management, utility billing, and financial reporting. Built for property managers,
          landlords, housing associations, and utility operators.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/auth/signup"
            className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
          >
            Get Started Free
          </Link>
          <Link
            href="/features"
            className="inline-flex items-center justify-center rounded-md border px-8 py-3 text-sm font-medium shadow hover:bg-accent"
          >
            Explore Features
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="mb-12 text-center text-3xl font-bold">Key Features</h2>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: 'Multi-Tenancy',
              desc: 'Complete data isolation for each organization with independent configurations.',
            },
            {
              title: 'Smart Billing',
              desc: 'Flexible tariff engine with flat, tiered, and block rates.',
            },
            {
              title: 'Property Management',
              desc: 'Manage properties, buildings, units, and occupancy tracking.',
            },
            {
              title: 'Meter Management',
              desc: 'Track utility meters, readings, and consumption with anomaly detection.',
            },
            {
              title: 'Payment Processing',
              desc: 'Record payments, allocations, refunds, and reconciliation.',
            },
            {
              title: 'Financial Reports',
              desc: 'Revenue, aging, consumption, and occupancy reports.',
            },
            { title: 'Audit Logging', desc: 'Comprehensive audit trail for all critical actions.' },
          ].map((feature) => (
            <div key={feature.title} className="rounded-lg border bg-card p-6 shadow-sm">
              <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="mb-4 text-3xl font-bold">Ready to get started?</h2>
        <p className="mb-8 text-muted-foreground">
          See how myTenant Invoice can streamline your billing.
        </p>
        <Link
          href="/auth/signup"
          className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          Start Your Free Trial
        </Link>
      </section>
    </>
  );
}
