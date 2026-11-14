import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Simple monthly plans for myTenant Invoice: Starter, Professional, and Enterprise, each with a free trial.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'Pricing · myTenant Invoice',
    description: 'Simple monthly plans for property billing on a multi-tenant platform.',
    url: '/pricing',
  },
};

export default function PricingPage() {
  const plans = [
    {
      name: 'Starter',
      price: '$49',
      period: '/month',
      features: ['Up to 50 units', 'Basic billing', 'Email support', 'Invoice history'],
      cta: 'Start Free Trial',
    },
    {
      name: 'Professional',
      price: '$149',
      period: '/month',
      features: [
        'Up to 500 units',
        'Advanced tariffs',
        'Priority support',
        'Custom branding',
        'API access',
      ],
      cta: 'Start Free Trial',
      highlighted: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      features: [
        'Unlimited units',
        'Dedicated support',
        'Custom contracts',
        'Custom integrations',
        'On-premise option',
      ],
      cta: 'Contact Sales',
    },
  ];

  return (
    <div className="container mx-auto px-4 py-16">
      <h1 className="mb-4 text-center text-4xl font-bold">Pricing</h1>
      <p className="mx-auto mb-12 max-w-2xl text-center text-muted-foreground">
        Choose the plan that fits your organization.
      </p>
      <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-lg border bg-card p-8 shadow-sm ${plan.highlighted ? 'border-primary ring-2 ring-primary' : ''}`}
          >
            <h3 className="mb-2 text-xl font-semibold">{plan.name}</h3>
            <div className="mb-6">
              <span className="text-4xl font-bold">{plan.price}</span>
              <span className="text-muted-foreground">{plan.period}</span>
            </div>
            <ul className="mb-8 space-y-3">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center text-sm">
                  <span className="mr-2 text-green-500">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <a
              href="/auth/signup"
              className={`block w-full rounded-md px-4 py-2 text-center text-sm font-medium shadow ${
                plan.highlighted
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'border hover:bg-accent'
              }`}
            >
              {plan.cta}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
