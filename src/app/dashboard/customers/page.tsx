import Link from 'next/link';

import { AppShell } from '@/components/app-shell/app-shell';
import { createMetadata, TOUCH_TARGET_CLASS } from '@/lib/format';
import { cn } from '@/lib/utils';
import { requireOrgUser } from '@/server/page-guards';
import { services } from '@/server/services';

export const dynamic = 'force-dynamic';

export const metadata = createMetadata(
  'Customers',
  'Manage your customer records, contact information, and tenant details.',
);

export default async function CustomersPage() {
  const user = await requireOrgUser();
  const orgId = user.activeTenantId;

  let customers: Array<{
    id: string;
    fullName: string | null;
    email: string | null;
    type: string;
    phoneNumber: string | null;
  }> = [];
  if (orgId) {
    try {
      customers = await services.customer.list(orgId);
    } catch {
      // Graceful fallback when customers cannot be listed
    }
  }

  return (
    <AppShell>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">Manage your customer records</p>
        </div>

        <div className="rounded-lg border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-4 text-left text-sm font-medium">Name</th>
                <th className="p-4 text-left text-sm font-medium">Email</th>
                <th className="p-4 text-left text-sm font-medium">Type</th>
                <th className="p-4 text-left text-sm font-medium">Phone</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
                    No customers found.
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id} className="border-b">
                    <td className="p-4 text-sm font-medium">
                      <Link
                        href={`/dashboard/customers/${customer.id}`}
                        className={cn(
                          TOUCH_TARGET_CLASS,
                          'inline-flex items-center text-primary underline-offset-4 hover:underline',
                        )}
                      >
                        {customer.fullName ?? 'Unnamed'}
                      </Link>
                    </td>
                    <td className="p-4 text-sm">{customer.email ?? '-'}</td>
                    <td className="p-4 text-sm">{customer.type}</td>
                    <td className="p-4 text-sm">{customer.phoneNumber ?? '-'}</td>
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
