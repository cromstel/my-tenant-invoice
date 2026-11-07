import { notFound } from 'next/navigation';

import { services } from '@/server/services';

export const dynamic = 'force-dynamic';

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const { id } = await params;

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
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {customer.fullName ?? 'Unnamed Customer'}
          </h1>
          <p className="text-muted-foreground">{customer.email ?? 'No email'}</p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/dashboard/customers/${id}/edit`}
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium shadow hover:bg-accent"
          >
            Edit
          </a>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Type</div>
          <div className="text-lg font-bold">{customer.type}</div>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Total Billed</div>
          <div className="text-lg font-bold">${report.totalBilled.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Total Paid</div>
          <div className="text-lg font-bold">${report.totalPaid.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Balance</div>
          <div className="text-lg font-bold">${report.balance.toLocaleString()}</div>
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
  );
}
