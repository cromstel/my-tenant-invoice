import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'myTenant Invoice plans: a free tier to start, Pro at $149 per month, and custom Enterprise contracts with an on-premise or hybrid deployment option.',
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
      name: 'Free',
      price: '$0',
      period: '/month',
      features: [
        'Up to 20 invoices / month',
        '3 properties',
        '10 end-clients',
        'No credit card required',
      ],
      cta: 'Get Started Free',
      href: '/auth/signup',
    },
    {
      name: 'Pro',
      price: '$149',
      period: '/month',
      features: [
        '50–5,000 active units',
        '$1.20 per active unit / month',
        'Unlimited invoices and properties',
      ],
      cta: 'Start Free Trial',
      href: '/auth/signup',
      highlighted: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      features: [
        'Custom volume pricing',
        'On-premise or hybrid deployment',
        'Custom SLA',
        'White-label branding',
        'Dedicated CSM and support hotline',
      ],
      cta: 'Contact Sales',
      href: '/contact',
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
            <Link
              href={plan.href}
              className={`block min-h-11 w-full rounded-md px-4 py-3 text-center text-sm font-medium shadow ${
                plan.highlighted
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'border hover:bg-accent'
              }`}
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
