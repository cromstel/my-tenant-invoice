import { AppShell } from '@/components/app-shell/app-shell';
import { createMetadata, fmtCount, fmtDate, usd } from '@/lib/format';
import { requireTenantUser } from '@/server/page-guards';
import { services } from '@/server/services';

export const dynamic = 'force-dynamic';

export const metadata = createMetadata(
  'Client Portal',
  'View your balance, invoices, and payment history.',
);

interface PortalInvoice {
  id: string;
  customerId: string;
  invoiceNumber: string;
  status: string;
  total: unknown;
  remainingBalance: unknown;
  invoiceDate: Date;
  dueDate: Date;
}

interface PortalPayment {
  id: string;
  customerId: string;
  amount: unknown;
  status: string;
  paymentMethod: string | null;
  paymentDate: Date;
}

/** Turn enum values such as BANK_TRANSFER into readable labels. */
function humanizeEnum(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default async function ClientPortalPage() {
  const user = await requireTenantUser();
  const orgId = user.activeTenantId;

  let invoices: PortalInvoice[] = [];
  let payments: PortalPayment[] = [];
  let residentName: string | null = null;

  if (orgId) {
    // Residents only ever see their own billing: match the signed-in user's
    // email to a customer record, then scope every table to that customer.
    const customers = (await services.customer.list(orgId)) as Array<{
      id: string;
      fullName: string | null;
      email: string | null;
    }>;
    const resident = customers.find(
      (customer) => customer.email?.toLowerCase() === user.email.toLowerCase(),
    );
    if (resident) {
      residentName = resident.fullName;
      const allInvoices = (await services.invoice.list(orgId)) as unknown as PortalInvoice[];
      const allPayments = (await services.payment.list(orgId)) as unknown as PortalPayment[];
      invoices = allInvoices.filter((invoice) => invoice.customerId === resident.id);
      payments = allPayments.filter((payment) => payment.customerId === resident.id);
    }
  }

  const now = new Date();
  const unpaid = invoices.filter((invoice) => invoice.status !== 'PAID');
  const balance = unpaid.reduce((sum, invoice) => sum + Number(invoice.remainingBalance ?? 0), 0);
  const overdue = unpaid.filter((invoice) => new Date(invoice.dueDate) < now);
  const latestInvoice = [...invoices].sort(
    (a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime(),
  )[0];
  const nextPayment = [...unpaid].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
  )[0];

  return (
    <AppShell>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Client Portal</h1>
          <p className="text-muted-foreground">Welcome, {residentName ?? user.name ?? 'Client'}</p>
        </div>

        {orgId && !residentName && (
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <p className="text-sm text-muted-foreground">
              No resident profile is linked to this account yet. Contact your property manager to
              connect your login to a unit.
            </p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Current Balance</div>
            <div className="text-2xl font-bold">{usd(balance)}</div>
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Overdue Invoices</div>
            <div className="text-2xl font-bold">{fmtCount(overdue.length)}</div>
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Latest Invoice</div>
            <div className="text-2xl font-bold">{latestInvoice?.invoiceNumber ?? '-'}</div>
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Next Payment Due</div>
            <div className="text-2xl font-bold">
              {nextPayment ? fmtDate(nextPayment.dueDate) : '-'}
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold">Recent Invoices</h3>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices to display.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left text-sm font-medium">Invoice #</th>
                    <th className="p-3 text-left text-sm font-medium">Amount</th>
                    <th className="p-3 text-left text-sm font-medium">Status</th>
                    <th className="p-3 text-left text-sm font-medium">Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b">
                      <td className="p-3 text-sm font-medium">{invoice.invoiceNumber}</td>
                      <td className="p-3 text-sm">{usd(invoice.total)}</td>
                      <td className="p-3 text-sm">
                        <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
                          {humanizeEnum(invoice.status)}
                        </span>
                      </td>
                      <td className="p-3 text-sm">{fmtDate(invoice.dueDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold">Recent Payments</h3>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments to display.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left text-sm font-medium">Amount</th>
                    <th className="p-3 text-left text-sm font-medium">Method</th>
                    <th className="p-3 text-left text-sm font-medium">Status</th>
                    <th className="p-3 text-left text-sm font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-b">
                      <td className="p-3 text-sm font-medium">{usd(payment.amount)}</td>
                      <td className="p-3 text-sm">
                        {payment.paymentMethod ? humanizeEnum(payment.paymentMethod) : '-'}
                      </td>
                      <td className="p-3 text-sm">{humanizeEnum(payment.status)}</td>
                      <td className="p-3 text-sm">{fmtDate(payment.paymentDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
