export default function AboutPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-4 text-4xl font-bold">About Us</h1>
      <p className="mb-8 text-muted-foreground">
        myTenant Invoice is built by CromStel IT Group, a technology company focused on delivering
        enterprise-grade software solutions for property management, billing, and financial
        operations.
      </p>
      <div className="space-y-8">
        <section>
          <h2 className="mb-3 text-2xl font-semibold">Our Mission</h2>
          <p className="text-muted-foreground">
            To provide organizations with a secure, scalable, and intuitive platform for managing
            invoicing, property billing, and tenant relationships. We believe that billing should be
            simple, accurate, and transparent.
          </p>
        </section>
        <section>
          <h2 className="mb-3 text-2xl font-semibold">Our Values</h2>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <strong>Security First:</strong> Your data is protected with enterprise-grade
              security.
            </li>
            <li>
              <strong>Accuracy:</strong> Financial calculations use decimal precision, never
              floating-point.
            </li>
            <li>
              <strong>Transparency:</strong> Clear audit trails and detailed reporting.
            </li>
            <li>
              <strong>Simplicity:</strong> Intuitive interface that reduces complexity.
            </li>
          </ul>
        </section>
        <section>
          <h2 className="mb-3 text-2xl font-semibold">Contact</h2>
          <p className="text-muted-foreground">
            Website:{' '}
            <a href="https://cromstelit.com" className="text-primary hover:underline">
              cromstelit.com
            </a>
            <br />
            Email: hello@cromstelit.com
          </p>
        </section>
      </div>
    </div>
  );
}
