import { getCurrentUser } from '@/lib/auth';
import { services } from '@/server/services';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const orgId = user?.activeTenantId ?? null;

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
      // Graceful fallback
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {user?.name ?? 'User'}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Total Billed</div>
          <div className="text-2xl font-bold">${revenue.totalBilled.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Collected</div>
          <div className="text-2xl font-bold">${revenue.totalCollected.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Outstanding</div>
          <div className="text-2xl font-bold">${revenue.totalOutstanding.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Occupancy Rate</div>
          <div className="text-2xl font-bold">{occupancy.occupancyRate.toFixed(1)}%</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold">Properties</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Properties</span>
              <span className="font-medium">{occupancy.totalProperties}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Units</span>
              <span className="font-medium">{occupancy.totalUnits}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Occupied</span>
              <span className="font-medium">{occupancy.occupiedUnits}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vacant</span>
              <span className="font-medium">{occupancy.vacantUnits}</span>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold">Invoices</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Invoices</span>
              <span className="font-medium">{revenue.invoiceCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Collection Rate</span>
              <span className="font-medium">{revenue.collectionRate.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
