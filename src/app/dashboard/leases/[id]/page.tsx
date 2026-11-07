import { notFound } from 'next/navigation';

import { services } from '@/server/services';

export const dynamic = 'force-dynamic';

interface LeaseDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function LeaseDetailPage({ params }: LeaseDetailPageProps) {
  const { id } = await params;

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
          <div className="text-lg font-bold">
            {new Date(lease.startDate as Date).toLocaleDateString()}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">End Date</div>
          <div className="text-lg font-bold">
            {lease.endDate ? new Date(lease.endDate as Date).toLocaleDateString() : 'Ongoing'}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Recurring Charge</div>
          <div className="text-lg font-bold">${Number(lease.recurringCharge).toLocaleString()}</div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold">Lease Details</h3>
        <div className="grid gap-4 text-sm md:grid-cols-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Move-in Date</span>
            <span>{new Date(lease.moveInDate as Date).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Move-out Date</span>
            <span>
              {lease.moveOutDate ? new Date(lease.moveOutDate as Date).toLocaleDateString() : '-'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Billing Start</span>
            <span>{new Date(lease.billingStartDate as Date).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Deposit</span>
            <span>${Number(lease.depositAmount).toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        {lease.status === 'ACTIVE' && (
          <a
            href={`/dashboard/leases/${id}/edit`}
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium shadow hover:bg-accent"
          >
            Edit
          </a>
        )}
      </div>
    </div>
  );
}
