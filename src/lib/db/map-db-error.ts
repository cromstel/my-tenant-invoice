import { Prisma } from '@prisma/client';

import { AppError, ConflictError, InternalError, NotFoundError } from '@/lib/errors';

type FriendlyKeys = Record<string, string>;

function extractTargetFields(meta: unknown): string[] | null {
  if (!meta || typeof meta !== 'object') return null;
  const m = meta as { target?: unknown };
  if (Array.isArray(m.target)) {
    return m.target.filter((t): t is string => typeof t === 'string');
  }
  if (typeof m.target === 'string') {
    return [m.target];
  }
  return null;
}

function resolveFriendlyField(fields: string[], keys: FriendlyKeys): string {
  const matched = fields.map((f) => keys[f]).filter((v): v is string => typeof v === 'string');
  if (matched.length > 0) {
    return matched.join(', ');
  }
  if (fields.length > 0) {
    return fields.join(', ');
  }
  return 'value';
}

export function mapDbError(err: unknown, friendlyKeys: FriendlyKeys = {}): AppError {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = err.meta;

    switch (err.code) {
      case 'P2002': {
        const fields = extractTargetFields(meta);
        const fieldName = fields ? resolveFriendlyField(fields, friendlyKeys) : 'value';
        return new ConflictError(`Duplicate ${fieldName}`, {
          cause: err,
          context: {
            prismaCode: err.code,
            target: fields,
          },
        });
      }

      case 'P2003': {
        const fields = extractTargetFields(meta);
        const fieldName = fields ? resolveFriendlyField(fields, friendlyKeys) : undefined;
        return new ConflictError(
          fieldName
            ? `Cannot modify record: ${fieldName} is referenced by another record`
            : 'Record is referenced by another record',
          {
            cause: err,
            context: {
              prismaCode: err.code,
              target: fields,
            },
          },
        );
      }

      case 'P2010': {
        return new InternalError('Database query failed', {
          cause: err,
          context: {
            prismaCode: err.code,
          },
        });
      }

      case 'P2015': {
        return new NotFoundError('Related record not found', {
          cause: err,
          context: {
            prismaCode: err.code,
          },
        });
      }

      case 'P2025': {
        const causeMeta = meta as { cause?: unknown } | undefined;
        const causeMsg =
          causeMeta?.cause && typeof causeMeta.cause === 'string'
            ? causeMeta.cause
            : 'Record not found';
        return new NotFoundError(causeMsg, {
          cause: err,
          context: {
            prismaCode: err.code,
          },
        });
      }

      case 'P2028': {
        return new InternalError('Database transaction error', {
          cause: err,
          context: {
            prismaCode: err.code,
          },
        });
      }

      default: {
        return new InternalError('Database error', {
          cause: err,
          context: {
            prismaCode: err.code,
          },
        });
      }
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return new InternalError('Database validation error', {
      cause: err,
      context: {
        prismaError: 'PrismaClientValidationError',
      },
    });
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    return new InternalError('Database connection error', {
      cause: err,
      context: {
        prismaError: 'PrismaClientInitializationError',
        errorCode: err.errorCode,
      },
    });
  }

  if (err instanceof Prisma.PrismaClientRustPanicError) {
    return new InternalError('Database engine failure', {
      cause: err,
      context: {
        prismaError: 'PrismaClientRustPanicError',
      },
    });
  }

  if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    return new InternalError('Unknown database error', {
      cause: err,
      context: {
        prismaError: 'PrismaClientUnknownRequestError',
      },
    });
  }

  if (err instanceof AppError) {
    return err;
  }

  return new InternalError('Unexpected database error', {
    cause: err,
  });
}
