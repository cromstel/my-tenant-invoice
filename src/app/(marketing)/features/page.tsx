import Link from 'next/link';

export default function FeaturesPage() {
  const features = [
    {
      title: 'Multi-Tenancy',
      desc: 'Complete data isolation for each organization with independent configurations, branding, and billing rules.',
    },
    {
      title: 'Smart Billing Engine',
      desc: 'Flexible tariff engine supporting flat-rate, tiered, block, time-of-use, and seasonal pricing models.',
    },
    {
      title: 'Property Management',
      desc: 'Manage properties, buildings, units, and occupancy tracking with flexible hierarchy.',
    },
    {
      title: 'Meter Management',
      desc: 'Track utility meters, readings, and consumption with automated anomaly detection.',
    },
    {
      title: 'Invoice Lifecycle',
      desc: 'Full invoice workflow from draft to payment with approval, sending, and voiding.',
    },
    {
      title: 'Payment Processing',
      desc: 'Record payments, allocate to invoices, process refunds, and reconcile accounts.',
    },
    {
      title: 'Client Portal',
      desc: 'Self-service portal for tenants to view invoices, make payments, and track consumption.',
    },
    {
      title: 'Financial Reports',
      desc: 'Revenue, aging, consumption, and occupancy reports with export capabilities.',
    },
    {
      title: 'Audit Logging',
      desc: 'Comprehensive audit trail for all critical actions and changes.',
    },
    {
      title: 'AI Assistant',
      desc: 'Secure AI assistant for invoice explanations, tariff insights, and support.',
    },
    {
      title: 'Role-Based Access',
      desc: 'Granular permissions with platform, organization, and client roles.',
    },
    {
      title: 'Notifications',
      desc: 'Email, in-app, and webhook notifications for billing events.',
    },
  ];

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
