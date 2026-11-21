import type { Metadata } from 'next';
import Link from 'next/link';

import { features } from '@/config/features';

export const metadata: Metadata = {
  title: 'Features',
  description:
    'Multi-tenant data isolation, a flat/tiered/block tariff engine, property and meter management, the invoice lifecycle, payments, reports, audit logging, and role-based access.',
  alternates: { canonical: '/features' },
  openGraph: {
    title: 'Features · myTenant Invoice',
    description: 'Everything you need to manage billing, properties, and tenants in one platform.',
    url: '/features',
  },
};

export default function FeaturesPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <h1 className="mb-4 text-center text-4xl font-bold">Features</h1>
      <p className="mx-auto mb-12 max-w-2xl text-center text-muted-foreground">
        Everything you need to manage billing, properties, and tenants in one platform.
      </p>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="rounded-lg border bg-card p-6 shadow-sm">
            <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </div>
      <div className="mt-12 text-center">
        <Link
          href="/auth/signup"
          className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          Get Started
        </Link>
      </div>
    </div>
  );
}
