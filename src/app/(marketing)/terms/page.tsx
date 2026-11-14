import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms that govern use of myTenant Invoice: accounts, payment terms, data ownership, and liability.',
  alternates: { canonical: '/terms' },
  openGraph: {
    title: 'Terms of Service · myTenant Invoice',
    description: 'The terms that govern use of myTenant Invoice.',
    url: '/terms',
  },
};

export default function TermsPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-4 text-4xl font-bold">Terms of Service</h1>
      <p className="mb-8 text-muted-foreground">Last updated: November 2026</p>
      <div className="space-y-6 text-sm text-muted-foreground">
        <section>
          <h2 className="mb-2 text-xl font-semibold text-foreground">1. Acceptance of Terms</h2>
          <p>
            By accessing and using myTenant Invoice, you accept and agree to be bound by these Terms
            of Service.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-xl font-semibold text-foreground">2. Service Description</h2>
          <p>
            myTenant Invoice provides a SaaS platform for invoicing, property management, and
            billing. Services are provided on a subscription basis.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-xl font-semibold text-foreground">3. User Accounts</h2>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials and
            for all activities under your account.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-xl font-semibold text-foreground">4. Payment Terms</h2>
          <p>
            Subscription fees are billed in advance. All fees are non-refundable except as required
            by law.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-xl font-semibold text-foreground">5. Data Ownership</h2>
          <p>
            You retain ownership of your data. We process your data solely to provide the services.
            Upon termination, you may export your data.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-xl font-semibold text-foreground">6. Limitation of Liability</h2>
          <p>
            myTenant Invoice is provided &quot;as is&quot; without warranties. We are not liable for
            indirect, incidental, or consequential damages.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-xl font-semibold text-foreground">7. Contact</h2>
          <p>For questions about these terms, contact us at hello@cromstelit.com.</p>
        </section>
      </div>
    </div>
  );
}
