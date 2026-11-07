/**
 * Standard API response envelope.
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    traceId?: string;
    details?: unknown;
  };
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Context passed to audit log entries.
 */
export interface AuditContext {
  userId: string;
  organizationId?: string | null;
  ipAddress?: string;
  userAgent?: string;
  traceId?: string;
}

/**
 * Generic filter type for list queries.
 */
export type ListFilter<T = unknown> = {
  [K in keyof T]?: T[K] | T[K][] | { gte?: T[K]; lte?: T[K]; contains?: string };
} & {
  search?: string;
};

export type SortDirection = 'asc' | 'desc';
