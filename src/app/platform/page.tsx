import { services } from '@/server/services';

export const dynamic = 'force-dynamic';

export default async function PlatformDashboardPage() {
  let organizations: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    createdAt: Date;
  }> = [];
  try {
    const result = await services.organization.list();
    organizations = result.data ?? [];
  } catch {
    // Graceful fallback
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platform Dashboard</h1>
        <p className="text-muted-foreground">Manage the entire SaaS platform</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Total Organizations</div>
          <div className="text-2xl font-bold">{organizations.length}</div>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Active</div>
          <div className="text-2xl font-bold">
            {organizations.filter((o) => o.status === 'ACTIVE').length}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Trial</div>
          <div className="text-2xl font-bold">
            {organizations.filter((o) => o.status === 'TRIAL').length}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Suspended</div>
          <div className="text-2xl font-bold">
            {organizations.filter((o) => o.status === 'SUSPENDED').length}
          </div>
        </div>
      </div>

      <div className="rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-4 text-left text-sm font-medium">Name</th>
              <th className="p-4 text-left text-sm font-medium">Slug</th>
              <th className="p-4 text-left text-sm font-medium">Status</th>
              <th className="p-4 text-left text-sm font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {organizations.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-muted-foreground">
                  No organizations found.
                </td>
              </tr>
            ) : (
              organizations.map((org) => (
                <tr key={org.id} className="border-b">
                  <td className="p-4 text-sm font-medium">{org.name}</td>
                  <td className="p-4 text-sm">{org.slug}</td>
                  <td className="p-4 text-sm">
                    <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
                      {org.status}
                    </span>
                  </td>
                  <td className="p-4 text-sm">{new Date(org.createdAt).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
