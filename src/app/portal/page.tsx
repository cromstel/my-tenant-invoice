import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function ClientPortalPage() {
  const user = await getCurrentUser();

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Client Portal</h1>
        <p className="text-muted-foreground">Welcome, {user?.name ?? 'Client'}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Current Balance</div>
          <div className="text-2xl font-bold">$0.00</div>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Overdue Invoices</div>
          <div className="text-2xl font-bold">0</div>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Latest Invoice</div>
          <div className="text-2xl font-bold">-</div>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Next Payment</div>
          <div className="text-2xl font-bold">-</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold">Recent Invoices</h3>
          <p className="text-sm text-muted-foreground">No invoices to display.</p>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold">Recent Payments</h3>
          <p className="text-sm text-muted-foreground">No payments to display.</p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold">Quick Actions</h3>
        <div className="flex gap-4">
          <a
            href="/portal/invoices"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
          >
            View Invoices
          </a>
          <a
            href="/portal/consumption"
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium shadow hover:bg-accent"
          >
            View Consumption
          </a>
          <a
            href="/portal/support"
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium shadow hover:bg-accent"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}
