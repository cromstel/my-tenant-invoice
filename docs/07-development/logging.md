# Logging

> Structured JSON logs (pino) · correlation trace IDs · 7 standard levels · OTLP traces pipeline.

---

## 1. Logger Interface

Use a single singleton from `lib/logging/logger.ts` — never `console.log`.

```ts
// lib/logging/logger.ts
import pino, { Logger, type Level } from "pino";
import { redact } from "./redact";

const level: Level = (process.env.LOG_LEVEL as Level) ?? "info";

const base: Logger["levels"]["values"] = {
  trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60, silent: Infinity,
};

let logger: Logger;
if (process.env.NODE_ENV === "production") {
  logger = pino({
    level,
    base: { service: "mytenant-invoice" },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      log(object) { return redact(object) as any; },
      level(label) { return { level: label }; },
    },
    transport: {
      targets: [
        { target: "pino/file", level, options: { destination: 1 } }, // stdout
      ],
    },
  });
} else {
  const pretty = (process.env.LOG_PRETTY ?? "1") === "1";
  logger = pino({
    level,
    transport: pretty
      ? { target: "pino-pretty", options: { colorize: true, translateTime: true } }
      : undefined,
  });
}

export const logger = logger;
```

### 1.1 Usage

```ts
logger.info({ orgId, invoiceId, customerId }, "Invoice generated");
logger.warn({ orgId, invoiceId, deltaMs: 1200 }, "Invoice send took too long");
logger.error({ err, orgId }, "Overdue cron failed");
```

**One mandatory rule**: string message is constant English, all variable data lives in the first arg (context object). This lets log aggregators group by message.

---

## 2. Log Levels

| Level  | Use When                                                                 |
|--------|--------------------------------------------------------------------------|
| fatal  | Unrecoverable state — crash loop, DB connection pool exhausted           |
| error  | One request/action failed — webhook failed, payment 5xx, cron step err  |
| warn   | Worked but unexpected — retried once, stale cache, approaching quota     |
| info   | Business events — invoice sent, payment succeeded, user signed in       |
| debug  | Developer-only trace — individual SQL timings, flag evaluation          |
| trace  | TMI — individual function entry/exit, raw payloads (truncated)          |

Production default: `info`. Log volumes above 2GB/day → reclassify items as `debug`.

---

## 3. Structured Context (Mandatory Fields)

Every log emitted in a request scope must carry:

| Field         | Source                      | Example value               |
|---------------|-----------------------------|-----------------------------|
| `traceId`     | `x-request-id` header or generated | `9a0c...`              |
| `requestId`   | Per-request ID              | `req_xxx`                   |
| `organizationId` | Session                 | `org_abc`                   |
| `userId`      | Session                     | `user_def`                  |
| `method` + `path` | Next request            | `POST /api/payments/checkout`|
| `statusCode`  | Response                    | `200`, `403`, etc.          |
| `latencyMs`   | Measured                    | `143`                       |

Implement with a middleware using `AsyncLocalStorage`:

```ts
// lib/logging/async-context.ts
import { AsyncLocalStorage } from "async_hooks";

export type LogContext = {
  traceId: string;
  requestId?: string;
  organizationId?: string;
  userId?: string;
};

export const logContext = new AsyncLocalStorage<LogContext>();

export function withLogContext<T>(ctx: Partial<LogContext>, fn: () => Promise<T>) {
  const parent = logContext.getStore();
  const merged: LogContext = {
    traceId: ctx.traceId ?? parent?.traceId ?? randomUUID(),
    requestId: ctx.requestId ?? parent?.requestId,
    organizationId: ctx.organizationId ?? parent?.organizationId,
    userId: ctx.userId ?? parent?.userId,
  };
  return logContext.run(merged, fn);
}
```

A pino mixin appends the context automatically:

```ts
mixin() {
  const store = logContext.getStore();
  return store ?? {};
},
```

---

## 4. Request Logging Middleware (Next.js Custom Server)

```ts
// server/request-logger.ts
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logging";
import { withLogContext } from "@/lib/logging/async-context";
import { randomUUID } from "crypto";

export async function requestLogger(req: NextRequest, next: () => Promise<NextResponse>) {
  const startedAt = performance.now();
  const traceId = req.headers.get("x-request-id") ?? randomUUID();

  return withLogContext({ traceId }, async () => {
    const res = await next();
    const latencyMs = Math.round(performance.now() - startedAt);
    const logFn =
      res.status >= 500 ? logger.error :
      res.status >= 400 ? logger.warn  : logger.info;
    logFn(
      {
        method: req.method,
        path: req.nextUrl.pathname,
        statusCode: res.status,
        latencyMs,
        userAgent: req.headers.get("user-agent"),
      },
      `${req.method} ${req.nextUrl.pathname} -> ${res.status}`
    );
    res.headers.set("x-trace-id", traceId);
    return res;
  });
}
```

---

## 5. Business Events (Audit)

Business events go to a dedicated `audit` logger piped to a separate index:

```ts
// lib/audit.ts
import pino from "pino";

export const audit = pino({
  level: "info",
  name: "audit",
  base: { service: "mytenant-invoice", stream: "audit" },
});

export function auditLog(
  actor: { userId?: string; email?: string },
  action: string,
  subject: { type: string; id: string; organizationId: string },
  changeset?: Record<string, { before?: unknown; after?: unknown }>
) {
  audit.info(
    { actor, action, subject, changeset },
    `AUDIT ${action}`
  );
}
```

Example call sites:

```ts
auditLog(actor, "INVOICE.SENT",     { type: "invoice", id, organizationId });
auditLog(actor, "INVOICE.DELETED",  { type: "invoice", id, organizationId });
auditLog(actor, "USER.INVITED",     { type: "user", id, organizationId });
auditLog(actor, "ROLE.UPDATED",     { type: "user", id, organizationId }, {
  role: { before: "MEMBER", after: "ADMIN" },
});
```

---

## 6. Pipeline

```
[app server pino stdout]
    → (k8s) fluent-bit sidecar →
        → AWS CloudWatch / Grafana Loki (prod)
        → OTLP trace exporter → Tempo → Jaeger query UI
```

Alerts:
- `error` count rate > 2/min over 5 min → Slack #engineering-alerts
- `fatal` occurrence → Slack + PagerDuty
- `5xx` rate > 1% over 5 min → PagerDuty

---

## 7. Forbidden Logging Practices

- Never log `password`, `secret`, `token`, PII that's not required.
- Never log full request bodies of `/api/payments/**` or `/api/auth/**`.
- Never log full credit card / bank account data (PCI scope).
- Never interpolate variables into the log message string:
  ```ts
  // ❌
  logger.info(`Invoice ${id} sent to ${email}`);
  // ✅
  logger.info({ invoiceId: id, email }, "Invoice sent");
  ```
