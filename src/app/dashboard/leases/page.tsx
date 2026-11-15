import Link from 'next/link';

import { AppShell } from '@/components/app-shell/app-shell';
import { createMetadata, fmtDate, TOUCH_TARGET_CLASS, usd } from '@/lib/format';
import { cn } from '@/lib/utils';
import { requireOrgUser } from '@/server/page-guards';
import { services } from '@/server/services';

export const dynamic = 'force-dynamic';

export const metadata = createMetadata(
  'Leases',
  'Manage lease agreements, rental terms, and tenant contracts.',
);

export default async function LeasesPage() {
  const user = await requireOrgUser();
  const orgId = user.activeTenantId;

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
      // Graceful fallback when leases cannot be listed
    }
  }

  return (
    <AppShell>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leases</h1>
          <p className="text-muted-foreground">Manage lease agreements</p>
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
                    No leases found.
                  </td>
                </tr>
              ) : (
                leases.map((lease) => (
                  <tr key={lease.id} className="border-b">
                    <td className="p-4 text-sm font-medium">
                      <Link
                        href={`/dashboard/leases/${lease.id}`}
                        className={cn(
                          TOUCH_TARGET_CLASS,
                          'inline-flex items-center text-primary underline-offset-4 hover:underline',
                        )}
                      >
                        {lease.leaseNumber}
                      </Link>
                    </td>
                    <td className="p-4 text-sm">{lease.customer?.fullName ?? '-'}</td>
                    <td className="p-4 text-sm">{lease.unit?.unitNumber ?? '-'}</td>
                    <td className="p-4 text-sm">
                      <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
                        {lease.status}
                      </span>
                    </td>
                    <td className="p-4 text-sm">{fmtDate(lease.startDate)}</td>
                    <td className="p-4 text-sm">{usd(lease.recurringCharge)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
