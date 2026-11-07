export default function SolutionsPage() {
  const solutions = [
    {
      title: 'Property Management',
      desc: 'Complete property and unit management with lease tracking, occupancy monitoring, and maintenance scheduling.',
      features: ['Property hierarchy', 'Unit management', 'Lease tracking', 'Occupancy reports'],
    },
    {
      title: 'Utility Billing',
      desc: 'Automated utility billing with meter management, consumption tracking, and tariff calculations.',
      features: ['Meter management', 'Reading import', 'Anomaly detection', 'Consumption reports'],
    },
    {
      title: 'Residential Housing',
      desc: 'Ideal for housing associations, landlords, and residential property operators.',
      features: ['Tenant portal', 'Recurring rent', 'Service charges', 'Payment tracking'],
    },
    {
      title: 'Commercial Properties',
      desc: 'Manage commercial tenants with complex billing, service agreements, and multi-utility metering.',
      features: ['Multi-utility billing', 'Service packages', 'Custom tariffs', 'AR aging'],
    },
    {
      title: 'Municipal & Council',
      desc: 'Serve public housing and municipal billing needs with scalable multi-tenant architecture.',
      features: [
        'Multi-tenant isolation',
        'Audit logging',
        'Compliance reports',
        'Bulk operations',
      ],
    },
    {
      title: 'Build-to-Rent',
      desc: 'End-to-end billing for build-to-rent operators with automated invoicing and tenant self-service.',
      features: [
        'Automated billing',
        'Tenant portal',
        'Payment processing',
        'Consumption analytics',
      ],
    },
  ];

  return (
    <div className="container mx-auto px-4 py-16">
      <h1 className="mb-4 text-center text-4xl font-bold">Solutions</h1>
      <p className="mx-auto mb-12 max-w-2xl text-center text-muted-foreground">
        Tailored solutions for every type of property and billing operation.
      </p>
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {solutions.map((s) => (
          <div key={s.title} className="rounded-lg border bg-card p-6 shadow-sm">
            <h3 className="mb-2 text-xl font-semibold">{s.title}</h3>
            <p className="mb-4 text-sm text-muted-foreground">{s.desc}</p>
            <ul className="space-y-1">
              {s.features.map((f) => (
                <li key={f} className="flex items-center text-sm">
                  <span className="mr-2 text-green-500">✓</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-12 text-center">
        <a
          href="/auth/signup"
          className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          Get Started
        </a>
      </div>
    </div>
  );
}
