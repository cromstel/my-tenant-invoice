import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How myTenant Invoice collects, uses, protects, and shares information, and the rights you have over your data.',
  alternates: { canonical: '/privacy' },
  openGraph: {
    title: 'Privacy Policy · myTenant Invoice',
    description: 'How myTenant Invoice handles and protects your information.',
    url: '/privacy',
  },
};

export default function PrivacyPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-4 text-4xl font-bold">Privacy Policy</h1>
      <p className="mb-8 text-muted-foreground">Last updated: November 2026</p>
      <div className="space-y-6 text-sm text-muted-foreground">
        <section>
          <h2 className="mb-2 text-xl font-semibold text-foreground">1. Information We Collect</h2>
          <p>
            We collect information you provide directly, including name, email, organization
            details, and billing information. We also collect usage data and device information.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-xl font-semibold text-foreground">2. How We Use Information</h2>
          <p>
            We use your information to provide, maintain, and improve our services, process billing,
            and communicate with you about your account.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-xl font-semibold text-foreground">3. Data Security</h2>
          <p>
            We implement industry-standard security measures including encryption, access controls,
            and regular security assessments to protect your data.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-xl font-semibold text-foreground">4. Data Sharing</h2>
          <p>
            We do not sell your personal information. We may share data with service providers who
            assist in operating our platform, subject to confidentiality agreements.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-xl font-semibold text-foreground">5. Your Rights</h2>
          <p>
            You have the right to access, correct, or delete your personal data. Contact us at
            hello@cromstelit.com for any privacy-related requests.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-xl font-semibold text-foreground">6. Contact</h2>
          <p>For privacy questions, contact us at hello@cromstelit.com.</p>
        </section>
      </div>
    </div>
  );
}
