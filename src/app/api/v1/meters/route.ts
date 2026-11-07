import { NextResponse } from 'next/server';

import { withErrorHandler, withTenantContext } from '@/lib/api/with-error-handler';
import { requirePermission } from '@/lib/auth';
import { services } from '@/server/services';

export const GET = withErrorHandler(
  withTenantContext(async (req: unknown) => {
    await requirePermission('meter.read');
    const url = new URL((req as Request).url);
    const orgId = url.searchParams.get('organizationId') ?? undefined;
    const meters = await services.meter.list(orgId);
    return NextResponse.json({ data: meters });
  }),
);

export const POST = withErrorHandler(
  withTenantContext(async (req: unknown) => {
    await requirePermission('meter.create');
    const body = await (req as Request).json();
    const meter = await services.meter.create(body);
    return NextResponse.json({ data: meter }, { status: 201 });
  }),
);
