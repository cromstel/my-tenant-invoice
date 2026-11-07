import { NextResponse } from 'next/server';

import { withErrorHandler, withTenantContext } from '@/lib/api/with-error-handler';
import { requirePermission } from '@/lib/auth';
import { services } from '@/server/services';

export const GET = withErrorHandler(
  withTenantContext(async (req: unknown) => {
    await requirePermission('tariff.read');
    const url = new URL((req as Request).url);
    const orgId = url.searchParams.get('organizationId') ?? undefined;
    const tariffs = await services.tariff.list(orgId);
    return NextResponse.json({ data: tariffs });
  }),
);

export const POST = withErrorHandler(
  withTenantContext(async (req: unknown) => {
    await requirePermission('tariff.create');
    const body = await (req as Request).json();
    const tariff = await services.tariff.create(body);
    return NextResponse.json({ data: tariff }, { status: 201 });
  }),
);
