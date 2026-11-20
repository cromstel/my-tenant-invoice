import { AppShell } from '@/components/app-shell/app-shell';
import { createMetadata, fmtDate, usd } from '@/lib/format';
import { requireOrgUser } from '@/server/page-guards';
import { services } from '@/server/services';

export const dynamic = 'force-dynamic';

export const metadata = createMetadata(
  'Payments',
  'Track and manage payments across your properties and tenants.',
);

export default async function PaymentsPage() {
  const user = await requireOrgUser();
  const orgId = user.activeTenantId;

  let payments: Array<{
    id: string;
    amount: unknown;
    status: string;
    paymentMethod: string | null;
    paymentDate: Date;
    customer: { fullName: string | null } | null;
  }> = [];
  if (orgId) {
    try {
      payments = (await services.payment.list(orgId)) as unknown as typeof payments;
    } catch {
      // Graceful fallback when payments cannot be listed
    }
  }

  return (
    <AppShell>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
          <p className="text-muted-foreground">Track and manage payments</p>
        </div>

        <div className="rounded-lg border">
          <div className="overflow-x-auto" role="region" aria-label="Payments table" tabIndex={0}>
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-4 text-left text-sm font-medium">Customer</th>
                  <th className="p-4 text-left text-sm font-medium">Amount</th>
                  <th className="p-4 text-left text-sm font-medium">Method</th>
                  <th className="p-4 text-left text-sm font-medium">Status</th>
                  <th className="p-4 text-left text-sm font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      No payments found.
                    </td>
                  </tr>
                ) : (
                  payments.map((payment) => (
                    <tr key={payment.id} className="border-b">
                      <td className="p-4 text-sm font-medium">
                        {payment.customer?.fullName ?? '-'}
                      </td>
                      <td className="p-4 text-sm">{usd(payment.amount)}</td>
                      <td className="p-4 text-sm">{payment.paymentMethod ?? '-'}</td>
                      <td className="p-4 text-sm">
                        <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
                          {payment.status}
                        </span>
                      </td>
                      <td className="p-4 text-sm">{fmtDate(payment.paymentDate)}</td>
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
