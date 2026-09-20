# Error Handling

> Typed error hierarchy · safe user messages · explicit cross-tenant rejection · standard JSON problem format.

---

## 1. Error Hierarchy

One base class + typed subclasses exported from a single module.

```ts
// lib/errors.ts
export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  readonly cause?: unknown;
  readonly context?: Record<string, unknown>;

  constructor(message: string, opts?: { cause?: unknown; context?: Record<string, unknown> }) {
    super(message);
    this.name = this.constructor.name;
    this.cause = opts?.cause;
    this.context = opts?.context;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.publicMessage,
        traceId: (globalThis as any).__traceId ?? undefined,
      },
    };
  }

  get publicMessage(): string {
    return this.message; // overridden where safe
  }
}

/* ──────────── 4xx client ──────────── */
export class BadRequestError extends AppError {
  readonly code = "BAD_REQUEST";
  readonly statusCode = 400;
}

export class ValidationError extends AppError {
  readonly code = "VALIDATION";
  readonly statusCode = 400;
  constructor(public readonly issues: Array<{ path: string; message: string }>) {
    super("Input validation failed");
  }
  get publicMessage() {
    return `${this.issues.length} field(s) invalid`;
  }
}

export class AuthenticationError extends AppError {
  readonly code = "UNAUTHENTICATED";
  readonly statusCode = 401;
  get publicMessage() { return "Please sign in to continue."; }
}

export class AuthorizationError extends AppError {
  readonly code = "FORBIDDEN";
  readonly statusCode = 403;
  get publicMessage() { return "You are not allowed to perform this action."; }
}

export class TenantMismatchError extends AppError {
  readonly code = "TENANT_MISMATCH";
  readonly statusCode = 403;
  constructor(opts?: { cause?: unknown }) {
    super("Cross-tenant access denied", opts);
  }
  get publicMessage() { return "Resource not found."; } // mask existence
}

export class NotFoundError extends AppError {
  readonly code = "NOT_FOUND";
  readonly statusCode = 404;
  get publicMessage() { return "Resource not found."; }
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

/* ──────────── 5xx server ──────────── */
export class InternalError extends AppError {
  readonly code = "INTERNAL";
  readonly statusCode = 500;
  get publicMessage() { return "Something went wrong on our end."; }
}

export class PaymentProviderError extends AppError {
  readonly code = "PAYMENT_PROVIDER";
  readonly statusCode = 502;
  constructor(message: string, public readonly providerCode: string) {
    super(message);
  }
  get publicMessage() { return "Payment service is temporarily unavailable."; }
}
```

---

## 2. Error Mapping at Boundaries

### 2.1 Route Handler Wrapper

```ts
// lib/api/with-error-handler.ts
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  AppError, ValidationError, AuthenticationError, InternalError,
} from "@/lib/errors";
import { logger } from "@/lib/logging";

export function withErrorHandler<T extends (...args: any[]) => Promise<Response>>(fn: T): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json(
          new ValidationError(err.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          }))).toJSON(),
          { status: 400 }
        );
      }
      if (err instanceof AppError) {
        if (err.statusCode >= 500) {
          logger.error({ err, ctx: err.context }, err.message);
        } else {
          logger.info({ code: err.code, ctx: err.context }, err.message);
        }
        const res = NextResponse.json(err.toJSON(), { status: err.statusCode });
        if (err instanceof RateLimitError) {
          res.headers.set("Retry-After", String(err.retryAfterSec));
        }
        return res;
      }
      logger.error({ err }, "Unhandled error");
      return NextResponse.json(new InternalError("Unexpected").toJSON(), { status: 500 });
    }
  }) as T;
}
```

### 2.2 tRPC Procedure Wrapper

```ts
// server/trpc/init.ts
import { initTRPC, TRPCError } from "@trpc/server";
import { AppError, TenantMismatchError, AuthorizationError } from "@/lib/errors";

const t = initTRPC.context<Context>().create();
export const router = t.router;

export const publicProcedure = t.procedure
  .use(async ({ next }) => {
    try {
      return await next();
    } catch (err) {
      if (err instanceof AppError) {
        throw new TRPCError({
          code: mapStatusToTrpcCode(err.statusCode),
          message: err.publicMessage,
          cause: err,
        });
      }
      throw err;
    }
  });
```

---

## 3. Cross-Tenant Enforcement Pattern

**Every** query must include `organizationId` scoping. When a row comes back with a different `organizationId`, throw `TenantMismatchError` (publicly looks like 404).

```ts
// lib/db/repos/invoice-repo.ts
export class DrizzleInvoiceRepo implements InvoiceReadRepo, InvoiceWriteRepo {
  constructor(private readonly db: MySQL, private readonly orgId: OrganizationId) {}

  async findById(id: InvoiceId): Promise<Invoice | null> {
    const row = await this.db.query.invoices.findFirst({
      where: eq(invoices.id, id),
    });
    if (!row) return null;
    if (row.organizationId !== this.orgId) {
      throw new TenantMismatchError({
        context: { wanted: this.orgId, got: row.organizationId, invoiceId: id },
      });
    }
    return row;
  }

  async listByOrg(_orgId: OrganizationId, f: InvoiceFilter) {
    // Here orgId is fixed via constructor; _orgId param intentionally ignored.
    return this.db.query.invoices.findMany({
      where: and(
        eq(invoices.organizationId, this.orgId),
        f.status ? eq(invoices.status, f.status) : undefined,
        f.customerId ? eq(invoices.customerId, f.customerId) : undefined
      ),
      orderBy: desc(invoices.createdAt),
      limit: f.limit ?? 50,
      offset: f.offset ?? 0,
    });
  }
}
```

---

## 4. Server Action Errors → Client Toast

```tsx
// app/(platform)/invoices/new/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { AppError, ValidationError } from "@/lib/errors";

export async function createInvoiceAction(input: unknown) {
  try {
    const created = await invoiceService.create(input);
    revalidatePath("/invoices");
    return { ok: true, id: created.id };
  } catch (err) {
    if (err instanceof ValidationError) {
      return { ok: false as const, code: err.code, issues: err.issues };
    }
    if (err instanceof AppError) {
      return { ok: false as const, code: err.code, message: err.publicMessage };
    }
    return { ok: false as const, code: "INTERNAL", message: "Could not create invoice." };
  }
}
```

```tsx
// in form submit handler
const res = await createInvoiceAction(values);
if (!res.ok) {
  if (res.code === "VALIDATION" && "issues" in res) {
    for (const issue of res.issues) form.setError(issue.path as any, { message: issue.message });
  } else {
    toast.error(res.message ?? "Something went wrong");
  }
}
```

---

## 5. Database Error Mapping

Map driver-level errors to typed domain errors:

```ts
// lib/db/map-db-error.ts
import { MySql2DatabaseError } from "drizzle-orm/mysql2";
import { ConflictError, InternalError } from "@/lib/errors";

export function mapDbError(err: unknown, keys: Record<string, string> = {}) {
  if (!(err instanceof Error)) return new InternalError("DB error", { cause: err });
  const mysqlErr = err as MySql2DatabaseError;
  switch (mysqlErr.code) {
    case "ER_DUP_ENTRY": {
      const match = mysqlErr.message.match(/for key '([^']+)'/);
      const field = match ? keys[match[1]] ?? match[1] : "value";
      return new ConflictError(`Duplicate ${field}`);
    }
    case "ER_ROW_IS_REFERENCED_2":
      return new ConflictError("Cannot delete: record is still referenced");
    case "ER_LOCK_WAIT_TIMEOUT":
      return new ConflictError("Record is locked, retry");
    default:
      return new InternalError("DB error", { cause: err });
  }
}
```

---

## 6. Never Log Secrets

The logger redacts keys matching a denylist before serialize:

```ts
// lib/logging/redact.ts
const redactKeys = new Set([
  "authorization", "cookie", "set-cookie",
  "password", "password_confirm", "secret",
  "sk_", "pk_", "api_key", "token", "client_secret",
  "card_number", "cvc", "ssn",
]);

export function redact(obj: unknown, depth = 0): unknown {
  if (depth > 6) return "[redacted: max depth]";
  if (Array.isArray(obj)) return obj.map((v) => redact(v, depth + 1));
  if (obj && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
        k,
        redactKeys.has(k.toLowerCase()) ? "[REDACTED]" : redact(v, depth + 1),
      ])
    );
  }
  return obj;
}
```
