export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  override readonly cause?: unknown;
  readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    opts?: { cause?: unknown; context?: Record<string, unknown> }
  ) {
    const cause = opts?.cause;
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = this.constructor.name;
    this.context = opts?.context;
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON(): {
    error: {
      code: string;
      message: string;
      traceId?: string;
    };
  } {
    const globalWithTrace = globalThis as typeof globalThis & {
      __traceId?: string;
    };
    return {
      error: {
        code: this.code,
        message: this.publicMessage,
        traceId: globalWithTrace.__traceId,
      },
    };
  }

  get publicMessage(): string {
    return this.message;
  }
}

/* ------------ 4xx client ------------ */

export class BadRequestError extends AppError {
  readonly code = "BAD_REQUEST";
  readonly statusCode = 400;
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export class ValidationError extends AppError {
  readonly code = "VALIDATION";
  readonly statusCode = 400;

  constructor(public readonly issues: ValidationIssue[]) {
    super("Input validation failed");
  }

  override get publicMessage(): string {
    return `${this.issues.length} field(s) invalid`;
  }
}

export class AuthenticationError extends AppError {
  readonly code = "UNAUTHENTICATED";
  readonly statusCode = 401;

  override get publicMessage(): string {
    return "Please sign in to continue.";
  }
}

export class AuthorizationError extends AppError {
  readonly code = "FORBIDDEN";
  readonly statusCode = 403;

  override get publicMessage(): string {
    return "You are not allowed to perform this action.";
  }
}

export class TenantMismatchError extends AppError {
  readonly code = "TENANT_MISMATCH";
  readonly statusCode = 403;

  constructor(opts?: { cause?: unknown; context?: Record<string, unknown> }) {
    super("Cross-tenant access denied", opts);
  }

  override get publicMessage(): string {
    return "Resource not found.";
  }
}

export class MissingTenantContextError extends AppError {
  readonly code = "MISSING_TENANT";
  readonly statusCode = 500;

  constructor(
    model?: string,
    opts?: { cause?: unknown; context?: Record<string, unknown> }
  ) {
    super(
      model
        ? `Tenant context is required for operation on model: ${model}`
        : "Tenant context is required",
      opts
    );
  }

  override get publicMessage(): string {
    return "Something went wrong on our end.";
  }
}

export class NotFoundError extends AppError {
  readonly code = "NOT_FOUND";
  readonly statusCode = 404;

  override get publicMessage(): string {
    return "Resource not found.";
  }
}

export class ConflictError extends AppError {
  readonly code = "CONFLICT";
  readonly statusCode = 409;
}

export class RateLimitError extends AppError {
  readonly code = "RATE_LIMITED";
  readonly statusCode = 429;

  constructor(public readonly retryAfterSec: number) {
    super("Rate limited");
  }
}

/* ------------ 5xx server ------------ */

export class InternalError extends AppError {
  readonly code = "INTERNAL";
  readonly statusCode = 500;

  constructor(message = "Internal server error", opts?: { cause?: unknown; context?: Record<string, unknown> }) {
    super(message, opts);
  }

  override get publicMessage(): string {
    return "Something went wrong on our end.";
  }
}

export class PaymentProviderError extends AppError {
  readonly code = "PAYMENT_PROVIDER";
  readonly statusCode = 502;

  constructor(
    message: string,
    public readonly providerCode: string,
    opts?: { cause?: unknown; context?: Record<string, unknown> }
  ) {
    super(message, opts);
  }

  override get publicMessage(): string {
    return "Payment service is temporarily unavailable.";
  }
}
