import { NextResponse } from 'next/server';

import { withErrorHandler, withTenantContext } from '@/lib/api/with-error-handler';
import { requirePermission } from '@/lib/auth';
import { services } from '@/server/services';

export const GET = withErrorHandler(
  withTenantContext(async (req: unknown) => {
    await requirePermission('invoice.read');
    const url = new URL((req as Request).url);
    const status = url.searchParams.get('status') ?? undefined;
    const orgId = url.searchParams.get('organizationId') ?? undefined;
    const invoices = await services.invoice.list(orgId, status);
    return NextResponse.json({ data: invoices });
  }),
);

export const POST = withErrorHandler(
  withTenantContext(async (req: unknown) => {
    await requirePermission('invoice.create');
    const body = await (req as Request).json();
    const invoice = await services.invoice.create(body);
    return NextResponse.json({ data: invoice }, { status: 201 });
  }),
);
