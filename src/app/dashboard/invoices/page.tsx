import Link from 'next/link';

import { getCurrentUser } from '@/lib/auth';
import { services } from '@/server/services';

export const dynamic = 'force-dynamic';

export default async function InvoicesPage() {
  const user = await getCurrentUser();
  const orgId = user?.activeTenantId ?? null;

  let invoices: Array<{
    id: string;
    invoiceNumber: string;
    status: string;
    total: unknown;
    dueDate: Date;
    customer: { fullName: string | null } | null;
  }> = [];
  if (orgId) {
    try {
      invoices = await services.invoice.list(orgId);
    } catch {
      // Graceful fallback
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">Manage your invoices</p>
        </div>
        <Link
          href="/dashboard/invoices/new"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          Create Invoice
        </Link>
      </div>

      <div className="rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-4 text-left text-sm font-medium">Invoice #</th>
              <th className="p-4 text-left text-sm font-medium">Customer</th>
              <th className="p-4 text-left text-sm font-medium">Status</th>
              <th className="p-4 text-left text-sm font-medium">Total</th>
              <th className="p-4 text-left text-sm font-medium">Due Date</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  No invoices found. Create your first invoice to get started.
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b">
                  <td className="p-4 text-sm font-medium">{invoice.invoiceNumber}</td>
                  <td className="p-4 text-sm">{invoice.customer?.fullName ?? '-'}</td>
                  <td className="p-4 text-sm">
                    <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
                      {invoice.status}
                    </span>
                  </td>
                  <td className="p-4 text-sm">${Number(invoice.total).toLocaleString()}</td>
                  <td className="p-4 text-sm">{new Date(invoice.dueDate).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
