import { NextResponse } from 'next/server';

import { withErrorHandler, withTenantContext } from '@/lib/api/with-error-handler';
import { requirePermission } from '@/lib/auth';
import { services } from '@/server/services';

export const GET = withErrorHandler(
  withTenantContext(async (req: unknown) => {
    await requirePermission('property.read');
    const url = new URL((req as Request).url);
    const orgId = url.searchParams.get('organizationId') ?? undefined;
    const properties = await services.property.listProperties(orgId);
    return NextResponse.json({ data: properties });
  }),
);

export const POST = withErrorHandler(
  withTenantContext(async (req: unknown) => {
    await requirePermission('property.create');
    const body = await (req as Request).json();
    const property = await services.property.createProperty(body);
    return NextResponse.json({ data: property }, { status: 201 });
  }),
);
