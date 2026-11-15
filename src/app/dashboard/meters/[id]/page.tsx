import { notFound } from 'next/navigation';

import { AppShell } from '@/components/app-shell/app-shell';
import { createMetadata, fmtCount, fmtDate } from '@/lib/format';
import { requireOrgUser } from '@/server/page-guards';
import { services } from '@/server/services';

export const dynamic = 'force-dynamic';

export const metadata = createMetadata(
  'Meter Details',
  'View meter details, configuration, and reading history.',
);

interface MeterDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function MeterDetailPage({ params }: MeterDetailPageProps) {
  const { id } = await params;
  await requireOrgUser();

  let meter: Awaited<ReturnType<typeof services.meter.getById>> | null = null;
  try {
    meter = await services.meter.getById(id);
  } catch {
    notFound();
  }

  if (!meter) {
    notFound();
  }

  return (
    <AppShell>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Meter {meter.serialNumber}</h1>
            <p className="text-muted-foreground">
              {meter.meterType} · {meter.unitOfMeasurement}
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-sm font-medium">
            {meter.status}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Type</div>
            <div className="text-lg font-bold">{meter.meterType}</div>
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Unit</div>
            <div className="text-lg font-bold">{meter.unitOfMeasurement}</div>
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Multiplier</div>
            <div className="text-lg font-bold">{fmtCount(meter.multiplier)}</div>
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Latest Reading</div>
            <div className="text-lg font-bold">{fmtCount(meter.latestReading)}</div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold">Reading History</h3>
          {meter.readings && meter.readings.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left text-sm font-medium">Date</th>
                  <th className="p-3 text-left text-sm font-medium">Reading</th>
                  <th className="p-3 text-left text-sm font-medium">Type</th>
                  <th className="p-3 text-left text-sm font-medium">Anomaly</th>
                </tr>
              </thead>
              <tbody>
                {meter.readings.map((reading) => (
                  <tr key={reading.id} className="border-b">
                    <td className="p-3 text-sm">{fmtDate(reading.readingDate)}</td>
                    <td className="p-3 text-sm">{fmtCount(reading.reading)}</td>
                    <td className="p-3 text-sm">{reading.readingType}</td>
                    <td className="p-3 text-sm">
                      {reading.anomalyDetected ? (
                        <span className="text-red-500">⚠ Yes</span>
                      ) : (
                        <span className="text-green-500">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground">No readings recorded.</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
