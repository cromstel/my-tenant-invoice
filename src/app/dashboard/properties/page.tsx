import Link from 'next/link';

import { getCurrentUser } from '@/lib/auth';
import { services } from '@/server/services';

export const dynamic = 'force-dynamic';

export default async function PropertiesPage() {
  const user = await getCurrentUser();
  const orgId = user?.activeTenantId ?? null;

  let properties: Array<{
    id: string;
    name: string;
    address: string;
    propertyType: string;
    unitCount: number;
    occupancyRate: unknown;
  }> = [];
  if (orgId) {
    try {
      properties = await services.property.listProperties(orgId);
    } catch {
      // Graceful fallback
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Properties</h1>
          <p className="text-muted-foreground">Manage your property portfolio</p>
        </div>
        <Link
          href="/dashboard/properties/new"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          Add Property
        </Link>
      </div>

      <div className="rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-4 text-left text-sm font-medium">Name</th>
              <th className="p-4 text-left text-sm font-medium">Address</th>
              <th className="p-4 text-left text-sm font-medium">Type</th>
              <th className="p-4 text-left text-sm font-medium">Units</th>
              <th className="p-4 text-left text-sm font-medium">Occupancy</th>
            </tr>
          </thead>
          <tbody>
            {properties.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  No properties found. Add your first property to get started.
                </td>
              </tr>
            ) : (
              properties.map((property) => (
                <tr key={property.id} className="border-b">
                  <td className="p-4 text-sm font-medium">{property.name}</td>
                  <td className="p-4 text-sm">{property.address}</td>
                  <td className="p-4 text-sm">{property.propertyType}</td>
                  <td className="p-4 text-sm">{property.unitCount}</td>
                  <td className="p-4 text-sm">{Number(property.occupancyRate).toFixed(1)}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
