import Link from 'next/link';

import { getCurrentUser } from '@/lib/auth';
import { services } from '@/server/services';

export const dynamic = 'force-dynamic';

export default async function MetersPage() {
  const user = await getCurrentUser();
  const orgId = user?.activeTenantId ?? null;

  let meters: Array<{
    id: string;
    serialNumber: string;
    meterType: string;
    status: string;
    unitOfMeasurement: string;
    latestReading: unknown;
  }> = [];
  if (orgId) {
    try {
      meters = await services.meter.list(orgId);
    } catch {
      // Graceful fallback
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meters</h1>
          <p className="text-muted-foreground">Manage utility meters and readings</p>
        </div>
        <Link
          href="/dashboard/meters/new"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          Add Meter
        </Link>
      </div>

      <div className="rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-4 text-left text-sm font-medium">Serial Number</th>
              <th className="p-4 text-left text-sm font-medium">Type</th>
              <th className="p-4 text-left text-sm font-medium">Unit</th>
              <th className="p-4 text-left text-sm font-medium">Latest Reading</th>
              <th className="p-4 text-left text-sm font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {meters.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  No meters found. Add your first meter to get started.
                </td>
              </tr>
            ) : (
              meters.map((meter) => (
                <tr key={meter.id} className="border-b">
                  <td className="p-4 text-sm font-medium">{meter.serialNumber}</td>
                  <td className="p-4 text-sm">{meter.meterType}</td>
                  <td className="p-4 text-sm">{meter.unitOfMeasurement}</td>
                  <td className="p-4 text-sm">{Number(meter.latestReading).toLocaleString()}</td>
                  <td className="p-4 text-sm">
                    <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
                      {meter.status}
                    </span>
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
