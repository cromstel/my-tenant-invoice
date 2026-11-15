import { notFound } from 'next/navigation';

import { AppShell } from '@/components/app-shell/app-shell';
import { createMetadata, usd } from '@/lib/format';
import { requireOrgUser } from '@/server/page-guards';
import { services } from '@/server/services';

export const dynamic = 'force-dynamic';

export const metadata = createMetadata(
  'Customer Details',
  'View customer details, billing totals, and contact information.',
);

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const { id } = await params;
  await requireOrgUser();

  let customer: Awaited<ReturnType<typeof services.customer.getById>> | null = null;
  try {
    customer = await services.customer.getById(id);
  } catch {
    notFound();
  }

  if (!customer) {
    notFound();
  }

  const report = await services.report.getCustomerReport(id);

  return (
    <AppShell>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {customer.fullName ?? 'Unnamed Customer'}
          </h1>
          <p className="text-muted-foreground">{customer.email ?? 'No email'}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Type</div>
            <div className="text-lg font-bold">{customer.type}</div>
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Total Billed</div>
            <div className="text-lg font-bold">{usd(report.totalBilled)}</div>
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Total Paid</div>
            <div className="text-lg font-bold">{usd(report.totalPaid)}</div>
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Balance</div>
            <div className="text-lg font-bold">{usd(report.balance)}</div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold">Contact Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone</span>
                <span>{customer.phoneNumber ?? '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Address</span>
                <span>{customer.billingAddress ?? '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">City</span>
                <span>{customer.city ?? '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Country</span>
                <span>{customer.country ?? '-'}</span>
              </div>
              {customer.taxVatNumber && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax/VAT</span>
                  <span>{customer.taxVatNumber}</span>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold">Contacts</h3>
            {customer.contacts && customer.contacts.length > 0 ? (
              <div className="space-y-2">
                {customer.contacts.map((contact) => (
                  <div key={contact.id} className="flex justify-between text-sm">
                    <span>
                      {contact.firstName} {contact.lastName}
                    </span>
                    <span className="text-muted-foreground">{contact.email}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No contacts added.</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold">Recent Invoices</h3>
          <p className="text-sm text-muted-foreground">{report.invoiceCount} invoice(s) total</p>
        </div>
      </div>
    </AppShell>
  );
}
