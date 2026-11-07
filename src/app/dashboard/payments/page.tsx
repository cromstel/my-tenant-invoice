import { getCurrentUser } from '@/lib/auth';
import { services } from '@/server/services';

export const dynamic = 'force-dynamic';

export default async function PaymentsPage() {
  const user = await getCurrentUser();
  const orgId = user?.activeTenantId ?? null;

  let payments: Array<{
    id: string;
    amount: unknown;
    status: string;
    paymentMethod: string | null;
    paymentDate: Date;
  }> = [];
  if (orgId) {
    try {
      payments = await services.payment.list(orgId);
    } catch {
      // Graceful fallback
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
          <p className="text-muted-foreground">Track and manage payments</p>
        </div>
        <a
          href="/dashboard/payments/new"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          Record Payment
        </a>
      </div>

      <div className="rounded-lg border">
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
                  No payments found. Record your first payment to get started.
                </td>
              </tr>
            ) : (
              payments.map((payment) => (
                <tr key={payment.id} className="border-b">
                  <td className="p-4 text-sm font-medium">-</td>
                  <td className="p-4 text-sm">${Number(payment.amount).toLocaleString()}</td>
                  <td className="p-4 text-sm">{payment.paymentMethod ?? '-'}</td>
                  <td className="p-4 text-sm">
                    <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
                      {payment.status}
                    </span>
                  </td>
                  <td className="p-4 text-sm">
                    {new Date(payment.paymentDate).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
