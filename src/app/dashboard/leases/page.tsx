import Link from 'next/link';

import { getCurrentUser } from '@/lib/auth';
import { services } from '@/server/services';

export const dynamic = 'force-dynamic';

export default async function LeasesPage() {
  const user = await getCurrentUser();
  const orgId = user?.activeTenantId ?? null;

  let leases: Array<{
    id: string;
    leaseNumber: string;
    status: string;
    startDate: Date;
    endDate: Date | null;
    recurringCharge: unknown;
    customer: { fullName: string | null } | null;
    unit: { unitNumber: string } | null;
  }> = [];
  if (orgId) {
    try {
      leases = await services.lease.list(orgId);
    } catch {
      // Graceful fallback
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leases</h1>
          <p className="text-muted-foreground">Manage lease agreements</p>
        </div>
        <Link
          href="/dashboard/leases/new"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          Create Lease
        </Link>
      </div>

      <div className="rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-4 text-left text-sm font-medium">Lease #</th>
              <th className="p-4 text-left text-sm font-medium">Customer</th>
              <th className="p-4 text-left text-sm font-medium">Unit</th>
              <th className="p-4 text-left text-sm font-medium">Status</th>
              <th className="p-4 text-left text-sm font-medium">Start Date</th>
              <th className="p-4 text-left text-sm font-medium">Recurring Charge</th>
            </tr>
          </thead>
          <tbody>
            {leases.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  No leases found. Create your first lease to get started.
                </td>
              </tr>
            ) : (
              leases.map((lease) => (
                <tr key={lease.id} className="border-b">
                  <td className="p-4 text-sm font-medium">{lease.leaseNumber}</td>
                  <td className="p-4 text-sm">{lease.customer?.fullName ?? '-'}</td>
                  <td className="p-4 text-sm">{lease.unit?.unitNumber ?? '-'}</td>
                  <td className="p-4 text-sm">
                    <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
                      {lease.status}
                    </span>
                  </td>
                  <td className="p-4 text-sm">{new Date(lease.startDate).toLocaleDateString()}</td>
                  <td className="p-4 text-sm">${Number(lease.recurringCharge).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
