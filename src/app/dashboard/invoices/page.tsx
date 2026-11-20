import { AppShell } from '@/components/app-shell/app-shell';
import { RowLink } from '@/components/ui/row-link';
import { createMetadata, fmtDate, usd } from '@/lib/format';
import { requireOrgUser } from '@/server/page-guards';
import { services } from '@/server/services';

export const dynamic = 'force-dynamic';

export const metadata = createMetadata(
  'Invoices',
  'Manage your invoices, view payment status, and send reminders to tenants.',
);

export default async function InvoicesPage() {
  const user = await requireOrgUser();
  const orgId = user.activeTenantId;

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
      // Graceful fallback when invoices cannot be listed
    }
  }

  return (
    <AppShell>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">Manage your invoices</p>
        </div>

        <div className="rounded-lg border">
          <div className="overflow-x-auto" role="region" aria-label="Invoices table" tabIndex={0}>
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
                      No invoices found.
                    </td>
                  </tr>
                ) : (
                  invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b">
                      <td className="p-4 text-sm font-medium">
                        <RowLink href={`/dashboard/invoices/${invoice.id}`}>
                          {invoice.invoiceNumber}
                        </RowLink>
                      </td>
                      <td className="p-4 text-sm">{invoice.customer?.fullName ?? '-'}</td>
                      <td className="p-4 text-sm">
                        <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
                          {invoice.status}
                        </span>
                      </td>
                      <td className="p-4 text-sm">{usd(invoice.total)}</td>
                      <td className="p-4 text-sm">{fmtDate(invoice.dueDate)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
