import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { getCurrentUser } from '@/lib/auth';
import { setTenantContext } from '@/lib/db/tenant-context';
import {
  AppError,
  InternalError,
  RateLimitError,
  ValidationError,
  type ValidationIssue,
} from '@/lib/errors';
import logger from '@/lib/logging/logger';
import type { OrganizationId, UserId } from '@/lib/types/brands';

export type NextRouteHandler = (
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[]>> },
) => Promise<Response>;

export function withErrorHandler<T extends (...args: unknown[]) => Promise<Response>>(fn: T): T {
  return (async (...args: Parameters<T>): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        const issues: ValidationIssue[] = err.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        }));
        return NextResponse.json(new ValidationError(issues).toJSON(), { status: 400 });
      }

      if (err instanceof AppError) {
        if (err.statusCode >= 500) {
          logger.error({ err, ctx: err.context }, err.message);
        } else {
          logger.info({ code: err.code, ctx: err.context }, err.message);
        }
        const response: NextResponse<ReturnType<AppError['toJSON']>> = NextResponse.json(
          err.toJSON(),
          { status: err.statusCode },
        );
        if (err instanceof RateLimitError) {
          response.headers.set('Retry-After', String(err.retryAfterSec));
        }
        return response;
      }

      logger.error({ err }, 'Unhandled error');
      return NextResponse.json(new InternalError().toJSON(), { status: 500 });
    }
  }) as T;
}

export function withTenantContext<T extends (...args: unknown[]) => Promise<Response>>(fn: T): T {
  return (async (...args: Parameters<T>): Promise<Response> => {
    const user = await getCurrentUser();

    const organizationId: OrganizationId | null = user?.activeTenantId
      ? (user.activeTenantId as OrganizationId)
      : null;

    const userId: UserId | null = user?.id ? (user.id as UserId) : null;

    return setTenantContext<Response>(
      {
        organizationId,
        userId,
      },
      async (): Promise<Response> => fn(...args),
    );
  }) as T;
}
