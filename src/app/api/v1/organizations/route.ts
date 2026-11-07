import { NextResponse } from 'next/server';

import { withErrorHandler, withTenantContext } from '@/lib/api/with-error-handler';
import { requirePermission } from '@/lib/auth';
import { services } from '@/server/services';

export const GET = withErrorHandler(
  withTenantContext(async () => {
    await requirePermission('org.read');
    const orgs = await services.organization.list();
    return NextResponse.json({ data: orgs });
  }),
);

export const POST = withErrorHandler(
  withTenantContext(async (req: unknown) => {
    await requirePermission('org.create');
    const body = await (req as Request).json();
    const org = await services.organization.create(body);
    return NextResponse.json({ data: org }, { status: 201 });
  }),
);
