import Link from 'next/link';

import { AppNav, type NavItem } from '@/components/app-shell/app-nav';
import { UserMenu } from '@/components/app-shell/user-menu';
import { ORG_ROLES } from '@/config/roles';
import { getCurrentUser } from '@/lib/auth';

/**
 * Shared shell for every authenticated page: header, primary navigation
 * and page container. Server component so pages stay free of client
 * boundaries; navigation and the user menu are the only client islands.
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const orgId = user?.activeTenantId ?? null;
  const roles = orgId ? (user?.roles?.[orgId] ?? []) : [];
  const isPlatformAdmin = Object.values(user?.roles ?? {}).some((r) =>
    r.includes('PLATFORM_ADMIN'),
  );

  const navItems: NavItem[] = [];
  if (isPlatformAdmin) {
    navItems.push({ href: '/platform', label: 'Platform' });
  }
  if (roles.some((role) => (ORG_ROLES as readonly string[]).includes(role))) {
    navItems.push(
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/dashboard/properties', label: 'Properties' },
      { href: '/dashboard/customers', label: 'Customers' },
      { href: '/dashboard/invoices', label: 'Invoices' },
      { href: '/dashboard/payments', label: 'Payments' },
      { href: '/dashboard/leases', label: 'Leases' },
      { href: '/dashboard/meters', label: 'Meters' },
    );
  }
  if (roles.includes('TENANT_USER') && !navItems.some((item) => item.href === '/dashboard')) {
    navItems.push({ href: '/portal', label: 'Portal' });
  }

  return (
    <>
      <header className="border-b border-border bg-background py-3 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6">
          <Link href="/" className="flex items-center gap-2" aria-label="myTenant Invoice home">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" ry="1" />
              <rect x="21" y="3" width="7" height="7" rx="1" ry="1" />
              <rect x="3" y="21" width="7" height="7" rx="1" ry="1" />
              <rect x="21" y="21" width="7" height="7" rx="1" ry="1" />
              <line x1="3" y1="21" x2="21" y2="21" />
            </svg>
            <span className="text-xl font-bold tracking-tight">myTenant Invoice</span>
          </Link>

          <div className="flex items-center gap-4">
            {user?.activeTenantName && (
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {user.activeTenantName}
              </span>
            )}
            <UserMenu
              name={user?.name ?? null}
              email={user?.email ?? ''}
              orgName={user?.activeTenantName ?? null}
            />
          </div>
        </div>
      </header>

      {navItems.length > 0 && <AppNav items={navItems} />}

      <main className="mx-auto max-w-7xl p-6">{children}</main>
    </>
  );
}
