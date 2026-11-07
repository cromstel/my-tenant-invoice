import { notFound } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';
import { services } from '@/server/services';

export const dynamic = 'force-dynamic';

interface PropertyDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PropertyDetailPage({ params }: PropertyDetailPageProps) {
  const { id } = await params;
  const user = await getCurrentUser();
  const orgId = user?.activeTenantId ?? null;

  if (!orgId) {
    return <div className="p-6">No organization selected.</div>;
  }

  let property: Awaited<ReturnType<typeof services.property.getPropertyById>> | null = null;
  try {
    property = await services.property.getPropertyById(id);
  } catch {
    notFound();
  }

  if (!property) {
    notFound();
  }

  const units = await services.property.getUnitsByProperty(id);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{property.name}</h1>
          <p className="text-muted-foreground">{property.address}</p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/dashboard/properties/${id}/edit`}
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium shadow hover:bg-accent"
          >
            Edit
          </a>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Type</div>
          <div className="text-lg font-bold">{property.propertyType}</div>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Units</div>
          <div className="text-lg font-bold">{property.unitCount}</div>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Occupancy</div>
          <div className="text-lg font-bold">{Number(property.occupancyRate).toFixed(1)}%</div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold">Units</h3>
        {units.length === 0 ? (
          <p className="text-sm text-muted-foreground">No units found.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 text-left text-sm font-medium">Unit #</th>
                <th className="p-3 text-left text-sm font-medium">Type</th>
                <th className="p-3 text-left text-sm font-medium">Status</th>
                <th className="p-3 text-left text-sm font-medium">Bedrooms</th>
                <th className="p-3 text-left text-sm font-medium">Bathrooms</th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr key={unit.id} className="border-b">
                  <td className="p-3 text-sm font-medium">{unit.unitNumber}</td>
                  <td className="p-3 text-sm">{unit.unitType}</td>
                  <td className="p-3 text-sm">{unit.occupancyStatus}</td>
                  <td className="p-3 text-sm">{unit.bedrooms ?? '-'}</td>
                  <td className="p-3 text-sm">{unit.bathrooms ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {property.buildings && property.buildings.length > 0 && (
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold">Buildings</h3>
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 text-left text-sm font-medium">Name</th>
                <th className="p-3 text-left text-sm font-medium">Floors</th>
                <th className="p-3 text-left text-sm font-medium">Year Built</th>
              </tr>
            </thead>
            <tbody>
              {property.buildings.map((building) => (
                <tr key={building.id} className="border-b">
                  <td className="p-3 text-sm font-medium">{building.name}</td>
                  <td className="p-3 text-sm">{building.floors ?? '-'}</td>
                  <td className="p-3 text-sm">{building.yearBuilt ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
