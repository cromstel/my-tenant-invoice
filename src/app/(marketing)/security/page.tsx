import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Security',
  description:
    "How myTenant Invoice isolates each organization's data, encrypts information in transit and at rest, controls access, and runs its infrastructure.",
  alternates: { canonical: '/security' },
  openGraph: {
    title: 'Security · myTenant Invoice',
    description: 'Tenant isolation, encryption, access control, and infrastructure practices.',
    url: '/security',
  },
};

export default function SecurityPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-4 text-4xl font-bold">Security</h1>
      <p className="mb-8 text-muted-foreground">
        Security is at the core of myTenant Invoice. We implement industry-leading practices to
        protect your data.
      </p>
      <div className="space-y-8">
        <section>
          <h2 className="mb-3 text-2xl font-semibold">Data Isolation</h2>
          <p className="text-muted-foreground">
            Complete tenant data isolation at the database, API, and application layers. Row-level
            security ensures no cross-tenant data access.
          </p>
        </section>
        <section>
          <h2 className="mb-3 text-2xl font-semibold">Encryption</h2>
          <p className="text-muted-foreground">
            All data encrypted in transit (TLS 1.2+) and at rest (AES-256). Sensitive fields use
            additional application-level encryption.
          </p>
        </section>
        <section>
          <h2 className="mb-3 text-2xl font-semibold">Authentication</h2>
          <p className="text-muted-foreground">
            Secure authentication with MFA support, session management, and brute-force protection.
            Role-based access control with granular permissions.
          </p>
        </section>
        <section>
          <h2 className="mb-3 text-2xl font-semibold">Compliance</h2>
          <p className="text-muted-foreground">
            SOC 2-aligned access controls, comprehensive audit logging, and regular security
            assessments.
          </p>
        </section>
        <section>
          <h2 className="mb-3 text-2xl font-semibold">Infrastructure</h2>
          <p className="text-muted-foreground">
            Hosted on secure cloud infrastructure with automated backups, disaster recovery, and
            99.9% uptime SLA.
          </p>
        </section>
      </div>
    </div>
  );
}
