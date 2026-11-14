import type { Metadata } from 'next';
import * as React from 'react';

import { ContactForm } from '@/components/marketing/contact-form';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Get in touch with the myTenant Invoice team about property billing, metered utilities, invoicing and pricing.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'Contact · myTenant Invoice',
    description: 'Talk to the myTenant Invoice team about your properties and billing setup.',
    url: '/contact',
  },
};

export default function ContactPage(): React.JSX.Element {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-16">
      <h1 className="mb-4 text-4xl font-bold">Contact Us</h1>
      <p className="mb-8 text-muted-foreground">Have questions? We&apos;d love to hear from you.</p>
      <ContactForm />
    </div>
  );
}
