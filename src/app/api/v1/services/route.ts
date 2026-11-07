import { NextResponse } from 'next/server';

import { withErrorHandler, withTenantContext } from '@/lib/api/with-error-handler';
import { requirePermission } from '@/lib/auth';
import { services } from '@/server/services';

export const GET = withErrorHandler(
  withTenantContext(async (req: unknown) => {
    await requirePermission('service.read');
    const url = new URL((req as Request).url);
    const orgId = url.searchParams.get('organizationId') ?? undefined;
    const servicesList = await services.service.list(orgId);
    return NextResponse.json({ data: servicesList });
  }),
);

export const POST = withErrorHandler(
  withTenantContext(async (req: unknown) => {
    await requirePermission('service.create');
    const body = await (req as Request).json();
    const service = await services.service.create(body);
    return NextResponse.json({ data: service }, { status: 201 });
  }),
);
