import { AppShell } from '@/components/app-shell/app-shell';
import { createMetadata, fmtCount, fmtOccupancy, usd } from '@/lib/format';
import { requireOrgUser } from '@/server/page-guards';
import { services } from '@/server/services';

export const dynamic = 'force-dynamic';

export const metadata = createMetadata(
  'Dashboard',
  'Manage your property portfolio, invoices, payments, leases, meters, properties, and customers.',
);

export default async function DashboardPage() {
  const user = await requireOrgUser();
  const orgId = user.activeTenantId;

  let revenue = {
    totalBilled: 0,
    totalCollected: 0,
    totalOutstanding: 0,
    collectionRate: 0,
    invoiceCount: 0,
  };
  let occupancy = {
    totalProperties: 0,
    totalUnits: 0,
    occupiedUnits: 0,
    vacantUnits: 0,
    occupancyRate: 0,
  };

  if (orgId) {
    try {
      revenue = await services.report.getRevenueReport({});
      occupancy = await services.report.getOccupancyReport();
    } catch {
      // Graceful fallback when reports are unavailable
    }
  }

  return (
    <AppShell>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {user.name ?? 'User'}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Total Billed</div>
            <div className="text-2xl font-bold">{usd(revenue.totalBilled)}</div>
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Collected</div>
            <div className="text-2xl font-bold">{usd(revenue.totalCollected)}</div>
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Outstanding</div>
            <div className="text-2xl font-bold">{usd(revenue.totalOutstanding)}</div>
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Occupancy Rate</div>
            <div className="text-2xl font-bold">{fmtOccupancy(occupancy.occupancyRate)}</div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold">Properties</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Properties</span>
                <span className="font-medium">{fmtCount(occupancy.totalProperties)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Units</span>
                <span className="font-medium">{fmtCount(occupancy.totalUnits)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Occupied</span>
                <span className="font-medium">{fmtCount(occupancy.occupiedUnits)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vacant</span>
                <span className="font-medium">{fmtCount(occupancy.vacantUnits)}</span>
              </div>
            </div>
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold">Invoices</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Invoices</span>
                <span className="font-medium">{fmtCount(revenue.invoiceCount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Collection Rate</span>
                <span className="font-medium">{fmtOccupancy(revenue.collectionRate)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
