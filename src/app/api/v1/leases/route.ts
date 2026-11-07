import { NextResponse } from 'next/server';

import { withErrorHandler, withTenantContext } from '@/lib/api/with-error-handler';
import { requirePermission } from '@/lib/auth';
import { services } from '@/server/services';

export const GET = withErrorHandler(
  withTenantContext(async (req: unknown) => {
    await requirePermission('lease.read');
    const url = new URL((req as Request).url);
    const orgId = url.searchParams.get('organizationId') ?? undefined;
    const leases = await services.lease.list(orgId);
    return NextResponse.json({ data: leases });
  }),
);

export const POST = withErrorHandler(
  withTenantContext(async (req: unknown) => {
    await requirePermission('lease.create');
    const body = await (req as Request).json();
    const lease = await services.lease.create(body);
    return NextResponse.json({ data: lease }, { status: 201 });
  }),
);
