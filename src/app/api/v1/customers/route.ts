import { NextResponse } from 'next/server';

import { withErrorHandler, withTenantContext } from '@/lib/api/with-error-handler';
import { requirePermission } from '@/lib/auth';
import { services } from '@/server/services';

export const GET = withErrorHandler(
  withTenantContext(async (req: unknown) => {
    await requirePermission('customer.read');
    const url = new URL((req as Request).url);
    const orgId = url.searchParams.get('organizationId') ?? undefined;
    const customers = await services.customer.list(orgId);
    return NextResponse.json({ data: customers });
  }),
);

export const POST = withErrorHandler(
  withTenantContext(async (req: unknown) => {
    await requirePermission('customer.create');
    const body = await (req as Request).json();
    const customer = await services.customer.create(body);
    return NextResponse.json({ data: customer }, { status: 201 });
  }),
);
