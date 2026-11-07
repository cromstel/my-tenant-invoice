import { z } from 'zod';

export const SortDirectionSchema = z.enum(['asc', 'desc']);
export type SortDirection = z.infer<typeof SortDirectionSchema>;

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  sortBy: z.string().optional(),
  sortDir: SortDirectionSchema.default('desc'),
  search: z.string().trim().max(200).optional(),
});
export type PaginationInput = z.infer<typeof PaginationSchema>;

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function buildPaginationParams(input: PaginationInput): {
  skip: number;
  take: number;
  orderBy: Record<string, 'asc' | 'desc'> | undefined;
} {
  const skip = (input.page - 1) * input.pageSize;
  const take = input.pageSize;
  const orderBy =
    input.sortBy && input.sortBy.trim().length > 0 ? { [input.sortBy]: input.sortDir } : undefined;
  return { skip, take, orderBy };
}

export function buildPaginatedResult<T>(
  data: T[],
  total: number,
  input: PaginationInput,
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / input.pageSize) || 0;
  return {
    data,
    page: input.page,
    pageSize: input.pageSize,
    total,
    totalPages,
    hasNext: input.page < totalPages,
    hasPrev: input.page > 1,
  };
}
