import { NextResponse } from 'next/server';

import { withErrorHandler, withTenantContext } from '@/lib/api/with-error-handler';
import { requirePermission } from '@/lib/auth';
import { services } from '@/server/services';

export const GET = withErrorHandler(
  withTenantContext(async (req: unknown) => {
    await requirePermission('report.read');
    const url = new URL((req as Request).url);
    const type = url.searchParams.get('type') ?? 'revenue';
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    const filters = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    switch (type) {
      case 'revenue':
        return NextResponse.json({ data: await services.report.getRevenueReport(filters) });
      case 'aging':
        return NextResponse.json({ data: await services.report.getAgingReport() });
      case 'occupancy':
        return NextResponse.json({ data: await services.report.getOccupancyReport() });
      default:
        return NextResponse.json({ data: await services.report.getRevenueReport(filters) });
    }
  }),
);
