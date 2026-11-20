import { AppShell } from '@/components/app-shell/app-shell';
import { RowLink } from '@/components/ui/row-link';
import { createMetadata, fmtCount, fmtOccupancy } from '@/lib/format';
import { requireOrgUser } from '@/server/page-guards';
import { services } from '@/server/services';

export const dynamic = 'force-dynamic';

export const metadata = createMetadata(
  'Properties',
  'Manage your property portfolio, units, and occupancy rates.',
);

export default async function PropertiesPage() {
  const user = await requireOrgUser();
  const orgId = user.activeTenantId;

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
      // Graceful fallback when properties cannot be listed
    }
  }

  return (
    <AppShell>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Properties</h1>
          <p className="text-muted-foreground">Manage your property portfolio</p>
        </div>

        <div className="rounded-lg border">
          <div className="overflow-x-auto">
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
                      No properties found.
                    </td>
                  </tr>
                ) : (
                  properties.map((property) => (
                    <tr key={property.id} className="border-b">
                      <td className="p-4 text-sm font-medium">
                        <RowLink href={`/dashboard/properties/${property.id}`}>
                          {property.name}
                        </RowLink>
                      </td>
                      <td className="p-4 text-sm">{property.address}</td>
                      <td className="p-4 text-sm">{property.propertyType}</td>
                      <td className="p-4 text-sm">{fmtCount(property.unitCount)}</td>
                      <td className="p-4 text-sm">{fmtOccupancy(property.occupancyRate)}</td>
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
