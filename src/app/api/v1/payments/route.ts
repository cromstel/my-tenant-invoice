import { NextResponse } from 'next/server';

import { withErrorHandler, withTenantContext } from '@/lib/api/with-error-handler';
import { requirePermission } from '@/lib/auth';
import { services } from '@/server/services';

export const GET = withErrorHandler(
  withTenantContext(async (req: unknown) => {
    await requirePermission('payment.read');
    const url = new URL((req as Request).url);
    const status = url.searchParams.get('status') ?? undefined;
    const orgId = url.searchParams.get('organizationId') ?? undefined;
    const payments = await services.payment.list(orgId, status);
    return NextResponse.json({ data: payments });
  }),
);

export const POST = withErrorHandler(
  withTenantContext(async (req: unknown) => {
    await requirePermission('payment.record');
    const body = await (req as Request).json();
    const payment = await services.payment.recordPayment(body);
    return NextResponse.json({ data: payment }, { status: 201 });
  }),
);
