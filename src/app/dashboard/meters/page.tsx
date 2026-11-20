import { AppShell } from '@/components/app-shell/app-shell';
import { RowLink } from '@/components/ui/row-link';
import { createMetadata, fmtCount } from '@/lib/format';
import { requireOrgUser } from '@/server/page-guards';
import { services } from '@/server/services';

export const dynamic = 'force-dynamic';

export const metadata = createMetadata(
  'Meters',
  'Manage utility meters and track consumption readings.',
);

export default async function MetersPage() {
  const user = await requireOrgUser();
  const orgId = user.activeTenantId;

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
      // Graceful fallback when meters cannot be listed
    }
  }

  return (
    <AppShell>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meters</h1>
          <p className="text-muted-foreground">Manage utility meters and readings</p>
        </div>

        <div className="rounded-lg border">
          <div className="overflow-x-auto" role="region" aria-label="Meters table" tabIndex={0}>
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
                      No meters found.
                    </td>
                  </tr>
                ) : (
                  meters.map((meter) => (
                    <tr key={meter.id} className="border-b">
                      <td className="p-4 text-sm font-medium">
                        <RowLink href={`/dashboard/meters/${meter.id}`}>
                          {meter.serialNumber}
                        </RowLink>
                      </td>
                      <td className="p-4 text-sm">{meter.meterType}</td>
                      <td className="p-4 text-sm">{meter.unitOfMeasurement}</td>
                      <td className="p-4 text-sm">{fmtCount(meter.latestReading)}</td>
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
      </div>
    </AppShell>
  );
}
