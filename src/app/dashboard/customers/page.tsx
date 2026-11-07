import Link from 'next/link';

import { getCurrentUser } from '@/lib/auth';
import { services } from '@/server/services';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  const user = await getCurrentUser();
  const orgId = user?.activeTenantId ?? null;

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
      // Graceful fallback
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">Manage your customer records</p>
        </div>
        <Link
          href="/dashboard/customers/new"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          Add Customer
        </Link>
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
                  No customers found. Add your first customer to get started.
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer.id} className="border-b">
                  <td className="p-4 text-sm font-medium">{customer.fullName ?? 'Unnamed'}</td>
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
  );
}
