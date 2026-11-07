import type { PaginationInput } from '@/lib/validation/pagination';

export function computeSkip(page: number, pageSize: number): number {
  return Math.max(0, (page - 1) * pageSize);
}

export function computeTotalPages(total: number, pageSize: number): number {
  return Math.ceil(total / pageSize) || 0;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function buildPaginationMeta(input: PaginationInput, total: number): PaginationMeta {
  const totalPages = computeTotalPages(total, input.pageSize);
  return {
    page: input.page,
    pageSize: input.pageSize,
    total,
    totalPages,
    hasNext: input.page < totalPages,
    hasPrev: input.page > 1,
  };
}
