import { notFound } from 'next/navigation';

import { services } from '@/server/services';

export const dynamic = 'force-dynamic';

interface MeterDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function MeterDetailPage({ params }: MeterDetailPageProps) {
  const { id } = await params;

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
          <div className="text-lg font-bold">{Number(meter.multiplier)}</div>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Latest Reading</div>
          <div className="text-lg font-bold">{Number(meter.latestReading).toLocaleString()}</div>
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
                  <td className="p-3 text-sm">
                    {new Date(reading.readingDate as Date).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-sm">{Number(reading.reading).toLocaleString()}</td>
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

      <div className="flex gap-2">
        <a
          href={`/dashboard/meters/${id}/readings/new`}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          Add Reading
        </a>
      </div>
    </div>
  );
}
