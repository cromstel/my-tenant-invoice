import { notFound } from 'next/navigation';

import { AppShell } from '@/components/app-shell/app-shell';
import { createMetadata, fmtDate, usd } from '@/lib/format';
import { requireOrgUser } from '@/server/page-guards';
import { services } from '@/server/services';

export const dynamic = 'force-dynamic';

export const metadata = createMetadata('Lease Details', 'View lease terms, dates, and charges.');

interface LeaseDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function LeaseDetailPage({ params }: LeaseDetailPageProps) {
  const { id } = await params;
  await requireOrgUser();

  let lease: Awaited<ReturnType<typeof services.lease.getById>> | null = null;
  try {
    lease = await services.lease.getById(id);
  } catch {
    notFound();
  }

  if (!lease) {
    notFound();
  }

  return (
    <AppShell>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Lease {lease.leaseNumber}</h1>
            <p className="text-muted-foreground">
              {lease.customer?.fullName ?? 'Unknown Customer'} · Unit{' '}
              {lease.unit?.unitNumber ?? 'Unknown'}
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-sm font-medium">
            {lease.status}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Start Date</div>
            <div className="text-lg font-bold">{fmtDate(lease.startDate)}</div>
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">End Date</div>
            <div className="text-lg font-bold">
              {lease.endDate ? fmtDate(lease.endDate) : 'Ongoing'}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Recurring Charge</div>
            <div className="text-lg font-bold">{usd(lease.recurringCharge)}</div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold">Lease Details</h3>
          <div className="grid gap-4 text-sm md:grid-cols-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Move-in Date</span>
              <span>{fmtDate(lease.moveInDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Move-out Date</span>
              <span>{lease.moveOutDate ? fmtDate(lease.moveOutDate) : '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Billing Start</span>
              <span>{fmtDate(lease.billingStartDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Deposit</span>
              <span>{usd(lease.depositAmount)}</span>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
