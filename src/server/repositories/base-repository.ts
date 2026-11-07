import { mapDbError } from '@/lib/db/map-db-error';
import prisma from '@/lib/db/prisma';
import { NotFoundError } from '@/lib/errors';
import {
  buildPaginatedResult,
  buildPaginationParams,
  type PaginatedResult,
  type PaginationInput,
} from '@/lib/validation/pagination';

/**
 * Generic base repository providing CRUD, pagination, filtering, and sorting.
 * All operations use the RLS-extended Prisma client, so tenant isolation is enforced.
 *
 * @template T - The Prisma model delegate type (e.g., `Prisma.InvoiceDelegate`)
 * @template Model - The model type (e.g., `Prisma.InvoiceGetPayload`)
 */
export abstract class BaseRepository<T, Model extends { id: string }> {
  protected abstract get delegate(): T;

  protected get client() {
    return prisma;
  }

  /**
   * Finds a single record by ID with optional relations.
   */
  async findById(id: string, include?: unknown): Promise<Model | null> {
    try {
      return (
        this.delegate as unknown as {
          findUnique: (args: { where: { id: string }; include?: unknown }) => Promise<Model | null>;
        }
      ).findUnique({ where: { id }, include });
    } catch (err) {
      throw mapDbError(err);
    }
  }

  async findByIdOrThrow(id: string, include?: unknown): Promise<Model> {
    const record = await this.findById(id, include);
    if (!record) throw new NotFoundError(`Record not found: ${id}`);
    return record;
  }

  /**
   * Finds the first record matching the given where clause.
   */
  async findFirst(where: Record<string, unknown>): Promise<Model | null> {
    try {
      return (
        this.delegate as unknown as {
          findFirst: (args: { where: Record<string, unknown> }) => Promise<Model | null>;
        }
      ).findFirst({ where });
    } catch (err) {
      throw mapDbError(err);
    }
  }

  /**
   * Finds multiple records with optional pagination, filtering, and sorting.
   */
  async findMany(
    pagination: PaginationInput,
    where: Record<string, unknown> = {},
    include?: unknown,
  ): Promise<PaginatedResult<Model>> {
    const { skip, take, orderBy } = buildPaginationParams(pagination);
    try {
      const [data, total] = await Promise.all([
        (
          this.delegate as unknown as {
            findMany: (args: {
              where: Record<string, unknown>;
              skip: number;
              take: number;
              orderBy?: unknown;
              include?: unknown;
            }) => Promise<Model[]>;
          }
        ).findMany({ where, skip, take, orderBy, include }),
        (
          this.delegate as unknown as {
            count: (args: { where: Record<string, unknown> }) => Promise<number>;
          }
        ).count({ where }),
      ]);
      return buildPaginatedResult(data, total, pagination);
    } catch (err) {
      throw mapDbError(err);
    }
  }

  /**
   * Finds all records matching the where clause (no pagination).
   */
  async findAll(
    where: Record<string, unknown> = {},
    include?: unknown,
    orderBy?: unknown,
  ): Promise<Model[]> {
    try {
      return (
        this.delegate as unknown as {
          findMany: (args: {
            where: Record<string, unknown>;
            include?: unknown;
            orderBy?: unknown;
          }) => Promise<Model[]>;
        }
      ).findMany({ where, include, orderBy });
    } catch (err) {
      throw mapDbError(err);
    }
  }

  /**
   * Creates a new record.
   */
  async create(data: Record<string, unknown>, include?: unknown): Promise<Model> {
    try {
      return (
        this.delegate as unknown as {
          create: (args: { data: Record<string, unknown>; include?: unknown }) => Promise<Model>;
        }
      ).create({ data, include });
    } catch (err) {
      throw mapDbError(err);
    }
  }

  /**
   * Creates multiple records in a transaction.
   */
  async createMany(data: Record<string, unknown>[]): Promise<number> {
    try {
      const result = await (
        this.delegate as unknown as {
          createMany: (args: { data: Record<string, unknown>[] }) => Promise<{ count: number }>;
        }
      ).createMany({ data });
      return result.count;
    } catch (err) {
      throw mapDbError(err);
    }
  }

  /**
   * Updates a record by ID.
   */
  async update(id: string, data: Record<string, unknown>, include?: unknown): Promise<Model> {
    try {
      return (
        this.delegate as unknown as {
          update: (args: {
            where: { id: string };
            data: Record<string, unknown>;
            include?: unknown;
          }) => Promise<Model>;
        }
      ).update({ where: { id }, data, include });
    } catch (err) {
      throw mapDbError(err);
    }
  }

  /**
   * Deletes a record by ID.
   */
  async delete(id: string): Promise<Model> {
    try {
      return (
        this.delegate as unknown as {
          delete: (args: { where: { id: string } }) => Promise<Model>;
        }
      ).delete({ where: { id } });
    } catch (err) {
      throw mapDbError(err);
    }
  }

  /**
   * Counts records matching the where clause.
   */
  async count(where: Record<string, unknown> = {}): Promise<number> {
    try {
      return (
        this.delegate as unknown as {
          count: (args: { where: Record<string, unknown> }) => Promise<number>;
        }
      ).count({ where });
    } catch (err) {
      throw mapDbError(err);
    }
  }

  /**
   * Checks if a record exists.
   */
  async exists(where: Record<string, unknown>): Promise<boolean> {
    const count = await this.count(where);
    return count > 0;
  }

  /**
   * Runs an arbitrary Prisma query on this model's delegate.
   */
  async query<R>(fn: (delegate: T) => Promise<R>): Promise<R> {
    try {
      return await fn(this.delegate);
    } catch (err) {
      throw mapDbError(err);
    }
  }
}

export type PrismaDelegate<T> = T;
